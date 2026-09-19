/**
 * Offline evaluation of AI assignee suggestions on simulated history.
 *
 * For every subtask a lead assigned (TaskAssignment MANUAL) the script rebuilds
 * each team member's situation *at that moment* - open work, known leave,
 * finalized reviews, finished tasks - scores them with the same functions the
 * API uses (src/ai-task-suggestions/suggestion-scoring.ts) and compares the
 * ranking with two things the API never sees:
 *   - the simulator's hidden ability of each person (ground truth), and
 *   - how the task actually went for the person who got it.
 *
 * Read-only. Run it against a simulated database, never production:
 *   DATABASE_URL=...omnihr_eval npx tsx prisma/evaluate-suggestions.ts [--from 2026-09-17]
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import {
  LeaveRequestStatus,
  NotificationType,
  PerformanceReviewStatus,
  PrismaClient,
  TaskAssignmentType,
  TaskStatus
} from "@prisma/client";
import {
  PERFORMANCE_WEIGHT,
  SCORE_WEIGHTS,
  assessSkills,
  availabilityScoreFor,
  combineScores,
  compareCandidates,
  performanceFromRatings,
  workloadScoreFor
} from "../src/ai-task-suggestions/suggestion-scoring";
import { buildPersona } from "./simulation-persona";

const prisma = new PrismaClient();
const DAY_MS = 24 * 60 * 60 * 1000;
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
/** Finished tasks a person needs before their track record is trusted. */
const HISTORY_MIN_TASKS = 3;
const HISTORY_WEIGHT = 0.2;

type Candidate = {
  employeeId: number;
  ability: number;
  skillScore: number;
  eligible: boolean;
  workloadScore: number;
  availabilityScore: number;
  reviewScore: number | null;
  historyScore: number | null;
};

type Variant = {
  key: string;
  label: string;
  score: (candidate: Candidate) => number;
};

const W = SCORE_WEIGHTS.withAvailability;
const VARIANTS: Variant[] = [
  {
    key: "v4",
    label: "v4 hiện tại (kỹ năng + khối lượng + lịch nghỉ + điểm đánh giá)",
    score: (c) =>
      combineScores([
        { value: c.skillScore, weight: W.skill },
        { value: c.workloadScore, weight: W.workload },
        { value: c.availabilityScore, weight: W.availability },
        { value: c.reviewScore, weight: PERFORMANCE_WEIGHT }
      ])
  },
  {
    key: "v4-no-perf",
    label: "v4 bỏ điểm đánh giá",
    score: (c) =>
      combineScores([
        { value: c.skillScore, weight: W.skill },
        { value: c.workloadScore, weight: W.workload },
        { value: c.availabilityScore, weight: W.availability }
      ])
  },
  {
    key: "skill-only",
    label: "Chỉ kỹ năng",
    score: (c) => c.skillScore
  },
  {
    key: "v5",
    label: "v5 thử nghiệm (thay điểm đánh giá bằng lịch sử task)",
    score: (c) =>
      combineScores([
        { value: c.skillScore, weight: W.skill },
        { value: c.workloadScore, weight: W.workload },
        { value: c.availabilityScore, weight: W.availability },
        { value: c.historyScore, weight: HISTORY_WEIGHT }
      ])
  }
];

type Outcome = { resolved: boolean; onTime: boolean; hoursRatio: number | null; reworks: number };

type Decision = {
  taskId: number;
  assigneeId: number;
  candidates: Candidate[];
  outcome: Outcome;
};

async function main() {
  const from = parseFrom(process.argv.slice(2));
  const data = await loadData();
  const evalEnd = data.lastSimulatedDate;
  const decisions: Decision[] = [];

  for (const assignment of data.assignments) {
    if (assignment.assignmentType !== TaskAssignmentType.MANUAL || assignment.assignedAt < from) {
      continue;
    }
    const task = data.tasks.get(assignment.taskId);
    if (!task || task.teamId === null) {
      continue;
    }
    // One decision per task: the first manual assignment.
    if (decisions.some((decision) => decision.taskId === task.id)) {
      continue;
    }
    const at = assignment.assignedAt;
    const memberIds = (data.teamMembers.get(task.teamId) ?? []).filter((id) => {
      const employee = data.employees.get(id);
      return employee && (!employee.hireDate || employee.hireDate <= at);
    });
    if (memberIds.length < 2 || !memberIds.includes(assignment.assigneeId)) {
      continue;
    }

    decisions.push({
      taskId: task.id,
      assigneeId: assignment.assigneeId,
      candidates: memberIds.map((id) => scoreCandidate(data, task, id, at)),
      outcome: outcomeOf(data, task, evalEnd)
    });
  }

  const report = buildReport(decisions, from, evalEnd);
  const outDir = path.join(__dirname, "..", "eval_results");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "suggestions-eval.md"), report);
  console.info(report);
  console.info(`Saved to ${path.join(outDir, "suggestions-eval.md")}`);
}

