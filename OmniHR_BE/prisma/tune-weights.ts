/**
 * Fits the AI assignee ranking weights on history instead of hand-picking them.
 *
 * Two sources of truth, both replayed with the same scoring functions the API
 * ranks with (src/ai-task-suggestions/suggestion-scoring.ts):
 *
 *   1. Simulated ground truth - every manual assignment is replayed as a
 *      decision, and a weight vector is scored by how well the ranking it
 *      produces tracks the simulator's hidden ability of each candidate.
 *   2. Manager feedback - every suggestion a manager acted on records which
 *      candidate they picked and the component scores behind it, so a weight
 *      vector can be scored by how often it would have put that person first.
 *      This is empty until the feature has been used; the report says so.
 *
 * Decisions are split by date: the earlier part fits the weights, the later
 * part is held out, so the reported gain is not the gain on what was fitted.
 *
 * Read-only unless --apply is passed.
 *
 *   npx tsx prisma/tune-weights.ts [--from 2026-08-03] [--step 0.05] [--apply]
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { AiTaskSuggestionStatus, Prisma } from "@prisma/client";
import {
  COLD_START_TASKS,
  DEFAULT_SCORE_WEIGHTS,
  ScoreWeights,
  combineScores,
  compareCandidates
} from "../src/ai-task-suggestions/suggestion-scoring";
import {
  Candidate,
  Decision,
  buildDecisions,
  loadData,
  mean,
  parseFrom,
  pct,
  prisma,
  spearman
} from "./evaluate-suggestions";

const SYSTEM_SETTINGS_KEY = "default";
/** Share of the (date-ordered) decisions used to fit rather than to check. */
const FIT_SHARE = 0.7;
/** Below this, an "agreement rate" is noise rather than a signal. */
const MIN_FEEDBACK_DECISIONS = 20;

/**
 * A grid search over a handful of decisions will always find a vector that
 * looks better, and it will be fitting noise. Below these thresholds the
 * script still reports the search but refuses to change anything.
 */
const MIN_DECISIONS = 60;
const MIN_HELD_OUT = 20;
/** Correlation gain on held-out decisions worth acting on. */
const MIN_HELD_OUT_GAIN = 0.05;

/**
 * Kept at 0 by default now that leave and load are terms in the objective
 * itself: constraining the search space was a workaround for a metric that
 * could not see them. `--floor` still exists for experiments.
 */
const DEFAULT_WEIGHT_FLOOR = 0;

/**
 * Company policy, not statistics: these say how much a leave violation or a
 * lopsided workload is worth against a percentage point of on-time
 * separation. They are declared, documented and never tuned - tuning them
 * would just be fitting the policy to the data it is meant to constrain.
 */
/**
 * Fair-share rebalancing, mirrored from the API's post-processing: someone
 * already carrying twice the team's recent share loses this many points.
 */
const FAIR_SHARE_PENALTY = 10;
const FAIR_SHARE_WINDOW_DAYS = 14;

/** Cold-start starvation needs a few people, seen a few times, to mean anything. */
const MIN_COLD_START_PEOPLE = 5;
const MIN_COLD_START_APPEARANCES = 3;

export const BUSINESS_WEIGHTS = {
  separation: 1,
  leave: 0.5,
  load: 0.3,
  coldStart: 0.2
};

type Objective = "outcome" | "ability" | "business";

type Metrics = {
  decisions: number;
  /** Mean Spearman correlation between the ranking and hidden ability. */
  correlation: number;
  /** Share of decisions whose top-ranked candidate is the ablest one. */
  topIsBest: number;
  /** Mean hidden ability of whoever the ranking puts first. */
  topAbility: number;
  /**
   * How well the ranking separates real outcomes: the mean rank it gives the
   * person who actually got the task when that task ended late, minus the same
   * for tasks that ended on time. Ranks are normalised to 0 (ranked first) - 1
   * (ranked last), so a positive number means the ranking would have pushed
   * back exactly the assignments that went badly. Unlike `correlation` this
   * uses nothing the simulator knows, only what really happened.
   */
  outcomeSeparation: number;
  /** Resolved decisions behind `outcomeSeparation`. */
  onTimeCount: number;
  lateCount: number;
  /** Mean share of the task window the top pick already has approved leave on. */
  leaveViolation: number;
  /**
   * How much more lopsided the workload would be than the leads managed:
   * coefficient of variation of hours handed out when always taking rank 1,
   * minus the same figure for the real assignments, floored at 0.
   */
  loadExcessCv: number;
  /** Share of cold-start candidates that never reach the top three. */
  coldStartStarvation: number;
};

type FeedbackDecision = {
  suggestionId: number;
  selectedEmployeeId: number;
  candidates: Array<{
    employeeId: number;
    eligible: boolean;
    skillScore: number;
    workloadScore: number;
    availabilityScore: number | null;
    historyScore: number | null;
  }>;
};

