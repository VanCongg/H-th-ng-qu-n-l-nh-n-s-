/**
 * Asks whether the *measurement* is sound, which is a different question from
 * "which weights are best" (prisma/tune-weights.ts) or "is a learned model
 * better" (prisma/ml-baseline.ts).
 *
 * Every number the other two scripts produce rests on simulated data where the
 * outcome of a task is generated from a hidden `ability`, while the track-record
 * signal is computed from those same outcomes. Left unexamined, the ranking can
 * score well simply by reconstructing a variable the simulator made up. Three
 * checks make that visible:
 *
 *   1. Leakage      - how strongly the observed signal tracks hidden ability,
 *                     with and without the lag that production applies.
 *   2. Negative control - shuffle the track record between candidates. A ranking
 *                     that still scores well is measuring something other than
 *                     candidate quality, and the number is worthless.
 *   3. Cold start   - what happens to people the signal knows nothing about.
 *
 * Read-only.
 *
 *   npx tsx prisma/diagnostics.ts [--from 2026-02-02]
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
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
/** Fixed so two runs on the same database produce the same shuffle. */
const SHUFFLE_SEED = 20260921;

type Ranked = Array<{ candidate: Candidate; value: number }>;

async function main() {
  const from = parseFrom(process.argv.slice(2));
  const data = await loadData();
  const decisions = buildDecisions(data, from, data.lastSimulatedDate);

  if (decisions.length < 50) {
    throw new Error(`Only ${decisions.length} replayable assignments - simulate more history.`);
  }

  const weights = await currentWeights();
  const report = buildReport(decisions, weights, from, data.lastSimulatedDate);

  const outDir = path.join(__dirname, "..", "eval_results");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "diagnostics.md");
  fs.writeFileSync(outFile, report);
  console.info(report);
  console.info(`Saved to ${outFile}`);
}

// ---------------------------------------------------------------------------
// Ranking, shared with the other scripts' definition
// ---------------------------------------------------------------------------

function scoreWith(weights: ScoreWeights, candidate: Candidate) {
  return combineScores([
    { value: candidate.skillScore, weight: weights.skill },
    { value: candidate.workloadScore, weight: weights.workload },
    { value: candidate.availabilityScore, weight: weights.availability },
    { value: candidate.historyScore, weight: weights.history }
  ]);
}

