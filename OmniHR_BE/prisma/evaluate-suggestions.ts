/**
 * Offline evaluation of AI assignee suggestions on simulated history.
 *
 * For every subtask a lead assigned (TaskAssignment MANUAL) the script rebuilds
 * each team member's situation *at that moment* - open work, known leave,
 * finished tasks - scores them with the same functions the
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
  PrismaClient,
  TaskAssignmentType,
  TaskStatus
} from "@prisma/client";
import {
  DEFAULT_HISTORY_TUNING,
  DEFAULT_SCORE_WEIGHTS,
  HistoryTuning,
  WORKLOAD_CAPACITY_HOURS_PER_WEEK,
  assessSkills,
  availabilityScoreFor,
  LEAVE_BLOCK_THRESHOLD,
  combineScores,
  compareCandidates,
  historyPrior,
  historySignal,
  rawHistoryScore,
  usableHistory,
  workloadScoreFor
} from "../src/ai-task-suggestions/suggestion-scoring";
import { buildPersona } from "./simulation-persona";

export const prisma = new PrismaClient();
const DAY_MS = 24 * 60 * 60 * 1000;
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
/** Finished tasks a person needs before their track record is trusted. */
const HISTORY_MIN_TASKS = 3;
/** Ordinal, so a linear model can read seniority off one column. */
const CAREER_LEVEL_INDEX: Record<string, number> = {
  INTERN: 0,
  FRESHER: 1,
  JUNIOR: 2,
  MIDDLE: 3,
  SENIOR: 4,
  LEAD: 5
};

export type Candidate = {
  employeeId: number;
  ability: number;
  skillScore: number;
  eligible: boolean;
  workloadScore: number;
  availabilityScore: number;
  /** Share of the task's workdays the candidate already has approved leave on. */
  approvedOverlapRatio: number;
  /** Away for most of that window: ranked after everyone who will be there. */
  leaveBlocked: boolean;
  /** Lagged and shrunk towards the peer prior - what the model sees. */
  historyScore: number | null;
  historyConfidence: number;
  historySampleSize: number;
  /**
   * Full record with no lag and no shrinkage. Never fed to any model: it
   * exists so prisma/diagnostics.ts can measure how much of the observed
   * signal is really just the simulator's hidden ability leaking back.
   */
  historyClean: number | null;
  /** Signals the weighted model does not use; the ML baselines do. */
  doneCount: number;
  projectFamiliarity: number;
  seniorityYears: number;
  careerLevelIndex: number;
};

type Variant = {
  key: string;
  label: string;
  score: (candidate: Candidate) => number;
};

const W = DEFAULT_SCORE_WEIGHTS;
/**
 * The first entry is exactly what the API ranks with; the other two drop
 * signals from it, so each row shows what a signal adds on top of the last.
 */
const VARIANTS: Variant[] = [
  {
    key: "deployed",
    label: `Đang chạy (kỹ năng ${W.skill} / tải việc ${W.workload} / lịch nghỉ ${W.availability} / lịch sử ${W.history})`,
    score: (c) =>
      combineScores([
        { value: c.skillScore, weight: W.skill },
        { value: c.workloadScore, weight: W.workload },
        { value: c.availabilityScore, weight: W.availability },
        { value: c.historyScore, weight: W.history }
      ])
  },
  {
    key: "no-history",
    label: "Bỏ lịch sử (kỹ năng + tải việc + lịch nghỉ)",
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
  }
];

export type Outcome = {
  resolved: boolean;
  onTime: boolean;
  hoursRatio: number | null;
  reworks: number;
};

export type Decision = {
  taskId: number;
  /** Estimated size of the task being handed out. */
  taskEstimatedHours: number;
  assigneeId: number;
  /** Used by the tuner to split history into a fit and a held-out period. */
  assignedAt: Date;
  candidates: Candidate[];
  outcome: Outcome;
};

/**
 * Every manual assignment replayed as a decision: the candidates a lead
 * could have picked from, scored with what was known at that moment, plus
 * how the task actually went. Shared with prisma/tune-weights.ts.
 */