async function main() {
  const args = process.argv.slice(2);
  const from = parseFrom(args);
  const step = parseStep(args);
  const floor = parseFloor(args);
  const objective = parseObjective(args);
  const apply = args.includes("--apply");

  const data = await loadData();
  const evalEnd = data.lastSimulatedDate;
  const decisions = buildDecisions(data, from, evalEnd)
    .slice()
    .sort((left, right) => left.assignedAt.getTime() - right.assignedAt.getTime());

  if (decisions.length < 10) {
    throw new Error(
      `Only ${decisions.length} replayable assignments found - run the simulator for more days first.`
    );
  }

  const splitAt = Math.max(1, Math.floor(decisions.length * FIT_SHARE));
  const fitSet = decisions.slice(0, splitAt);
  const heldOutSet = decisions.slice(splitAt);

  const current = await currentWeights();
  const scored = weightGrid(step)
    .map((weights) => ({ weights, metrics: evaluateWeights(weights, fitSet) }))
    .sort(
      (left, right) =>
        objectiveValue(right.metrics, objective) - objectiveValue(left.metrics, objective)
    );
  const ranked = scored.filter((entry) => respectsFloor(entry.weights, floor));
  if (!ranked.length) {
    throw new Error(`No weight vector keeps every signal at ${floor}; lower --floor.`);
  }
  const best = ranked[0].weights;
  // What the data would have picked with no product rule applied.
  const unconstrained = scored[0];

  const feedback = await loadFeedbackDecisions();
  const verdict = judge(decisions, heldOutSet, current, best, objective);
  const report = buildReport({
    from,
    evalEnd,
    step,
    objective,
    decisions,
    fitSet,
    heldOutSet,
    current,
    best,
    ranked: ranked.slice(0, 5),
    feedback,
    verdict,
    floor,
    unconstrained
  });

  const outDir = path.join(__dirname, "..", "eval_results");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "weights-tuning.md");
  fs.writeFileSync(outFile, report);
  console.info(report);
  console.info(`Saved to ${outFile}`);

  const force = args.includes("--force");
  if (apply && (verdict.trustworthy || force)) {
    await applyWeights(best);
    console.info(
      `\nĐã ghi vào system settings: kỹ năng ${best.skill}, tải việc ${best.workload}, ` +
        `lịch nghỉ ${best.availability}, lịch sử ${best.history}.` +
        "\nAPI cache settings 10 phút, nên thay đổi có hiệu lực chậm nhất sau đó."
    );
  } else if (apply) {
    console.info(`\nKhông ghi gì cả: ${verdict.reason}`);
    console.info("Thêm --force nếu vẫn muốn ghi đè.");
  } else {
    console.info("\nKhông ghi gì cả. Thêm --apply để áp dụng bộ trọng số này.");
  }
}

// ---------------------------------------------------------------------------
// Scoring a weight vector
// ---------------------------------------------------------------------------

/** Mirrors how the API scores a candidate, so the fit measures what ships. */
function scoreWith(weights: ScoreWeights, candidate: Candidate) {
  return combineScores([
    { value: candidate.skillScore, weight: weights.skill },
    { value: candidate.workloadScore, weight: weights.workload },
    { value: candidate.availabilityScore, weight: weights.availability },
    // null for anyone without enough finished tasks, which combineScores
    // then leaves out of the total rather than scoring them zero.
    { value: candidate.historyScore, weight: weights.history }
  ]);
}

/** Same order the API shows: eligible first, then score, then skill. */
function rankWith(
  weights: ScoreWeights,
  candidates: Candidate[],
  penalties?: Map<number, number>
) {
  return candidates
    .map((candidate) => ({
      candidate,
      score: scoreWith(weights, candidate) - (penalties?.get(candidate.employeeId) ?? 0)
    }))
    .sort((left, right) =>
      compareCandidates(
        {
          eligible: left.candidate.eligible,
          leaveBlocked: left.candidate.leaveBlocked,
          score: left.score,
          skillScore: left.candidate.skillScore
        },
        {
          eligible: right.candidate.eligible,
          leaveBlocked: right.candidate.leaveBlocked,
          score: right.score,
          skillScore: right.candidate.skillScore
        }
      )
    );
}

/**
 * Points to shave off candidates who already took more than their share of
 * this team's recent work. Only people above the team average are touched, so
 * the penalty cannot promote someone the ranking did not already rate.
 */
