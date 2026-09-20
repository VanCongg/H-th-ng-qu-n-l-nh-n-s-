/**
 * Compares the weighted multi-criteria model the API ships with against two
 * machine-learned baselines, on the same replayed history and the same metrics.
 *
 *   MCDM          - the live model: four hand-shaped signals, weights fitted
 *                   by prisma/tune-weights.ts.
 *   ML pointwise  - logistic regression on "did this assignment finish on
 *                   time", ranking candidates by predicted probability.
 *   ML pairwise   - logistic regression on (chosen minus not chosen) feature
 *                   differences, i.e. learning the lead's own preference.
 *
 * Each ML baseline is fitted twice: once on exactly the four signals the MCDM
 * model sees (a fair head-to-head of the combination rule), and once on a
 * wider feature set the MCDM model cannot use at all (what ML buys you).
 *
 * Decisions are split by date - the earlier part trains, the later part is
 * held out - so nothing is scored on what it was fitted to. Read-only.
 *
 *   npx tsx prisma/ml-baseline.ts [--from 2026-02-02]
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import {
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
import {
  LogisticModel,
  fitPairwise,
  fitPointwise,
  importances,
  score
} from "./ml/logistic-regression";

const SYSTEM_SETTINGS_KEY = "default";
const FIT_SHARE = 0.7;
/** Below this many training rows a fitted model is noise with extra steps. */
const MIN_TRAINING_ROWS = 100;

const BASE_FEATURES = ["skill", "workload", "availability", "history"];
const EXTRA_FEATURES = [
  "historyMissing",
  "doneCount",
  "projectFamiliarity",
  "seniorityYears",
  "careerLevel",
  "taskHours"
];

type Ranker = {
  key: string;
  label: string;
  score: (candidate: Candidate, decision: Decision) => number;
};

type Metrics = {
  /** Mean rank of the actual assignee on late tasks minus on-time ones, 0-1. */
  outcomeSeparation: number;
  onTimeCount: number;
  lateCount: number;
  /** Spearman correlation with the simulator's hidden ability. */
  correlation: number;
  /** Share of decisions whose top-ranked candidate is the ablest one. */
  topIsBest: number;
  /** Share of decisions where the ranking puts the lead's own pick first. */
  managerAgreement: number;
};

async function main() {
  const args = process.argv.slice(2);
  const from = parseFrom(args);

  const data = await loadData();
  const evalEnd = data.lastSimulatedDate;
  const decisions = buildDecisions(data, from, evalEnd)
    .slice()
    .sort((left, right) => left.assignedAt.getTime() - right.assignedAt.getTime());

  if (decisions.length < 50) {
    throw new Error(
      `Only ${decisions.length} replayable assignments found - simulate more history first.`
    );
  }

  const splitAt = Math.max(1, Math.floor(decisions.length * FIT_SHARE));
  const fitSet = decisions.slice(0, splitAt);
  const heldOutSet = decisions.slice(splitAt);

  const weights = await currentWeights();
  const models = {
    pointwiseBase: fitOutcomeModel(fitSet, false),
    pointwiseWide: fitOutcomeModel(fitSet, true),
    pairwiseBase: fitPreferenceModel(fitSet, false),
    pairwiseWide: fitPreferenceModel(fitSet, true)
  };

  const rankers: Ranker[] = [
    {
      key: "mcdm",
      label:
        `MCDM (đang chạy, trọng số ${weights.skill}/${weights.workload}/` +
        `${weights.availability}/${weights.history})`,
      score: (candidate) =>
        combineScores([
          { value: candidate.skillScore, weight: weights.skill },
          { value: candidate.workloadScore, weight: weights.workload },
          { value: candidate.availabilityScore, weight: weights.availability },
          { value: candidate.historyScore, weight: weights.history }
        ])
    },
    {
      key: "pointwise-base",
      label: "ML pointwise — 4 đặc trưng (dự đoán đúng hạn)",
      score: (candidate, decision) =>
        100 * score(models.pointwiseBase, features(candidate, decision, false))
    },
    {
      key: "pointwise-wide",
      label: "ML pointwise — 10 đặc trưng (dự đoán đúng hạn)",
      score: (candidate, decision) =>
        100 * score(models.pointwiseWide, features(candidate, decision, true))
    },
    {
      key: "pairwise-base",
      label: "ML pairwise — 4 đặc trưng (học lựa chọn của lead)",
      score: (candidate, decision) =>
        100 * score(models.pairwiseBase, features(candidate, decision, false))
    },
    {
      key: "pairwise-wide",
      label: "ML pairwise — 10 đặc trưng (học lựa chọn của lead)",
      score: (candidate, decision) =>
        100 * score(models.pairwiseWide, features(candidate, decision, true))
    }
  ];

  const report = buildReport({
    from,
    evalEnd,
    decisions,
    fitSet,
    heldOutSet,
    rankers,
    models
  });

  const outDir = path.join(__dirname, "..", "eval_results");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "ml-baseline.md");
  fs.writeFileSync(outFile, report);
  console.info(report);
  console.info(`Saved to ${outFile}`);
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