function rank(weights: ScoreWeights, candidates: Candidate[]): Ranked {
  return candidates
    .map((candidate) => ({ candidate, value: scoreWith(weights, candidate) }))
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

/** Same definition the tuner optimises: late ranks minus on-time ranks. */
function outcomeSeparation(weights: ScoreWeights, decisions: Decision[]) {
  const onTime: number[] = [];
  const late: number[] = [];

  for (const decision of decisions) {
    if (!decision.outcome.resolved || decision.candidates.length < 2) {
      continue;
    }
    const ranked = rank(weights, decision.candidates);
    const position = ranked.findIndex(
      (item) => item.candidate.employeeId === decision.assigneeId
    );
    if (position < 0) {
      continue;
    }
    const normalised = position / (ranked.length - 1);
    (decision.outcome.onTime ? onTime : late).push(normalised);
  }

  return onTime.length && late.length ? mean(late) - mean(onTime) : 0;
}

// ---------------------------------------------------------------------------
// 1. Leakage
// ---------------------------------------------------------------------------

/**
 * Rank correlation between a track-record signal and the hidden ability that
 * generated the outcomes it is computed from. 1.0 would mean the signal is
 * simply ability under another name.
 */
function leakage(decisions: Decision[], pick: (candidate: Candidate) => number | null) {
  const signal: number[] = [];
  const ability: number[] = [];

  for (const decision of decisions) {
    for (const candidate of decision.candidates) {
      const value = pick(candidate);
      if (value !== null) {
        signal.push(value);
        ability.push(candidate.ability);
      }
    }
  }

  return { correlation: spearman(signal, ability), rows: signal.length };
}

// ---------------------------------------------------------------------------
// 2. Negative control
// ---------------------------------------------------------------------------

/** Deterministic PRNG so the control is reproducible run to run. */
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The track records of a decision's candidates, dealt out to the wrong people.
 * Everything else stays untouched, so any score the ranking still earns comes
 * from the other three signals - which is exactly the baseline it should fall
 * back to.
 */
function shuffleHistory(decisions: Decision[], seed: number): Decision[] {
  const random = createRandom(seed);

  return decisions.map((decision) => {
    const scores = decision.candidates.map((candidate) => candidate.historyScore);
    for (let index = scores.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [scores[index], scores[swap]] = [scores[swap], scores[index]];
    }
    return {
      ...decision,
      candidates: decision.candidates.map((candidate, index) => ({
        ...candidate,
        historyScore: scores[index]
      }))
    };
  });
}

// ---------------------------------------------------------------------------
// 3. Cold start
// ---------------------------------------------------------------------------

type ColdStartStats = {
  candidateRows: number;
  coldRows: number;
  topOneShare: number;
  topThreeShare: number;
  /** Cold-start people who never reached the top three in the whole period. */
  starvedShare: number;
  separation: number;
};

function coldStartStats(weights: ScoreWeights, decisions: Decision[]): ColdStartStats {
  let candidateRows = 0;
  let coldRows = 0;
  let coldTopOne = 0;
  let coldTopThree = 0;
  const seenInTopThree = new Map<number, boolean>();
  const coldDecisions: Decision[] = [];

  for (const decision of decisions) {
    const ranked = rank(weights, decision.candidates);
    const topThree = new Set(
      ranked.slice(0, 3).map((item) => item.candidate.employeeId)
    );

    for (const candidate of decision.candidates) {
      candidateRows += 1;
      if (candidate.historySampleSize >= COLD_START_TASKS) {
        continue;
      }
      coldRows += 1;
      const inTopThree = topThree.has(candidate.employeeId);
      if (ranked[0].candidate.employeeId === candidate.employeeId) {
        coldTopOne += 1;
      }
      if (inTopThree) {
        coldTopThree += 1;
      }
      seenInTopThree.set(
        candidate.employeeId,
        (seenInTopThree.get(candidate.employeeId) ?? false) || inTopThree
      );
    }

    const assignee = decision.candidates.find(
      (candidate) => candidate.employeeId === decision.assigneeId
    );
    if (assignee && assignee.historySampleSize < COLD_START_TASKS) {
      coldDecisions.push(decision);
    }
  }

  const starved = [...seenInTopThree.values()].filter((seen) => !seen).length;

  return {
    candidateRows,
    coldRows,
    topOneShare: coldRows ? coldTopOne / coldRows : 0,
    topThreeShare: coldRows ? coldTopThree / coldRows : 0,
    starvedShare: seenInTopThree.size ? starved / seenInTopThree.size : 0,
    separation: outcomeSeparation(weights, coldDecisions)
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

function buildReport(
  decisions: Decision[],
  weights: ScoreWeights,
  from: Date,
  to: Date
) {
  const lines: string[] = [];
  const label = `${weights.skill} / ${weights.workload} / ${weights.availability} / ${weights.history}`;

  const observed = leakage(decisions, (candidate) => candidate.historyScore);
  const clean = leakage(decisions, (candidate) => candidate.historyClean);

  const baseline = outcomeSeparation(weights, decisions);
  const shuffled = outcomeSeparation(weights, shuffleHistory(decisions, SHUFFLE_SEED));
  const withoutHistory = outcomeSeparation({ ...weights, history: 0 }, decisions);
  const cold = coldStartStats(weights, decisions);

  lines.push(
    "# Chẩn đoán sức khoẻ của phép đo",
    "",
    `- Khoảng dữ liệu: ${iso(from)} → ${iso(to)}`,
    `- Số quyết định: ${decisions.length}`,
    `- Bộ trọng số đang chạy: ${label}`,
    "",
    "Ba câu hỏi ở đây không phải \"mô hình tốt đến đâu\" mà là \"con số đo được có đáng tin không\".",
    "",
    "## 1. Rò rỉ: tín hiệu lịch sử gần với năng lực ẩn đến mức nào",
    "",
    "Trong bộ mô phỏng, kết quả task được sinh ra từ năng lực ẩn của nhân viên, còn " +
      "tín hiệu lịch sử lại tính từ chính các kết quả đó. Tương quan càng gần 1 thì " +
      "tín hiệu càng chỉ là năng lực ẩn gọi bằng tên khác — và điểm số của mô hình " +
      "càng ít nói lên điều gì về dữ liệu thật.",
    "",
    "| Phiên bản tín hiệu | Tương quan hạng với năng lực ẩn | Số dòng |",
    "|---|---|---|",
    `| Bản sạch (không trễ pha, không co rút) | ${clean.correlation.toFixed(3)} | ${clean.rows} |`,
    `| **Bản mô hình thực sự thấy** (trễ pha + co rút) | **${observed.correlation.toFixed(3)}** | ${observed.rows} |`,
    "",
    `Chênh lệch ${(clean.correlation - observed.correlation).toFixed(3)} là phần rò rỉ mà ` +
      "trễ pha và co rút về prior đã cắt được.",
    "",
    "## 2. Kiểm soát âm: xáo tín hiệu lịch sử",
    "",
    "Tráo điểm lịch sử giữa các ứng viên trong cùng một quyết định, giữ nguyên mọi thứ " +
      "khác. Nếu mô hình vẫn đạt điểm cao thì nó đang đo một thứ khác chứ không phải " +
      "chất lượng ứng viên, và toàn bộ con số phía trên là vô nghĩa.",
    "",
    "| Cấu hình | Phân tách kết quả |",
    "|---|---|",
    `| Mô hình đang chạy | **${baseline.toFixed(3)}** |`,
    `| Xáo tín hiệu lịch sử | ${shuffled.toFixed(3)} |`,
    `| Bỏ hẳn tín hiệu lịch sử (trọng số 0) | ${withoutHistory.toFixed(3)} |`,
    "",
    verdictForControl(baseline, shuffled, withoutHistory),
    "",
    "## 3. Nhóm chưa đủ dữ liệu (cold-start)",
    "",
    `Người có dưới ${COLD_START_TASKS} task đã hoàn thành (tính theo cửa sổ đã trễ pha).`,
    "",
    "| Chỉ số | Giá trị |",
    "|---|---|",
    `| Tỉ lệ dòng ứng viên thuộc nhóm cold-start | ${pct(cold.coldRows / Math.max(1, cold.candidateRows))} (${cold.coldRows}/${cold.candidateRows}) |`,
    `| Được xếp hạng 1 | ${pct(cold.topOneShare)} |`,
    `| Lọt top 3 | ${pct(cold.topThreeShare)} |`,
    `| **Chưa bao giờ lọt top 3 trong cả kỳ** | **${pct(cold.starvedShare)}** |`,
    `| Phân tách kết quả trên riêng các quyết định giao cho người cold-start | ${cold.separation.toFixed(3)} |`,
    "",
    "Chỉ số cuối cần đọc cùng cỡ mẫu: nhóm này ít quyết định nên dao động mạnh.",
    "",
    "## Ghi chú",
    "",
    "- Cả ba phép kiểm tra đều chạy trên bộ trọng số **đang chạy thật**, không phải bộ tối ưu lý thuyết.",
    "- Bản lịch sử \"sạch\" chỉ tồn tại trong script này; không mô hình nào được thấy nó.",
    ""
  );

  return lines.join("\n");
}

function verdictForControl(baseline: number, shuffled: number, withoutHistory: number) {
  if (shuffled >= baseline - 0.02) {
    return (
      "**Không đạt.** Xáo tín hiệu gần như không làm giảm điểm — thước đo đang phản ánh " +
      "thứ gì đó ngoài chất lượng xếp hạng. Không nên báo cáo con số phân tách cho tới khi tìm ra nguyên nhân."
    );
  }

  // Corrupting a heavily weighted signal is expected to hurt *more* than
  // ignoring it: the ranking is then actively steered by noise.
  if (shuffled <= withoutHistory + 0.03) {
    const worse = withoutHistory - shuffled;
    return (
      "**Đạt.** Xáo tín hiệu kéo điểm xuống tới mức của mô hình không dùng lịch sử" +
      (worse > 0.02
        ? ` và còn thấp hơn ${worse.toFixed(3)} — đúng như kỳ vọng, vì gán sai lịch sử cho ` +
          "người khác thì tệ hơn là không biết gì về lịch sử"
        : "") +
      ". Phần điểm tăng thêm thực sự đến từ việc gán đúng lịch sử cho đúng người."
    );
  }

  return (
    "**Cần xem thêm.** Điểm có giảm khi xáo tín hiệu nhưng vẫn cao hơn mức không dùng " +
    "lịch sử; có thể còn một đường rò rỉ khác giữa các tín hiệu."
  );
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