function fairSharePenalties(
  recentPicks: Array<{ at: number; employeeId: number }>,
  decision: Decision
) {
  const cutoff = decision.assignedAt.getTime() - FAIR_SHARE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const counts = new Map<number, number>();
  for (const candidate of decision.candidates) {
    counts.set(candidate.employeeId, 0);
  }
  for (const pick of recentPicks) {
    if (pick.at >= cutoff && counts.has(pick.employeeId)) {
      counts.set(pick.employeeId, (counts.get(pick.employeeId) ?? 0) + 1);
    }
  }

  const average = mean([...counts.values()]);
  const penalties = new Map<number, number>();
  for (const [employeeId, count] of counts) {
    const share = average > 0 ? count / average : 0;
    penalties.set(employeeId, FAIR_SHARE_PENALTY * Math.max(0, share - 1));
  }
  return penalties;
}

export function evaluateWeights(
  weights: ScoreWeights,
  decisions: Decision[],
  rebalance = true
): Metrics {
  const correlations: number[] = [];
  const topIsBest: number[] = [];
  const topAbilities: number[] = [];
  const onTimeRanks: number[] = [];
  const lateRanks: number[] = [];
  const leaveHits: number[] = [];
  // Hours the ranking would have handed each person, against what the leads
  // actually did - the model is only penalised for being more lopsided.
  const modelHours = new Map<number, number>();
  const humanHours = new Map<number, number>();
  const coldStartTopThree = new Map<number, boolean>();
  const coldStartAppearances = new Map<number, number>();
  // Rolling window of what this ranking has already handed out.
  const recentPicks: Array<{ at: number; employeeId: number }> = [];

  for (const decision of decisions) {
    const ranked = rankWith(
      weights,
      decision.candidates,
      rebalance ? fairSharePenalties(recentPicks, decision) : undefined
    );
    const top = ranked[0].candidate;
    const bestAbility = Math.max(...decision.candidates.map((item) => item.ability));
    topAbilities.push(top.ability);
    topIsBest.push(top.ability === bestAbility ? 1 : 0);
    leaveHits.push(top.approvedOverlapRatio);
    recentPicks.push({ at: decision.assignedAt.getTime(), employeeId: top.employeeId });
    modelHours.set(
      top.employeeId,
      (modelHours.get(top.employeeId) ?? 0) + decision.taskEstimatedHours
    );
    humanHours.set(
      decision.assigneeId,
      (humanHours.get(decision.assigneeId) ?? 0) + decision.taskEstimatedHours
    );

    const topThree = new Set(ranked.slice(0, 3).map((item) => item.candidate.employeeId));
    for (const candidate of decision.candidates) {
      if (candidate.historySampleSize >= COLD_START_TASKS) {
        continue;
      }
      coldStartAppearances.set(
        candidate.employeeId,
        (coldStartAppearances.get(candidate.employeeId) ?? 0) + 1
      );
      coldStartTopThree.set(
        candidate.employeeId,
        (coldStartTopThree.get(candidate.employeeId) ?? false) ||
          topThree.has(candidate.employeeId)
      );
    }

    if (decision.candidates.length > 2) {
      correlations.push(
        spearman(
          ranked.map((item) => item.score),
          ranked.map((item) => item.candidate.ability)
        )
      );
    }

    if (decision.outcome.resolved && ranked.length > 1) {
      const position = ranked.findIndex(
        (item) => item.candidate.employeeId === decision.assigneeId
      );
      if (position >= 0) {
        const normalized = position / (ranked.length - 1);
        (decision.outcome.onTime ? onTimeRanks : lateRanks).push(normalized);
      }
    }
  }

  // Only people the ranking had a fair chance to surface count towards
  // starvation; someone who appeared once is noise, not neglect.
  const judged = [...coldStartTopThree.entries()].filter(
    ([employeeId]) =>
      (coldStartAppearances.get(employeeId) ?? 0) >= MIN_COLD_START_APPEARANCES
  );
  const starved = judged.filter(([, seen]) => !seen).length;

  return {
    decisions: decisions.length,
    correlation: mean(correlations),
    topIsBest: mean(topIsBest),
    topAbility: mean(topAbilities),
    outcomeSeparation:
      onTimeRanks.length && lateRanks.length ? mean(lateRanks) - mean(onTimeRanks) : 0,
    onTimeCount: onTimeRanks.length,
    lateCount: lateRanks.length,
    leaveViolation: mean(leaveHits),
    loadExcessCv: Math.max(
      0,
      coefficientOfVariation([...modelHours.values()]) -
        coefficientOfVariation([...humanHours.values()])
    ),
    coldStartStarvation:
      judged.length >= MIN_COLD_START_PEOPLE ? starved / judged.length : 0
  };
}

/** Spread of a workload split, scale-free so team sizes compare. */
function coefficientOfVariation(values: number[]) {
  if (values.length < 2) {
    return 0;
  }
  const average = mean(values);
  if (average <= 0) {
    return 0;
  }
  const variance = mean(values.map((value) => (value - average) ** 2));
  return Math.sqrt(variance) / average;
}