/**
 * The four shipped signals first, so the "base" model sees exactly what the
 * MCDM model sees and the comparison isolates the combination rule.
 */
function features(candidate: Candidate, decision: Decision, wide: boolean) {
  const base = [
    candidate.skillScore,
    candidate.workloadScore,
    candidate.availabilityScore,
    // Imputed at the midpoint, exactly as the shipped model leaves a missing
    // track record out of its weighted average.
    candidate.historyScore ?? 50
  ];
  if (!wide) {
    return base;
  }
  return [
    ...base,
    candidate.historyScore === null ? 1 : 0,
    Math.log1p(candidate.doneCount),
    Math.log1p(candidate.projectFamiliarity),
    candidate.seniorityYears,
    candidate.careerLevelIndex,
    Math.log1p(decision.taskEstimatedHours)
  ];
}

function featureNames(wide: boolean) {
  return wide ? [...BASE_FEATURES, ...EXTRA_FEATURES] : BASE_FEATURES;
}

// ---------------------------------------------------------------------------
// Fitting
// ---------------------------------------------------------------------------

/** One row per finished assignment: the person who got it, and how it went. */
function fitOutcomeModel(decisions: Decision[], wide: boolean): LogisticModel {
  const rows: number[][] = [];
  const labels: number[] = [];

  for (const decision of decisions) {
    if (!decision.outcome.resolved) {
      continue;
    }
    const assignee = decision.candidates.find(
      (candidate) => candidate.employeeId === decision.assigneeId
    );
    if (!assignee) {
      continue;
    }
    rows.push(features(assignee, decision, wide));
    labels.push(decision.outcome.onTime ? 1 : 0);
  }

  if (rows.length < MIN_TRAINING_ROWS) {
    throw new Error(
      `Only ${rows.length} finished assignments to learn from; need ${MIN_TRAINING_ROWS}.`
    );
  }
  return fitPointwise({ features: rows, labels }, { iterations: 600 });
}

/**
 * Both orderings of every (chosen, not chosen) pair, so the model cannot learn
 * a bias towards whichever side of the subtraction it was shown.
 */
function fitPreferenceModel(decisions: Decision[], wide: boolean): LogisticModel {
  const rows: number[][] = [];
  const labels: number[] = [];

  for (const decision of decisions) {
    const assignee = decision.candidates.find(
      (candidate) => candidate.employeeId === decision.assigneeId
    );
    if (!assignee) {
      continue;
    }
    const chosen = features(assignee, decision, wide);
    for (const other of decision.candidates) {
      if (other.employeeId === decision.assigneeId) {
        continue;
      }
      const rejected = features(other, decision, wide);
      rows.push(chosen.map((value, index) => value - rejected[index]));
      labels.push(1);
      rows.push(rejected.map((value, index) => value - chosen[index]));
      labels.push(0);
    }
  }

  if (rows.length < MIN_TRAINING_ROWS) {
    throw new Error(`Only ${rows.length} candidate pairs to learn from.`);
  }
  return fitPairwise({ features: rows, labels }, { iterations: 600 });
}