/** Everything the replay lets a tuning run vary. */
export type ReplayTuning = {
  history: HistoryTuning;
  /** Weekly capacity behind the workload score. */
  capacityHours: number;
};

export const DEFAULT_REPLAY_TUNING: ReplayTuning = {
  history: DEFAULT_HISTORY_TUNING,
  capacityHours: WORKLOAD_CAPACITY_HOURS_PER_WEEK
};

export function buildDecisions(
  data: Data,
  from: Date,
  evalEnd: Date,
  tuning: ReplayTuning = DEFAULT_REPLAY_TUNING
) {
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
      taskEstimatedHours: Number(task.estimatedHours ?? 0),
      assigneeId: assignment.assigneeId,
      assignedAt: at,
      candidates: withPeerPrior(
        data,
        memberIds.map((id) => scoreCandidate(data, task, id, at, tuning)),
        at,
        tuning
      ),
      outcome: outcomeOf(data, task, evalEnd)
    });
  }

  return decisions;
}

async function main() {
  const from = parseFrom(process.argv.slice(2));
  const data = await loadData();
  const evalEnd = data.lastSimulatedDate;
  const decisions = buildDecisions(data, from, evalEnd);

  const report = buildReport(decisions, from, evalEnd);
  const outDir = path.join(__dirname, "..", "eval_results");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "suggestions-eval.md"), report);
  console.info(report);
  console.info(`Saved to ${path.join(outDir, "suggestions-eval.md")}`);
}

export function parseFrom(args: string[]) {
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

export async function loadData() {
  const [stateRow, employees, members, tasks, assignments, leaves, reworkNotes] =
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
          projectId: true,
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
      prisma.notification.findMany({
        where: { type: NotificationType.TASK_STATUS_CHANGED, title: "Task returned for rework" },
        select: { entityId: true }
      })
    ]);

  if (!stateRow) {
    throw new Error("No simulation state found: run this against a simulated database.");
  }
  const state = stateRow.value as { lastDate: string };

  // Hidden ability, computed exactly as the simulator does.
  const employeeMap = new Map(
    employees.map((employee) => [
      employee.id,
      {
        ...employee,
        ability: buildPersona(employee.employeeCode, employee.careerLevel).ability
      }
    ])
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
    leavesByEmployee,
    doneByEmployee,
    lastSimulatedDate: new Date(`${state.lastDate}T00:00:00.000Z`)
  };
}

export type Data = Awaited<ReturnType<typeof loadData>>;
type TaskRow = NonNullable<ReturnType<Data["tasks"]["get"]>>;

// ---------------------------------------------------------------------------
// Replaying one candidate at assignment time
// ---------------------------------------------------------------------------

function scoreCandidate(
  data: Data,
  task: TaskRow,
  employeeId: number,
  at: Date,
  tuning: ReplayTuning
): Candidate & { historyOwn: number | null; historyOwnSampleSize: number } {
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

  const availability = availabilityAt(data, employeeId, task, at);
  const finished = (data.doneByEmployee.get(employeeId) ?? []).filter(
    (done) => done.completedAt! < at
  );
  const familiarity = task.projectId
    ? finished.filter((done) => done.projectId === task.projectId).length
    : 0;

  return {
    employeeId,
    ability: employee.ability,
    skillScore: skill.score,
    eligible: skill.eligible,
    workloadScore: workloadScoreFor(hours, overdue, tuning.capacityHours),
    availabilityScore: availability.score,
    approvedOverlapRatio: availability.approvedOverlapRatio,
    leaveBlocked: availability.approvedOverlapRatio > LEAVE_BLOCK_THRESHOLD,
    historyScore: null,
    historyConfidence: 0,
    historySampleSize: 0,
    historyClean: historyAt(data, employeeId, at, 0),
    historyOwn: historyAt(data, employeeId, at, tuning.history.lagDays),
    historyOwnSampleSize: usableHistory(
      finishedTasks(data, employeeId, at),
      at,
      tuning.history.lagDays
    ).length,
    doneCount: finished.length,
    projectFamiliarity: familiarity,
    seniorityYears: employee.hireDate
      ? Math.max(0, (at.getTime() - employee.hireDate.getTime()) / (365 * DAY_MS))
      : 0,
    careerLevelIndex: CAREER_LEVEL_INDEX[employee.careerLevel] ?? 0
  };
}