/** The number a weight vector is chosen by, per the requested objective. */
function objectiveValue(metrics: Metrics, objective: Objective) {
  if (objective === "ability") {
    return metrics.correlation;
  }
  if (objective === "outcome") {
    return metrics.outcomeSeparation;
  }
  return scalarise(metrics);
}

/** One number out of the four objectives, using the declared policy weights. */
export function scalarise(metrics: Metrics, weights = BUSINESS_WEIGHTS) {
  return (
    weights.separation * metrics.outcomeSeparation -
    weights.leave * metrics.leaveViolation -
    weights.load * metrics.loadExcessCv -
    weights.coldStart * metrics.coldStartStarvation
  );
}

function parseObjective(args: string[]): Objective {
  const index = args.indexOf("--objective");
  const value = args[index + 1];
  if (value === "ability" || value === "outcome") {
    return value;
  }
  return "business";
}

/** How often a weight vector would have put the manager's own pick first. */
function feedbackAgreement(weights: ScoreWeights, feedback: FeedbackDecision[]) {
  if (!feedback.length) {
    return 0;
  }

  const hits = feedback.map((decision) => {
    const scored = decision.candidates
      .map((candidate) => ({
        employeeId: candidate.employeeId,
        eligible: candidate.eligible,
        skillScore: candidate.skillScore,
        score: combineScores([
          { value: candidate.skillScore, weight: weights.skill },
          { value: candidate.workloadScore, weight: weights.workload },
          { value: candidate.availabilityScore, weight: weights.availability },
          { value: candidate.historyScore, weight: weights.history }
        ])
      }))
      .sort((left, right) => compareCandidates(left, right));
    return scored[0]?.employeeId === decision.selectedEmployeeId ? 1 : 0;
  });

  return mean(hits);
}

// ---------------------------------------------------------------------------
// Search space
// ---------------------------------------------------------------------------

/** Every weight vector on a `step` grid of the 4-signal simplex (sum = 1). */
function weightGrid(step: number) {
  const steps = Math.round(1 / step);
  const grid: ScoreWeights[] = [];

  for (let skill = 1; skill <= steps; skill += 1) {
    // A ranking that ignores skills entirely is not worth reporting: the
    // feature exists to match people to the skills a task requires.
    for (let workload = 0; workload <= steps - skill; workload += 1) {
      for (let availability = 0; availability <= steps - skill - workload; availability += 1) {
        const history = steps - skill - workload - availability;
        grid.push({
          skill: round2(skill * step),
          workload: round2(workload * step),
          availability: round2(availability * step),
          history: round2(history * step)
        });
      }
    }
  }

  return grid;
}

function parseFloor(args: string[]) {
  const index = args.indexOf("--floor");
  const value = index >= 0 ? Number(args[index + 1]) : NaN;
  if (!Number.isFinite(value) || value < 0 || value > 0.25) {
    return DEFAULT_WEIGHT_FLOOR;
  }
  return value;
}

function respectsFloor(weights: ScoreWeights, floor: number) {
  return (
    weights.skill >= floor &&
    weights.workload >= floor &&
    weights.availability >= floor &&
    weights.history >= floor
  );
}

function parseStep(args: string[]) {
  const index = args.indexOf("--step");
  const value = index >= 0 ? Number(args[index + 1]) : NaN;
  if (!Number.isFinite(value) || value <= 0 || value > 0.5) {
    return 0.05;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Data the feature itself produced
// ---------------------------------------------------------------------------

async function loadFeedbackDecisions(): Promise<FeedbackDecision[]> {
  const suggestions = await prisma.aiTaskSuggestion.findMany({
    where: { status: AiTaskSuggestionStatus.SELECTED },
    include: { items: true }
  });

  return suggestions
    .map((suggestion) => {
      const selected = suggestion.items.find((item) => item.selected);
      if (!selected || suggestion.items.length < 2) {
        return null;
      }

      const eligibleById = eligibilityFromSnapshot(suggestion.inputSnapshot);
      return {
        suggestionId: suggestion.id,
        selectedEmployeeId: selected.employeeId,
        candidates: suggestion.items.map((item) => ({
          employeeId: item.employeeId,
          eligible: eligibleById.get(item.employeeId) ?? true,
          skillScore: Number(item.skillScore ?? 0),
          workloadScore: Number(item.workloadScore ?? 0),
          availabilityScore:
            item.availabilityScore === null ? null : Number(item.availabilityScore),
          historyScore: item.historyScore === null ? null : Number(item.historyScore)
        }))
      };
    })
    .filter((decision): decision is FeedbackDecision => decision !== null);
}

/** The eligibility flag lives in the snapshot, not in a column. */
function eligibilityFromSnapshot(snapshot: Prisma.JsonValue | null) {
  const byEmployee = new Map<number, boolean>();
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return byEmployee;
  }
  const items = (snapshot as Record<string, unknown>).items;
  if (!Array.isArray(items)) {
    return byEmployee;
  }
  for (const item of items) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const row = item as Record<string, unknown>;
      if (typeof row.employeeId === "number" && typeof row.eligible === "boolean") {
        byEmployee.set(row.employeeId, row.eligible);
      }
    }
  }
  return byEmployee;
}

