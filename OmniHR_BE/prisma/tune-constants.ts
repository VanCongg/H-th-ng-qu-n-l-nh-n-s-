/**
 * Fits the constants the weight tuner leaves alone: the mix inside the
 * track-record score, how far back it looks, how strongly a thin record is
 * pulled towards its peers, and the team's weekly capacity.
 *
 * Why a separate script and a random search rather than one big grid: the
 * weights live on a simplex where a grid is cheap and exhaustive, while these
 * are independent knobs whose full grid is thousands of combinations for very
 * little extra resolution. A few hundred random draws plus one coordinate pass
 * lands in the same place and finishes in a minute.
 *
 * Three slices by date, not two:
 *
 *   fit        - the replay the candidates are scored on
 *   validation - picks the winner among them
 *   test       - read once, for the number that gets reported
 *
 * Tuning ten knobs and then reporting on the same slice that chose them is the
 * easiest way to publish a result that will not survive contact with new data.
 *
 * Read-only.
 *
 *   npx tsx prisma/tune-constants.ts [--from 2026-02-02] [--draws 300]
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import {
  DEFAULT_HISTORY_TUNING,
  DEFAULT_SCORE_WEIGHTS,
  ScoreWeights
} from "../src/ai-task-suggestions/suggestion-scoring";
import { BUSINESS_WEIGHTS, evaluateWeights, scalarise } from "./tune-weights";
import {
  ReplayTuning,
  buildDecisions,
  loadData,
  mean,
  parseFrom,
  prisma
} from "./evaluate-suggestions";

const SYSTEM_SETTINGS_KEY = "default";
const FIT_SHARE = 0.55;
const VALIDATION_SHARE = 0.2;
/** Anything smaller and the winner is whichever draw got the friendlier slice. */
const MIN_DECISIONS_PER_SLICE = 100;

type Candidate = ReplayTuning;

const SEARCH_SPACE = {
  onTimeShare: [0.4, 0.5, 0.6, 0.7, 0.8],
  lagDays: [0, 15, 30, 45, 60, 90],
  priorStrength: [1, 2, 3, 4, 6, 8],
  capacityHours: [32, 40, 48]
};

async function main() {
  const args = process.argv.slice(2);
  const from = parseFrom(args);
  const draws = parseDraws(args);

  const data = await loadData();
  const evalEnd = data.lastSimulatedDate;
  const weights = await currentWeights();

  // Every draw changes how the replay is built, so the slice boundaries are
  // fixed by date up front rather than by index into a list that moves.
  const probe = buildDecisions(data, from, evalEnd);
  if (probe.length < MIN_DECISIONS_PER_SLICE * 3) {
    throw new Error(
      `Only ${probe.length} decisions; need ${MIN_DECISIONS_PER_SLICE * 3} for three slices.`
    );
  }
  const bounds = sliceBounds(probe.map((decision) => decision.assignedAt));

  const random = createRandom(20260921);
  const draw = (): Candidate => ({
    history: {
      onTimeShare: pick(SEARCH_SPACE.onTimeShare, random),
      lagDays: pick(SEARCH_SPACE.lagDays, random),
      priorStrength: pick(SEARCH_SPACE.priorStrength, random)
    },
    capacityHours: pick(SEARCH_SPACE.capacityHours, random)
  });

  const baseline: Candidate = {
    history: DEFAULT_HISTORY_TUNING,
    capacityHours: 40
  };

  const seen = new Set<string>();
  const tried: Array<{ candidate: Candidate; fit: number; validation: number }> = [];
  const score = (candidate: Candidate) => {
    const key = JSON.stringify(candidate);
    if (seen.has(key)) {
      return null;
    }
    seen.add(key);
    const decisions = buildDecisions(data, from, evalEnd, candidate);
    const slices = sliceByDate(decisions, bounds);
    const entry = {
      candidate,
      fit: scalarise(evaluateWeights(weights, slices.fit)),
      validation: scalarise(evaluateWeights(weights, slices.validation))
    };
    tried.push(entry);
    return entry;
  };

  score(baseline);
  for (let index = 0; index < draws; index += 1) {
    score(draw());
  }

  // One coordinate pass around the leader: random search gets close, walking
  // each knob from there picks up the last bit without another 300 replays.
  let leader = best(tried).candidate;
  for (const knob of ["onTimeShare", "lagDays", "priorStrength", "capacityHours"] as const) {
    for (const value of SEARCH_SPACE[knob]) {
      score(withKnob(leader, knob, value));
    }
    leader = best(tried).candidate;
  }

  const winner = best(tried);
  const report = buildReport({
    from,
    evalEnd,
    draws,
    tried,
    winner,
    baseline,
    weights,
    data,
    bounds
  });

  const outDir = path.join(__dirname, "..", "eval_results");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "constants-tuning.md");
  fs.writeFileSync(outFile, report);
  console.info(report);
  console.info(`Saved to ${outFile}`);
}