// ---------------------------------------------------------------------------
// Scoring a ranker
// ---------------------------------------------------------------------------

/**
 * Every ranker is ordered the way the API orders candidates - ineligible last,
 * then by score - so the comparison is between scoring rules, not between one
 * rule that respects the hard constraint and one that ignores it.
 */
function rank(ranker: Ranker, decision: Decision) {
  return decision.candidates
    .map((candidate) => ({ candidate, value: ranker.score(candidate, decision) }))
    .sort((left, right) =>
      compareCandidates(
        {
          eligible: left.candidate.eligible,
          leaveBlocked: left.candidate.leaveBlocked,
          score: left.value,
          skillScore: left.candidate.skillScore
        },
        {
          eligible: right.candidate.eligible,
          leaveBlocked: right.candidate.leaveBlocked,
          score: right.value,
          skillScore: right.candidate.skillScore
        }
      )
    );
}

function evaluateRanker(ranker: Ranker, decisions: Decision[]): Metrics {
  const correlations: number[] = [];
  const topIsBest: number[] = [];
  const agreement: number[] = [];
  const onTimeRanks: number[] = [];
  const lateRanks: number[] = [];

  for (const decision of decisions) {
    const ranked = rank(ranker, decision);
    const bestAbility = Math.max(...decision.candidates.map((item) => item.ability));
    topIsBest.push(ranked[0].candidate.ability === bestAbility ? 1 : 0);
    agreement.push(ranked[0].candidate.employeeId === decision.assigneeId ? 1 : 0);

    if (decision.candidates.length > 2) {
      correlations.push(
        spearman(
          ranked.map((item) => item.value),
          ranked.map((item) => item.candidate.ability)
        )
      );
    }

    if (decision.outcome.resolved && ranked.length > 1) {
      const position = ranked.findIndex(
        (item) => item.candidate.employeeId === decision.assigneeId
      );
      if (position >= 0) {
        const normalised = position / (ranked.length - 1);
        (decision.outcome.onTime ? onTimeRanks : lateRanks).push(normalised);
      }
    }
  }

  return {
    outcomeSeparation:
      onTimeRanks.length && lateRanks.length ? mean(lateRanks) - mean(onTimeRanks) : 0,
    onTimeCount: onTimeRanks.length,
    lateCount: lateRanks.length,
    correlation: mean(correlations),
    topIsBest: mean(topIsBest),
    managerAgreement: mean(agreement)
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

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function buildReport(input: {
  from: Date;
  evalEnd: Date;
  decisions: Decision[];
  fitSet: Decision[];
  heldOutSet: Decision[];
  rankers: Ranker[];
  models: Record<string, LogisticModel>;
}) {
  const lines: string[] = [];
  const resolvedFit = input.fitSet.filter((decision) => decision.outcome.resolved).length;

  lines.push(
    "# So sánh mô hình đa tiêu chí với baseline học máy",
    "",
    `- Khoảng dữ liệu: ${iso(input.from)} → ${iso(input.evalEnd)}`,
    `- Quyết định giao việc tái dựng được: ${input.decisions.length} ` +
      `(${input.fitSet.length} huấn luyện, ${input.heldOutSet.length} kiểm chứng, chia theo thời gian)`,
    `- Trong tập huấn luyện có ${resolvedFit} task đã kết thúc (nhãn cho mô hình pointwise)`,
    "- Cả ba mô hình đều bị ràng buộc cứng như nhau: ứng viên thiếu kỹ năng bắt buộc luôn xếp sau.",
    "",
    "## 1. Kết quả trên tập kiểm chứng",
    "",
    "| Mô hình | Phân tách kết quả | Tương quan năng lực | Chọn đúng người giỏi nhất | Trùng lựa chọn của lead |",
    "|---|---|---|---|---|"
  );

  const heldOut = input.rankers.map((ranker) => ({
    ranker,
    metrics: evaluateRanker(ranker, input.heldOutSet)
  }));
  for (const row of heldOut) {
    lines.push(
      `| ${row.ranker.label} | ${row.metrics.outcomeSeparation.toFixed(3)} | ` +
        `${row.metrics.correlation.toFixed(3)} | ${pct(row.metrics.topIsBest)} | ` +
        `${pct(row.metrics.managerAgreement)} |`
    );
  }

  const baseline = heldOut[0];
  const best = heldOut
    .slice(1)
    .reduce((left, right) =>
      right.metrics.outcomeSeparation > left.metrics.outcomeSeparation ? right : left
    );
  const gap = best.metrics.outcomeSeparation - baseline.metrics.outcomeSeparation;

  lines.push(
    "",
    `Baseline ML tốt nhất là **${best.ranker.label}**, ` +
      `${gap >= 0 ? "hơn" : "kém"} mô hình đang chạy ${Math.abs(gap).toFixed(3)} ` +
      `điểm phân tách kết quả (dựa trên ${baseline.metrics.onTimeCount} task đúng hạn ` +
      `và ${baseline.metrics.lateCount} task trễ).`,
    "",
    "## 2. Cùng chỉ số nhưng trên tập huấn luyện",
    "",
    "Chênh lệch giữa hai bảng cho thấy mô hình có học thuộc dữ liệu hay không.",
    "",
    "| Mô hình | Phân tách kết quả | Tương quan năng lực | Trùng lựa chọn của lead |",
    "|---|---|---|---|"
  );
  for (const ranker of input.rankers) {
    const metrics = evaluateRanker(ranker, input.fitSet);
    lines.push(
      `| ${ranker.label} | ${metrics.outcomeSeparation.toFixed(3)} | ` +
        `${metrics.correlation.toFixed(3)} | ${pct(metrics.managerAgreement)} |`
    );
  }

  lines.push("", "## 3. Trọng số mà mô hình học được", "");
  for (const [key, model] of Object.entries(input.models)) {
    const wide = key.endsWith("Wide");
    lines.push(
      `**${key}** (log loss huấn luyện ${model.trainingLoss.toFixed(4)}):`,
      "",
      "| Đặc trưng | Hệ số (thang chuẩn hoá) |",
      "|---|---|"
    );
    for (const item of importances(model, featureNames(wide))) {
      lines.push(`| ${item.name} | ${item.weight.toFixed(3)} |`);
    }
    lines.push("");
  }

  lines.push(
    "## Ghi chú",
    "",
    "- **Phân tách kết quả**: hạng trung bình mà mô hình dành cho người thực sự được giao, " +
      "ở nhóm task trễ trừ nhóm task đúng hạn (thang 0-1). Dương nghĩa là mô hình đã xếp thấp " +
      "đúng những lần giao việc về sau hỏng. Đây là chỉ số dùng dữ liệu thật, không dùng biến nội bộ.",
    "- **Sai lệch chọn mẫu**: mô hình pointwise chỉ học được từ người đã được chọn, vì chỉ họ mới " +
      "có kết quả. Đây là hạn chế cố hữu của dữ liệu quan sát, không phải lỗi cài đặt.",
    "- **Trùng lựa chọn của lead** đo mức bắt chước người giao việc, không phải mức đúng: " +
      "một mô hình trùng 100% cũng chỉ giỏi bằng chính các lead.",
    "- Toàn bộ dữ liệu là mô phỏng, và năng lực ẩn là biến do bộ mô phỏng sinh ra.",
    ""
  );

  return lines.join("\n");
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