async function acceptanceStats() {
  const [generated, selected, cancelled] = await Promise.all([
    prisma.aiTaskSuggestion.count(),
    prisma.aiTaskSuggestion.count({ where: { status: AiTaskSuggestionStatus.SELECTED } }),
    prisma.aiTaskSuggestion.count({ where: { status: AiTaskSuggestionStatus.CANCELLED } })
  ]);
  const picks = await prisma.aiTaskSuggestionItem.findMany({
    where: { selected: true },
    select: { rank: true }
  });

  return {
    generated,
    selected,
    cancelled,
    tookFirst: picks.filter((pick) => pick.rank === 1).length,
    tookTopThree: picks.filter((pick) => pick.rank <= 3).length,
    meanRank: picks.length ? mean(picks.map((pick) => pick.rank)) : 0
  };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

async function currentWeights(): Promise<ScoreWeights> {
  const record = await prisma.systemSetting.findUnique({
    where: { key: SYSTEM_SETTINGS_KEY }
  });
  const value =
    record?.value && typeof record.value === "object" && !Array.isArray(record.value)
      ? (record.value as Record<string, unknown>)
      : {};
  const read = (key: string, fallback: number) =>
    typeof value[key] === "number" ? (value[key] as number) : fallback;

  return {
    skill: read("aiWeightSkill", DEFAULT_SCORE_WEIGHTS.skill),
    workload: read("aiWeightWorkload", DEFAULT_SCORE_WEIGHTS.workload),
    availability: read("aiWeightAvailability", DEFAULT_SCORE_WEIGHTS.availability),
    history: read("aiWeightHistory", DEFAULT_SCORE_WEIGHTS.history)
  };
}

async function applyWeights(weights: ScoreWeights) {
  const record = await prisma.systemSetting.findUnique({
    where: { key: SYSTEM_SETTINGS_KEY }
  });
  const current =
    record?.value && typeof record.value === "object" && !Array.isArray(record.value)
      ? (record.value as Record<string, unknown>)
      : {};
  const next = {
    ...current,
    aiWeightSkill: weights.skill,
    aiWeightWorkload: weights.workload,
    aiWeightAvailability: weights.availability,
    aiWeightHistory: weights.history
  } as unknown as Prisma.InputJsonValue;

  await prisma.systemSetting.upsert({
    where: { key: SYSTEM_SETTINGS_KEY },
    create: { key: SYSTEM_SETTINGS_KEY, value: next },
    update: { value: next }
  });
}

/**
 * Whether the search found something worth believing, or just the best way to
 * fit the noise in a small sample.
 */
function judge(
  decisions: Decision[],
  heldOutSet: Decision[],
  current: ScoreWeights,
  best: ScoreWeights,
  objective: Objective
) {
  if (decisions.length < MIN_DECISIONS) {
    return {
      trustworthy: false,
      reason:
        `chỉ có ${decisions.length} quyết định giao việc tái dựng được, cần tối thiểu ` +
        `${MIN_DECISIONS} để phân biệt tín hiệu với nhiễu.`
    };
  }
  if (heldOutSet.length < MIN_HELD_OUT) {
    return {
      trustworthy: false,
      reason: `tập kiểm chứng chỉ có ${heldOutSet.length} quyết định, cần tối thiểu ${MIN_HELD_OUT}.`
    };
  }

  const bestMetrics = evaluateWeights(best, heldOutSet);
  const currentMetrics = evaluateWeights(current, heldOutSet);
  const unit =
    objective === "outcome"
      ? "điểm phân tách kết quả"
      : objective === "ability"
        ? "tương quan"
        : "điểm tổng hợp";

  if (objective === "outcome" && Math.min(bestMetrics.onTimeCount, bestMetrics.lateCount) < 10) {
    return {
      trustworthy: false,
      reason:
        `tập kiểm chứng chỉ có ${bestMetrics.onTimeCount} task đúng hạn và ` +
        `${bestMetrics.lateCount} task trễ, quá ít để so sánh hai nhóm.`
    };
  }

  const gain =
    objectiveValue(bestMetrics, objective) - objectiveValue(currentMetrics, objective);
  if (gain < MIN_HELD_OUT_GAIN) {
    return {
      trustworthy: false,
      reason:
        `bộ trọng số tìm được chỉ hơn bộ hiện tại ${gain.toFixed(3)} ${unit} trên tập ` +
        `kiểm chứng (ngưỡng ${MIN_HELD_OUT_GAIN}), chưa đủ để kết luận là tốt hơn thật.`
    };
  }

  return {
    trustworthy: true,
    reason: `hơn bộ hiện tại ${gain.toFixed(3)} ${unit} trên ${heldOutSet.length} quyết định giữ lại.`
  };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function buildReport(input: {
  from: Date;
  evalEnd: Date;
  step: number;
  decisions: Decision[];
  fitSet: Decision[];
  heldOutSet: Decision[];
  current: ScoreWeights;
  best: ScoreWeights;
  ranked: Array<{ weights: ScoreWeights; metrics: Metrics }>;
  feedback: FeedbackDecision[];
  verdict: { trustworthy: boolean; reason: string };
  objective: Objective;
  floor: number;
  unconstrained: { weights: ScoreWeights; metrics: Metrics };
}) {
  const lines: string[] = [];
  const label = (weights: ScoreWeights) =>
    `${weights.skill} / ${weights.workload} / ${weights.availability} / ${weights.history}`;

  lines.push(
    "# Tối ưu trọng số xếp hạng gợi ý người nhận việc",
    "",
    `- Khoảng dữ liệu: ${iso(input.from)} → ${iso(input.evalEnd)}`,
    `- Số quyết định giao việc tái dựng được: ${input.decisions.length} ` +
      `(${input.fitSet.length} để dò trọng số, ${input.heldOutSet.length} giữ lại để kiểm chứng)`,
    `- Không gian tìm kiếm: lưới bước ${input.step} trên đơn hình 4 chiều ` +
      `(${weightGrid(input.step).length} bộ trọng số)` +
      (input.floor > 0
        ? `, mỗi tín hiệu giữ sàn tối thiểu ${input.floor}`
        : ", không áp sàn cho tín hiệu nào"),
    `- Hàm mục tiêu dùng để chọn: ${objectiveLabel(input.objective)}`,
    `- Trọng số nghiệp vụ (đặt tay, không tune): phân tách ${BUSINESS_WEIGHTS.separation}` +
      ` · vi phạm nghỉ phép ${BUSINESS_WEIGHTS.leave}` +
      ` · lệch tải ${BUSINESS_WEIGHTS.load} · bỏ rơi người mới ${BUSINESS_WEIGHTS.coldStart}`,
    "",
    "## 1. Trọng số hiện tại so với trọng số học được",
    "",
    "*Điểm tổng hợp* là hàm mục tiêu thật sự dùng để chọn; bốn cột sau là các thành phần " +
      "của nó. Phân tách càng cao càng tốt, ba cột còn lại càng thấp càng tốt. Mọi con số " +
      "đều đo trên thứ hạng SAU khi đã áp cân tải, tức là đúng thứ người dùng nhìn thấy.",
    "",
    "| Bộ trọng số (kỹ năng / tải việc / lịch nghỉ / lịch sử) | Tập | Điểm tổng hợp | Phân tách | Vi phạm nghỉ | Lệch tải | Bỏ rơi người mới |",
    "|---|---|---|---|---|---|---|"
  );

  const rows: Array<[string, string, Decision[]]> = [
    [label(input.current), "dò", input.fitSet],
    [label(input.current), "kiểm chứng", input.heldOutSet],
    [label(input.best), "dò", input.fitSet],
    [label(input.best), "kiểm chứng", input.heldOutSet]
  ];
  for (const [name, set, decisions] of rows) {
    const weights = name === label(input.current) ? input.current : input.best;
    const metrics = evaluateWeights(weights, decisions);
    lines.push(
      `| ${name} | ${set} | **${scalarise(metrics).toFixed(3)}** | ` +
        `${metrics.outcomeSeparation.toFixed(3)} | ${pct(metrics.leaveViolation)} | ` +
        `${metrics.loadExcessCv.toFixed(3)} | ${pct(metrics.coldStartStarvation)} |`
    );
  }

  const currentHeldOut = evaluateWeights(input.current, input.heldOutSet);
  const bestHeldOut = evaluateWeights(input.best, input.heldOutSet);
  const delta =
    objectiveValue(bestHeldOut, input.objective) -
    objectiveValue(currentHeldOut, input.objective);
  lines.push(
    "",
    `Chênh lệch trên tập kiểm chứng: **${delta >= 0 ? "+" : ""}${delta.toFixed(3)}** ` +
      `${objectiveUnit(input.objective)}` +
      ` (dựa trên ${bestHeldOut.onTimeCount} task đúng hạn và ${bestHeldOut.lateCount} task trễ).`,
    "",
    "## 2. Năm bộ trọng số tốt nhất trên tập dò",
    "",
    "| Kỹ năng | Tải việc | Lịch nghỉ | Lịch sử | Điểm tổng hợp | Phân tách | Vi phạm nghỉ |",
    "|---|---|---|---|---|---|---|"
  );
  for (const entry of input.ranked) {
    lines.push(
      `| ${entry.weights.skill} | ${entry.weights.workload} | ${entry.weights.availability} | ` +
        `${entry.weights.history} | ${scalarise(entry.metrics).toFixed(3)} | ` +
        `${entry.metrics.outcomeSeparation.toFixed(3)} | ${pct(entry.metrics.leaveViolation)} |`
    );
  }

  lines.push(
    "",
    "Mặt mục tiêu phẳng quanh đỉnh nghĩa là kết quả không phụ thuộc một điểm may mắn.",
    "",
    "## 3. Bỏ từng tín hiệu (ablation)",
    "",
    "Mỗi dòng là bộ trọng số đang dùng với đúng một tín hiệu bị đặt về 0; phần còn lại " +
      "được chuẩn hoá lại. Cột *Δ* cho biết bỏ tín hiệu đó thì mất bao nhiêu điểm phân tách " +
      "kết quả trên tập kiểm chứng — càng âm thì tín hiệu càng quan trọng.",
    "",
    "| Cấu hình | Điểm tổng hợp | Phân tách | Δ phân tách | Vi phạm nghỉ |",
    "|---|---|---|---|---|"
  );

  const full = evaluateWeights(input.current, input.heldOutSet);
  lines.push(
    `| Đủ bốn tín hiệu (${label(input.current)}) | ${scalarise(full).toFixed(3)} | ` +
      `${full.outcomeSeparation.toFixed(3)} | — | ${pct(full.leaveViolation)} |`
  );

  const signals: Array<[string, keyof ScoreWeights]> = [
    ["Bỏ kỹ năng", "skill"],
    ["Bỏ tải việc", "workload"],
    ["Bỏ lịch nghỉ", "availability"],
    ["Bỏ lịch sử làm việc", "history"]
  ];
  for (const [name, key] of signals) {
    const metrics = evaluateWeights({ ...input.current, [key]: 0 }, input.heldOutSet);
    const delta = metrics.outcomeSeparation - full.outcomeSeparation;
    lines.push(
      `| ${name} | ${scalarise(metrics).toFixed(3)} | ${metrics.outcomeSeparation.toFixed(3)} | ` +
        `${delta >= 0 ? "+" : ""}${delta.toFixed(3)} | ${pct(metrics.leaveViolation)} |`
    );
  }

  // A single-signal row shows what each one is worth on its own, which the
  // drop-one rows cannot: dropping a redundant signal costs nothing even
  // when that signal would rank well by itself.
  lines.push(
    "",
    "Và nếu chỉ dùng duy nhất một tín hiệu:",
    "",
    "| Cấu hình | Phân tách kết quả | Tương quan | Chọn đúng người giỏi nhất |",
    "|---|---|---|---|"
  );
  for (const [name, key] of signals) {
    const only: ScoreWeights = { skill: 0, workload: 0, availability: 0, history: 0 };
    only[key] = 1;
    const metrics = evaluateWeights(only, input.heldOutSet);
    lines.push(
      `| Chỉ ${name.replace("Bỏ ", "")} | ${metrics.outcomeSeparation.toFixed(3)} | ` +
        `${metrics.correlation.toFixed(3)} | ${pct(metrics.topIsBest)} |`
    );
  }

  // Without this note the table reads as "delete the other three signals",
  // which the metric cannot actually support.
  lines.push(
    "",
    "**Cách đọc bảng này.** Phân tách kết quả chỉ biết task có xong đúng hạn hay không, " +
      "nên nó đo được giá trị của tín hiệu lịch sử rất rõ và gần như không đo được ba tín hiệu " +
      "còn lại. Điều đó *không* có nghĩa là nên bỏ chúng:",
    "",
    "- **Kỹ năng** đã phát huy tác dụng ở ràng buộc cứng trước khi chấm điểm: ứng viên thiếu " +
      "kỹ năng bắt buộc bị xếp sau bất kể trọng số. Phần đóng góp còn lại của nó là phân biệt " +
      "giữa những người *đã* đủ điều kiện, nên nhỏ là đúng chứ không phải vô dụng.",
    "- **Lịch nghỉ** chặn một lỗi mà thước đo không nhìn thấy: gợi ý một người nghỉ phép " +
      "nguyên kỳ task vẫn có thể cho ra task đúng hạn trong dữ liệu (người khác gánh), nhưng " +
      "là gợi ý sai trước mặt quản lý.",
    "- **Tải việc** phục vụ mục tiêu dàn đều công việc, vốn không nằm trong hàm mục tiêu này.",
    "",
    "Trước đây bộ dò phải giữ một sàn tối thiểu cho mỗi tín hiệu để dữ liệu không đưa " +
      "trọng số lịch nghỉ về 0. Sàn đó đã bỏ: nghỉ phép nay được bảo vệ ở hai chỗ đúng hơn — " +
      "một số hạng riêng trong hàm mục tiêu (tỉ lệ vi phạm nghỉ phép) và một tầng ràng buộc " +
      "cứng xếp sau người nghỉ quá nửa kỳ task. Trọng số vì vậy được tự do dò theo dữ liệu."
  );

  lines.push("", "## 4. Phản hồi từ quản lý", "");

  if (input.feedback.length < MIN_FEEDBACK_DECISIONS) {
    lines.push(
      `Mới có ${input.feedback.length} lượt quản lý chọn từ gợi ý (cần tối thiểu ` +
        `${MIN_FEEDBACK_DECISIONS} để tỉ lệ đồng thuận có ý nghĩa). Mỗi lần quản lý bấm chọn ` +
        "một ứng viên, hệ thống đã lưu lại điểm thành phần của toàn bộ danh sách, nên chỉ cần " +
        "dùng tính năng đủ nhiều là mục này tự có số liệu và trọng số học được từ chính " +
        "quyết định thật thay vì từ dữ liệu mô phỏng."
    );
  } else {
    lines.push(
      "| Bộ trọng số | Tỉ lệ xếp đúng người quản lý đã chọn lên #1 |",
      "|---|---|",
      `| ${label(input.current)} (hiện tại) | ${pct(feedbackAgreement(input.current, input.feedback))} |`,
      `| ${label(input.best)} (học được) | ${pct(feedbackAgreement(input.best, input.feedback))} |`,
      "",
      `Dựa trên ${input.feedback.length} lượt chọn thật.`
    );
  }

  const free = input.unconstrained;
  if (!respectsFloor(free.weights, input.floor)) {
    lines.push(
      "",
      `Không áp sàn thì điểm tối ưu rơi vào **${label(free.weights)}** ` +
        `(${free.metrics.outcomeSeparation.toFixed(3)} trên tập dò) — bộ này đặt một tín hiệu về 0. ` +
        "Sàn tối thiểu là cách cũ để chặn việc này; cách đang dùng là đưa vi phạm nghỉ phép " +
        "thẳng vào hàm mục tiêu và thêm tầng ràng buộc cứng."
    );
  }

  lines.push("", "## 5. Kết luận", "");
  lines.push(
    input.verdict.trustworthy
      ? `**Nên đổi sang bộ trọng số học được** — ${input.verdict.reason}`
      : `**Giữ nguyên bộ trọng số hiện tại** — ${input.verdict.reason}`
  );

  lines.push("", "## Ghi chú", "");
  lines.push(
    "- Năng lực ẩn là biến do simulator sinh ra, không phải dữ liệu công ty thật; " +
      "nó là thước đo để so sánh các bộ trọng số với nhau, không phải bằng chứng về hiệu quả thực tế.",
    "- Trọng số không cần cộng lại bằng 1: hàm chấm điểm tự chuẩn hoá theo các tín hiệu " +
      "mà ứng viên thực sự có, nên ứng viên thiếu dữ liệu không bị phạt oan.",
    "- Ràng buộc cứng (thiếu kỹ năng bắt buộc) không nằm trong phần tối ưu này: " +
      "ứng viên không đủ điều kiện luôn bị xếp sau, bất kể trọng số.",
    ""
  );

  return lines.join("\n");
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function objectiveUnit(objective: Objective) {
  if (objective === "ability") {
    return "tương quan";
  }
  return objective === "outcome" ? "điểm phân tách" : "điểm tổng hợp";
}

function objectiveLabel(objective: Objective) {
  if (objective === "ability") {
    return "**tương quan với năng lực ẩn** của simulator";
  }
  if (objective === "outcome") {
    return "**chỉ phân tách kết quả thật** (bỏ qua các mục tiêu nghiệp vụ)";
  }
  return (
    "**điểm tổng hợp đa mục tiêu** — phân tách kết quả, trừ vi phạm nghỉ phép, " +
    "lệch tải so với lead thật và tỉ lệ bỏ rơi người mới"
  );
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

if (require.main === module) {
main()
  .then(async () => {
    const stats = await acceptanceStats();
    console.info(
      `\nGợi ý đã tạo: ${stats.generated}, đã chọn: ${stats.selected}, đã huỷ: ${stats.cancelled}` +
        (stats.selected
          ? `, chọn đúng #1: ${stats.tookFirst}/${stats.selected}, trong top 3: ${stats.tookTopThree}/${stats.selected}, hạng trung bình ${stats.meanRank.toFixed(2)}`
          : "")
    );
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
}