/** Leave overlap with the task window, using only what was known at `at`. */
function availabilityAt(data: Data, employeeId: number, task: TaskRow, at: Date) {
  if (!task.startDate && !task.dueDate) {
    return { score: 100, approvedOverlapRatio: 0 };
  }
  const from = utcDate(task.startDate ?? task.dueDate!);
  const to = utcDate(task.dueDate ?? task.startDate!);
  const taskDays = workdayKeys(from, to);
  if (!taskDays.length) {
    return { score: 100, approvedOverlapRatio: 0 };
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
  return {
    score: availabilityScoreFor(taskDays.length, approved.size, pendingOnly),
    // Reported separately: an approved day off during the task window is a
    // business rule the on-time label cannot see.
    approvedOverlapRatio: approved.size / taskDays.length
  };
}

/**
 * Fills in the shrunk track record once the whole shortlist is known: the
 * prior a candidate is pulled towards is the median of the peers they are
 * actually being compared against, exactly as the API computes it.
 */
function withPeerPrior(
  data: Data,
  candidates: Array<Candidate & { historyOwn: number | null; historyOwnSampleSize: number }>,
  at: Date,
  tuning: ReplayTuning
): Candidate[] {
  const everyone = candidates.map((candidate) => candidate.historyOwn);

  return candidates.map((candidate) => {
    const level = data.employees.get(candidate.employeeId)?.careerLevel;
    const peers = candidates
      .filter((peer) => data.employees.get(peer.employeeId)?.careerLevel === level)
      .map((peer) => peer.historyOwn);
    const signal = historySignal(
      finishedTasks(data, candidate.employeeId, at),
      at,
      historyPrior(peers, everyone),
      tuning.history
    );
    return {
      ...candidate,
      historyScore: signal.score,
      historyConfidence: signal.confidence,
      historySampleSize: signal.sampleSize
    };
  });
}

/** Tasks this person had already finished at `at`, in the production shape. */
function finishedTasks(data: Data, employeeId: number, at: Date) {
  return (data.doneByEmployee.get(employeeId) ?? [])
    .filter((task) => task.completedAt! < at)
    .map((task) => ({
      dueDate: task.dueDate,
      completedAt: task.completedAt!,
      estimatedHours: task.estimatedHours,
      actualHours: task.actualHours
    }));
}

/** Un-shrunk track record at `at`, using the same formula the API uses. */
function historyAt(data: Data, employeeId: number, at: Date, lagDays: number) {
  const usable = usableHistory(finishedTasks(data, employeeId, at), at, lagDays);
  return rawHistoryScore(usable, DEFAULT_HISTORY_TUNING.onTimeShare);
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
  lines.push(
    "## Ghi chú",
    "",
    `- Ứng viên có đủ ${HISTORY_MIN_TASKS} task đã xong để tính lịch sử: ${pct(withHistory)}.`,
    "- Bộ đang chạy cố ý cân nhắc khối lượng việc và lịch nghỉ, nên không nhắm chọn người giỏi nhất tuyệt đối; bảng 1 chỉ đo riêng khả năng nhận ra năng lực.",
    "- Thứ hạng ở đây đã áp ràng buộc cứng (thiếu kỹ năng bắt buộc, nghỉ quá nửa kỳ task) nhưng chưa trừ điểm cân tải; báo cáo tune-weights đo cả phần đó.",
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

export function spearman(xs: number[], ys: number[]) {
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

export function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

if (require.main === module) {
  main()
    .then(async () => prisma.$disconnect())
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