function parseFrom(args: string[]) {
  const index = args.indexOf("--from");
  const value = index >= 0 ? args[index + 1] : "2026-09-17";
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("--from expects YYYY-MM-DD");
  }
  return date;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

async function loadData() {
  const [stateRow, employees, members, tasks, assignments, leaves, reviews, reworkNotes] =
    await Promise.all([
      prisma.systemSetting.findUnique({ where: { key: "simulation" } }),
      prisma.employee.findMany({
        select: {
          id: true,
          employeeCode: true,
          careerLevel: true,
          hireDate: true,
          employeeSkills: {
            select: { skillId: true, proficiency: true, yearsExperience: true, lastUsedAt: true }
          }
        }
      }),
      prisma.teamMember.findMany({ where: { isActive: true }, select: { teamId: true, employeeId: true } }),
      prisma.task.findMany({
        where: { deletedAt: null, parentTaskId: { not: null } },
        select: {
          id: true,
          teamId: true,
          assigneeId: true,
          status: true,
          startDate: true,
          dueDate: true,
          estimatedHours: true,
          actualHours: true,
          completedAt: true,
          updatedAt: true,
          requiredSkills: {
            select: {
              skillId: true,
              importance: true,
              requiredProficiency: true,
              skill: { select: { code: true } }
            }
          }
        }
      }),
      prisma.taskAssignment.findMany({
        select: { taskId: true, assigneeId: true, assignedAt: true, assignmentType: true },
        orderBy: { assignedAt: "asc" }
      }),
      prisma.leaveRequest.findMany({
        select: {
          employeeId: true,
          startDate: true,
          endDate: true,
          status: true,
          createdAt: true,
          approvedAt: true,
          canceledAt: true,
          updatedAt: true
        }
      }),
      prisma.performanceReview.findMany({
        where: { status: PerformanceReviewStatus.FINALIZED, finalRating: { not: null } },
        select: { employeeId: true, cycleId: true, finalRating: true, finalizedAt: true }
      }),
      prisma.notification.findMany({
        where: { type: NotificationType.TASK_STATUS_CHANGED, title: "Task returned for rework" },
        select: { entityId: true }
      })
    ]);

  if (!stateRow) {
    throw new Error("No simulation state found: run this against a simulated database.");
  }
  const state = stateRow.value as { lastDate: string; baselineCycleIds?: number[] };
  const baseline = new Set(state.baselineCycleIds ?? []);

  // Hidden ability, computed exactly as the simulator does.
  const baselineRatings = new Map<number, number[]>();
  for (const review of reviews) {
    if (baseline.has(review.cycleId)) {
      baselineRatings.set(review.employeeId, [
        ...(baselineRatings.get(review.employeeId) ?? []),
        review.finalRating!
      ]);
    }
  }
  const employeeMap = new Map(
    employees.map((employee) => {
      const ratings = baselineRatings.get(employee.id);
      const pastRating = ratings ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null;
      return [
        employee.id,
        {
          ...employee,
          ability: buildPersona(employee.employeeCode, employee.careerLevel, pastRating).ability
        }
      ];
    })
  );

  const teamMembers = new Map<number, number[]>();
  for (const member of members) {
    teamMembers.set(member.teamId, [...(teamMembers.get(member.teamId) ?? []), member.employeeId]);
  }

  const taskMap = new Map(tasks.map((task) => [task.id, task]));

  // Who held each task when: from one assignment to the next, completion or cancellation.
  const holdings = new Map<number, Array<{ taskId: number; from: Date; to: number }>>();
  const byTask = new Map<number, typeof assignments>();
  for (const assignment of assignments) {
    byTask.set(assignment.taskId, [...(byTask.get(assignment.taskId) ?? []), assignment]);
  }
  for (const [taskId, list] of byTask) {
    const task = taskMap.get(taskId);
    if (!task) {
      continue;
    }
    const closedAt =
      task.status === TaskStatus.DONE && task.completedAt
        ? task.completedAt.getTime()
        : task.status === TaskStatus.CANCELLED
          ? task.updatedAt.getTime()
          : Number.POSITIVE_INFINITY;
    list.forEach((assignment, index) => {
      const next = list[index + 1]?.assignedAt.getTime() ?? Number.POSITIVE_INFINITY;
      holdings.set(assignment.assigneeId, [
        ...(holdings.get(assignment.assigneeId) ?? []),
        { taskId, from: assignment.assignedAt, to: Math.min(next, closedAt) }
      ]);
    });
  }

  const reworks = new Map<number, number>();
  for (const note of reworkNotes) {
    if (note.entityId !== null) {
      reworks.set(note.entityId, (reworks.get(note.entityId) ?? 0) + 1);
    }
  }

  const reviewsByEmployee = new Map<number, typeof reviews>();
  for (const review of reviews) {
    reviewsByEmployee.set(review.employeeId, [...(reviewsByEmployee.get(review.employeeId) ?? []), review]);
  }
  const leavesByEmployee = new Map<number, typeof leaves>();
  for (const leave of leaves) {
    leavesByEmployee.set(leave.employeeId, [...(leavesByEmployee.get(leave.employeeId) ?? []), leave]);
  }
  const doneByEmployee = new Map<number, typeof tasks>();
  for (const task of tasks) {
    if (task.status === TaskStatus.DONE && task.completedAt && task.assigneeId !== null) {
      doneByEmployee.set(task.assigneeId, [...(doneByEmployee.get(task.assigneeId) ?? []), task]);
    }
  }

  return {
    employees: employeeMap,
    teamMembers,
    tasks: taskMap,
    assignments,
    holdings,
    reworks,
    reviewsByEmployee,
    leavesByEmployee,
    doneByEmployee,
    lastSimulatedDate: new Date(`${state.lastDate}T00:00:00.000Z`)
  };
}