// ---------------------------------------------------------------------------
// Slices
// ---------------------------------------------------------------------------

function sliceBounds(dates: Date[]) {
  const sorted = dates.slice().sort((left, right) => left.getTime() - right.getTime());
  return {
    fitEnd: sorted[Math.floor(sorted.length * FIT_SHARE)],
    validationEnd: sorted[Math.floor(sorted.length * (FIT_SHARE + VALIDATION_SHARE))]
  };
}

function sliceByDate(
  decisions: ReturnType<typeof buildDecisions>,
  bounds: { fitEnd: Date; validationEnd: Date }
) {
  return {
    fit: decisions.filter((decision) => decision.assignedAt <= bounds.fitEnd),
    validation: decisions.filter(
      (decision) =>
        decision.assignedAt > bounds.fitEnd && decision.assignedAt <= bounds.validationEnd
    ),
    test: decisions.filter((decision) => decision.assignedAt > bounds.validationEnd)
  };
}

// ---------------------------------------------------------------------------
// Search helpers
// ---------------------------------------------------------------------------

function pick<T>(values: T[], random: () => number) {
  return values[Math.floor(random() * values.length)];
}

function withKnob(candidate: Candidate, knob: string, value: number): Candidate {
  if (knob === "capacityHours") {
    return { ...candidate, capacityHours: value };
  }
  return { ...candidate, history: { ...candidate.history, [knob]: value } };
}

function best(tried: Array<{ candidate: Candidate; fit: number; validation: number }>) {
  return tried.reduce((left, right) => (right.validation > left.validation ? right : left));
}

/** Deterministic, so the same database always produces the same search. */
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

function parseDraws(args: string[]) {
  const index = args.indexOf("--draws");
  const value = index >= 0 ? Number(args[index + 1]) : NaN;
  return Number.isInteger(value) && value > 0 && value <= 2000 ? value : 300;
}

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
  draws: number;
  tried: Array<{ candidate: Candidate; fit: number; validation: number }>;
  winner: { candidate: Candidate; fit: number; validation: number };
  baseline: Candidate;
  weights: ScoreWeights;
  data: Awaited<ReturnType<typeof loadData>>;
  bounds: { fitEnd: Date; validationEnd: Date };
}) {
  const lines: string[] = [];
  const label = (candidate: Candidate) =>
    `đúng hạn ${candidate.history.onTimeShare} · trễ pha ${candidate.history.lagDays}n · ` +
    `prior ${candidate.history.priorStrength} · sức chứa ${candidate.capacityHours}h`;

  const onTest = (candidate: Candidate) => {
    const decisions = buildDecisions(input.data, input.from, input.evalEnd, candidate);
    const slices = sliceByDate(decisions, input.bounds);
    return {
      metrics: evaluateWeights(input.weights, slices.test),
      count: slices.test.length
    };
  };

  const baselineTest = onTest(input.baseline);
  const winnerTest = onTest(input.winner.candidate);
  const gain = scalarise(winnerTest.metrics) - scalarise(baselineTest.metrics);

  lines.push(
    "# Dò các hằng số còn lại",
    "",
    `- Khoảng dữ liệu: ${iso(input.from)} → ${iso(input.evalEnd)}`,
    `- Chia ba lát theo thời gian: dò đến ${iso(input.bounds.fitEnd)}, ` +
      `chọn đến ${iso(input.bounds.validationEnd)}, phần còn lại chỉ đọc một lần để báo cáo`,
    `- Số cấu hình đã thử: ${input.tried.length} (${input.draws} lượt ngẫu nhiên + một vòng dò từng chiều)`,
    `- Trọng số bốn tín hiệu giữ cố định ở mức đang chạy: ${input.weights.skill} / ` +
      `${input.weights.workload} / ${input.weights.availability} / ${input.weights.history}`,
    `- Hàm mục tiêu: điểm tổng hợp (phân tách ${BUSINESS_WEIGHTS.separation} · nghỉ phép ` +
      `${BUSINESS_WEIGHTS.leave} · lệch tải ${BUSINESS_WEIGHTS.load} · người mới ${BUSINESS_WEIGHTS.coldStart})`,
    "",
    "## 1. Cấu hình đang dùng so với cấu hình dò được",
    "",
    "| Cấu hình | Tập dò | Tập chọn | **Tập kiểm chứng cuối** |",
    "|---|---|---|---|",
    `| Đang dùng — ${label(input.baseline)} | ${fitOf(input.tried, input.baseline)} | ` +
      `${validationOf(input.tried, input.baseline)} | **${scalarise(baselineTest.metrics).toFixed(3)}** |`,
    `| Dò được — ${label(input.winner.candidate)} | ${input.winner.fit.toFixed(3)} | ` +
      `${input.winner.validation.toFixed(3)} | **${scalarise(winnerTest.metrics).toFixed(3)}** |`,
    "",
    `Chênh lệch trên tập kiểm chứng cuối (${winnerTest.count} quyết định): ` +
      `**${gain >= 0 ? "+" : ""}${gain.toFixed(3)}** điểm tổng hợp.`,
    "",
    gain > 0.02
      ? "**Nên đổi.** Cấu hình dò được giữ được lợi thế trên lát dữ liệu chưa từng dùng để chọn nó."
      : "**Giữ nguyên.** Lợi thế trên tập chọn không còn khi sang lát cuối — đó là dấu hiệu của khớp nhiễu, không phải cải thiện.",
    "",
    "## 2. Mười cấu hình tốt nhất trên tập chọn",
    "",
    "| Đúng hạn/hiệu suất | Trễ pha | Prior | Sức chứa | Tập dò | Tập chọn |",
    "|---|---|---|---|---|---|"
  );

  for (const entry of input.tried
    .slice()
    .sort((left, right) => right.validation - left.validation)
    .slice(0, 10)) {
    lines.push(
      `| ${entry.candidate.history.onTimeShare} | ${entry.candidate.history.lagDays} ngày | ` +
        `${entry.candidate.history.priorStrength} | ${entry.candidate.capacityHours}h | ` +
        `${entry.fit.toFixed(3)} | ${entry.validation.toFixed(3)} |`
    );
  }

  lines.push(
    "",
    "## 3. Từng chiều ảnh hưởng ra sao",
    "",
    "Điểm trung bình trên tập chọn của mọi cấu hình có cùng giá trị ở chiều đó.",
    ""
  );

  for (const knob of ["onTimeShare", "lagDays", "priorStrength", "capacityHours"] as const) {
    lines.push(`**${knobLabel(knob)}**`, "", "| Giá trị | Số cấu hình | Điểm trung bình |", "|---|---|---|");
    for (const value of SEARCH_SPACE[knob]) {
      const group = input.tried.filter((entry) => knobOf(entry.candidate, knob) === value);
      if (group.length) {
        lines.push(
          `| ${value} | ${group.length} | ${mean(group.map((entry) => entry.validation)).toFixed(3)} |`
        );
      }
    }
    lines.push("");
  }

  lines.push(
    "## Ghi chú",
    "",
    "- Trễ pha 0 ngày thường cho điểm cao nhất trên dữ liệu mô phỏng, và đó chính là lý do " +
      "không nên chọn nó: nó mở lại đúng đường rò rỉ giữa nhãn kết quả và tín hiệu lịch sử " +
      "mà `prisma/diagnostics.ts` đo được. Giá trị đang dùng là một lựa chọn có chủ ý, " +
      "không phải điểm tối ưu của hàm mục tiêu.",
    "- Sức chứa tuần chỉ đổi thang của điểm tải việc, nên ảnh hưởng của nó nhỏ theo thiết kế.",
    ""
  );

  return lines.join("\n");
}

function knobOf(candidate: Candidate, knob: string) {
  return knob === "capacityHours"
    ? candidate.capacityHours
    : (candidate.history as unknown as Record<string, number>)[knob];
}

function knobLabel(knob: string) {
  return (
    {
      onTimeShare: "Tỉ lệ đúng hạn trong điểm lịch sử",
      lagDays: "Trễ pha cửa sổ lịch sử",
      priorStrength: "Độ mạnh của prior (k)",
      capacityHours: "Sức chứa mỗi tuần"
    }[knob] ?? knob
  );
}

function fitOf(
  tried: Array<{ candidate: Candidate; fit: number }>,
  candidate: Candidate
) {
  const key = JSON.stringify(candidate);
  return (tried.find((entry) => JSON.stringify(entry.candidate) === key)?.fit ?? 0).toFixed(3);
}

function validationOf(
  tried: Array<{ candidate: Candidate; validation: number }>,
  candidate: Candidate
) {
  const key = JSON.stringify(candidate);
  return (tried.find((entry) => JSON.stringify(entry.candidate) === key)?.validation ?? 0).toFixed(
    3
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