type Data = Awaited<ReturnType<typeof loadData>>;
type TaskRow = NonNullable<ReturnType<Data["tasks"]["get"]>>;

// ---------------------------------------------------------------------------
// Replaying one candidate at assignment time
// ---------------------------------------------------------------------------

function scoreCandidate(data: Data, task: TaskRow, employeeId: number, at: Date): Candidate {
  const employee = data.employees.get(employeeId)!;
  const skill = assessSkills(task.requiredSkills, employee.employeeSkills, at);

  // Workload: tasks this person held at that moment, as TaskWorkloadService counts them.
  const today = utcDate(at);
  let hours = 0;
  let overdue = 0;
  for (const holding of data.holdings.get(employeeId) ?? []) {
    if (holding.taskId === task.id || holding.from > at || holding.to <= at.getTime()) {
      continue;
    }
    const held = data.tasks.get(holding.taskId);
    if (!held) {
      continue;
    }
    hours += Number(held.estimatedHours ?? 4);
    if (held.dueDate && held.dueDate < today) {
      overdue += 1;
    }
  }

  return {
    employeeId,
    ability: employee.ability,
    skillScore: skill.score,
    eligible: skill.eligible,
    workloadScore: workloadScoreFor(hours, overdue),
    availabilityScore: availabilityAt(data, employeeId, task, at),
    reviewScore: performanceFromRatings(
      (data.reviewsByEmployee.get(employeeId) ?? [])
        .filter((review) => review.finalizedAt && review.finalizedAt <= at)
        .sort((a, b) => b.finalizedAt!.getTime() - a.finalizedAt!.getTime())
        .map((review) => review.finalRating!)
    ).score,
    historyScore: historyAt(data, employeeId, at)
  };
}

/** Leave overlap with the task window, using only what was known at `at`. */
function availabilityAt(data: Data, employeeId: number, task: TaskRow, at: Date) {
  if (!task.startDate && !task.dueDate) {
    return 100;
  }
  const from = utcDate(task.startDate ?? task.dueDate!);
  const to = utcDate(task.dueDate ?? task.startDate!);
  const taskDays = workdayKeys(from, to);
  if (!taskDays.length) {
    return 100;
  }
  const approved = new Set<string>();
  const pending = new Set<string>();
  for (const leave of data.leavesByEmployee.get(employeeId) ?? []) {
    if (leave.createdAt > at || leave.endDate < from || leave.startDate > to) {
      continue;
    }
    const approvedByThen = leave.approvedAt !== null && leave.approvedAt <= at;
    const cancelledByThen = leave.canceledAt !== null && leave.canceledAt <= at;
    const rejectedByThen = leave.status === LeaveRequestStatus.REJECTED && leave.updatedAt <= at;
    if (cancelledByThen || rejectedByThen) {
      continue;
    }
    const bucket = approvedByThen ? approved : pending;
    for (const key of workdayKeys(maxDate(leave.startDate, from), minDate(leave.endDate, to))) {
      bucket.add(key);
    }
  }
  const pendingOnly = Array.from(pending).filter((key) => !approved.has(key)).length;
  return availabilityScoreFor(taskDays.length, approved.size, pendingOnly);
}

/** Candidate v5 signal: on-time rate and hours efficiency of tasks already finished. */
function historyAt(data: Data, employeeId: number, at: Date) {
  const done = (data.doneByEmployee.get(employeeId) ?? []).filter((task) => task.completedAt! < at);
  if (done.length < HISTORY_MIN_TASKS) {
    return null;
  }
  const onTime = done.filter((task) => isOnTime(task.completedAt!, task.dueDate)).length / done.length;
  const estimated = done.reduce((sum, task) => sum + Number(task.estimatedHours ?? 0), 0);
  const actual = done.reduce((sum, task) => sum + Number(task.actualHours ?? 0), 0);
  const efficiency = actual > 0 ? Math.min(1, estimated / actual) : 1;
  return 100 * (0.6 * onTime + 0.4 * efficiency);
}

function outcomeOf(data: Data, task: TaskRow, evalEnd: Date): Outcome {
  const reworks = data.reworks.get(task.id) ?? 0;
  if (task.status === TaskStatus.DONE && task.completedAt) {
    const estimated = Number(task.estimatedHours ?? 0);
    return {
      resolved: true,
      onTime: isOnTime(task.completedAt, task.dueDate),
      hoursRatio: estimated > 0 ? Number(task.actualHours ?? 0) / estimated : null,
      reworks
    };
  }
  // Still open past its due date: already late, whatever happens next.
  if (task.status !== TaskStatus.CANCELLED && task.dueDate && task.dueDate < evalEnd) {
    return { resolved: true, onTime: false, hoursRatio: null, reworks };
  }
  return { resolved: false, onTime: false, hoursRatio: null, reworks };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function buildReport(decisions: Decision[], from: Date, evalEnd: Date) {
  const lines: string[] = [];
  const resolved = decisions.filter((decision) => decision.outcome.resolved);
  lines.push(
    "# Đánh giá gợi ý người nhận task trên dữ liệu mô phỏng",
    "",
    `- Khoảng thời gian: ${iso(from)} → ${iso(evalEnd)}`,
    `- Số lần giao việc được dựng lại: ${decisions.length} (đã có kết quả: ${resolved.length})`,
    `- Số ứng viên trung bình mỗi lần: ${mean(decisions.map((d) => d.candidates.length)).toFixed(1)}`,
    "- \"Năng lực ẩn\" (0–1) là tham số bộ mô phỏng gán cho từng người; API không đọc được giá trị này.",
    "",
    "## 1. Xếp hạng có chọn đúng người giỏi không",
    "",
    "| Cách chọn | Năng lực TB của người được chọn | Chọn trúng người giỏi nhất nhóm | Tương quan hạng–năng lực (Spearman) |",
    "|---|---|---|---|"
  );

  const randomAbility = mean(decisions.map((d) => mean(d.candidates.map((c) => c.ability))));
  const bestRateRandom = mean(
    decisions.map((d) => {
      const best = Math.max(...d.candidates.map((c) => c.ability));
      return d.candidates.filter((c) => c.ability === best).length / d.candidates.length;
    })
  );
  lines.push(`| Chọn ngẫu nhiên (mốc so sánh) | ${randomAbility.toFixed(3)} | ${pct(bestRateRandom)} | 0 |`);

  const actualAbility = mean(
    decisions.map((d) => d.candidates.find((c) => c.employeeId === d.assigneeId)!.ability)
  );
  const actualBest = mean(
    decisions.map((d) => {
      const best = Math.max(...d.candidates.map((c) => c.ability));
      return d.candidates.find((c) => c.employeeId === d.assigneeId)!.ability === best ? 1 : 0;
    })
  );
  lines.push(`| Trưởng nhóm giao thực tế (trong mô phỏng) | ${actualAbility.toFixed(3)} | ${pct(actualBest)} | – |`);

  for (const variant of VARIANTS) {
    const topAbilities: number[] = [];
    const topIsBest: number[] = [];
    const correlations: number[] = [];
    for (const decision of decisions) {
      const ranked = rank(decision.candidates, variant);
      const best = Math.max(...decision.candidates.map((c) => c.ability));
      topAbilities.push(ranked[0].ability);
      topIsBest.push(ranked[0].ability === best ? 1 : 0);
      if (decision.candidates.length >= 3) {
        correlations.push(
          spearman(
            decision.candidates.map((c) => variant.score(c)),
            decision.candidates.map((c) => c.ability)
          )
        );
      }
    }
    lines.push(
      `| ${variant.label} | ${mean(topAbilities).toFixed(3)} | ${pct(mean(topIsBest))} | ${mean(correlations).toFixed(3)} |`
    );
  }

  lines.push(
    "",
    "## 2. Kết quả thực tế theo hạng AI của người được giao",
    "",
    "Người nhận do trưởng nhóm (mô phỏng) chọn, không phải do AI, nên mỗi mức hạng đều có dữ liệu. Nếu thuật toán tốt, task giao cho người AI xếp hạng cao phải xong đúng hạn nhiều hơn.",
    ""
  );
  for (const variant of VARIANTS) {
    lines.push(
      `### ${variant.label}`,
      "",
      "| Hạng AI của người được giao | Số task | Đúng hạn | Giờ thực / ước tính | Số lần bị trả về sửa TB |",
      "|---|---|---|---|---|"
    );
    const buckets: Array<[string, (rankValue: number) => boolean]> = [
      ["Hạng 1", (r) => r === 1],
      ["Hạng 2–3", (r) => r >= 2 && r <= 3],
      ["Hạng 4 trở xuống", (r) => r >= 4]
    ];
    for (const [label, match] of buckets) {
      const items = resolved.filter((decision) => {
        const ranked = rank(decision.candidates, variant);
        return match(ranked.findIndex((c) => c.employeeId === decision.assigneeId) + 1);
      });
      const ratios = items
        .map((item) => item.outcome.hoursRatio)
        .filter((value): value is number => value !== null);
      lines.push(
        `| ${label} | ${items.length} | ${items.length ? pct(mean(items.map((i) => (i.outcome.onTime ? 1 : 0)))) : "–"} | ${ratios.length ? mean(ratios).toFixed(2) : "–"} | ${items.length ? mean(items.map((i) => i.outcome.reworks)).toFixed(2) : "–"} |`
      );
    }
    lines.push("");
  }

  const withHistory = mean(
    decisions.map((d) => d.candidates.filter((c) => c.historyScore !== null).length / d.candidates.length)
  );
  const withReview = mean(
    decisions.map((d) => d.candidates.filter((c) => c.reviewScore !== null).length / d.candidates.length)
  );
  lines.push(
    "## Ghi chú",
    "",
    `- Ứng viên có điểm đánh giá đã chốt tại thời điểm giao: ${pct(withReview)}; có đủ ${HISTORY_MIN_TASKS} task đã xong để tính lịch sử: ${pct(withHistory)}.`,
    "- v4 cố ý cân nhắc khối lượng việc và lịch nghỉ, nên không nhắm chọn người giỏi nhất tuyệt đối; bảng 1 chỉ đo riêng khả năng nhận ra năng lực.",
    "- Năng lực ẩn được tạo một phần (35%) từ điểm đánh giá kỳ gốc (6 tháng đầu năm), và chính điểm đó cũng nằm trong tín hiệu hiệu suất của v4; phần v4 hơn \"v4 bỏ điểm đánh giá\" vì vậy có thể bị thổi phồng một phần. Kết quả thực tế (bảng 2) không chịu ảnh hưởng này.",
    "- Dữ liệu là mô phỏng: kết quả kiểm chứng thuật toán bắt được tín hiệu trong kịch bản giả lập, không thay cho đánh giá trên dữ liệu công ty thật.",
    ""
  );
  return lines.join("\n");
}

function rank(candidates: Candidate[], variant: Variant) {
  return candidates
    .map((candidate) => ({ ...candidate, score: variant.score(candidate) }))
    .sort((left, right) => compareCandidates(left, right) || left.employeeId - right.employeeId);
}

function spearman(xs: number[], ys: number[]) {
  const rx = ranks(xs);
  const ry = ranks(ys);
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < rx.length; i += 1) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

/** Average ranks, so ties share a rank. */
function ranks(values: number[]) {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result = new Array<number>(values.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].value === order[i].value) {
      j += 1;
    }
    const average = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) {
      result[order[k].index] = average;
    }
    i = j + 1;
  }
  return result;
}

function isOnTime(completedAt: Date, dueDate: Date | null) {
  if (!dueDate) {
    return true;
  }
  return utcDate(new Date(completedAt.getTime() + TZ_OFFSET_MS)) <= dueDate;
}

function workdayKeys(from: Date, to: Date) {
  const keys: string[] = [];
  for (let day = utcDate(from); day <= to; day = new Date(day.getTime() + DAY_MS)) {
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) {
      keys.push(iso(day));
    }
  }
  return keys;
}

function utcDate(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function maxDate(a: Date, b: Date) {
  return a > b ? a : b;
}

function minDate(a: Date, b: Date) {
  return a < b ? a : b;
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
