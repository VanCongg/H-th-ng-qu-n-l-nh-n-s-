// Các hàm chấm điểm thuần (không đọc DB), dùng chung cho API, script đánh giá offline
// và script tinh chỉnh trọng số -> đánh giá offline đo đúng thứ API đang dùng để xếp hạng.
// Mọi điểm thành phần nằm trên thang 0-100.

import { CareerLevel, SkillProficiency, TaskSkillImportance } from "@prisma/client";

/**
 * Pure scoring for AI assignee suggestions. The service feeds it live data;
 * prisma/evaluate-suggestions.ts replays it against history. Keeping one copy
 * means the offline evaluation measures exactly what the API ranks with.
 */

// Trọng số 4 tiêu chí: kỹ năng, khối lượng việc, lịch nghỉ, thành tích.
export type ScoreWeights = {
  skill: number;
  workload: number;
  availability: number;
  /**
   * Track record on finished tasks; see `historyScoreFor`. Scaled per task by
   * `HISTORY_SHARE`, so it weighs fully only on hard work.
   */
  history: number;
};

/**
 * How demanding a task is, from the proficiency its required skills ask for
 * and the lowest career level it suits.
 */
export type TaskDifficulty = "EASY" | "MEDIUM" | "HARD";

/**
 * How much of the history weight a task of each difficulty uses. A fixed rule,
 * not a setting: easy work is where a new hire builds a record, so a track
 * record barely counts there and the skill fit decides - the person whose
 * level matches the task wins, not the one with the longest record. Hard
 * work is where a proven record matters, so it counts in full.
 */
// Task càng khó thì thành tích càng được tính nhiều: dễ 25%, trung bình 60%, khó 100% trọng số.
export const HISTORY_SHARE: Record<TaskDifficulty, number> = { EASY: 0.25, MEDIUM: 0.6, HARD: 1 };

/**
 * Fitted, not chosen: the best vector prisma/tune-weights.ts found on the
 * replayed assignments, within the bounds it searches (history at most 0.4,
 * skill at least 0.2, every signal at least 0.1) so no single signal decides
 * alone (see eval_results/weights-tuning.md). Settings override them per
 * deployment. `combineScores` renormalises whatever it is given, so they need
 * not sum to 1 and dropping a term costs nothing.
 */
// Trọng số mặc định: kỹ năng 0.3, khối lượng 0.2, lịch nghỉ 0.1, thành tích 0.4.
// Không chọn tay mà do prisma/tune-weights.ts tìm ra trên dữ liệu giao việc quá khứ.
export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  skill: 0.3,
  workload: 0.2,
  availability: 0.1,
  history: 0.4
};

const PROFICIENCY_RANK: Record<SkillProficiency, number> = {
  BEGINNER: 0,
  INTERMEDIATE: 1,
  ADVANCED: 2,
  EXPERT: 3
};

/**
 * Hard: a required skill at Advanced or Expert, or Senior and up only.
 * Medium: Intermediate, or Middle and up. Easy: anything less, including a
 * task that declares no skills (its skill scores say nothing anyway).
 * Only required skills count when there are any: a nice-to-have at Expert
 * does not make the work hard.
 */
// Độ khó task: KHÓ nếu cần kỹ năng Advanced/Expert hoặc từ Senior; TRUNG BÌNH nếu Intermediate hoặc từ Middle; còn lại DỄ.
export function taskDifficulty(
  requiredSkills: Array<{ importance: TaskSkillImportance | string; requiredProficiency: SkillProficiency }>,
  minLevel?: CareerLevel | null
): TaskDifficulty {
  const required = requiredSkills.filter((skill) => skill.importance === TaskSkillImportance.REQUIRED);
  const counted = required.length ? required : requiredSkills;
  const proficiency = Math.max(-1, ...counted.map((skill) => PROFICIENCY_RANK[skill.requiredProficiency]));
  const level = minLevel ? CAREER_LEVELS.indexOf(minLevel) : -1;
  if (proficiency >= PROFICIENCY_RANK.ADVANCED || level >= CAREER_LEVELS.indexOf(CareerLevel.SENIOR)) {
    return "HARD";
  }
  if (proficiency >= PROFICIENCY_RANK.INTERMEDIATE || level >= CAREER_LEVELS.indexOf(CareerLevel.MIDDLE)) {
    return "MEDIUM";
  }
  return "EASY";
}

/** The weights for one task: the history weight scaled by its difficulty. */
// Trọng số cho một task cụ thể: trọng số thành tích nhân theo độ khó.
export function weightsForTask(weights: ScoreWeights, difficulty?: TaskDifficulty): ScoreWeights {
  const share = difficulty ? HISTORY_SHARE[difficulty] : 1;
  return { ...weights, history: weights.history * share };
}

export type CandidateSignals = {
  skillScore: number;
  workloadScore: number;
  /** Undefined when leave is left out of this scoring run. */
  availabilityScore?: number;
  historyScore: number | null;
  difficulty?: TaskDifficulty;
};

/**
 * A candidate's total. The one place the signals are combined: the API, the
 * replay, the tuner and the diagnostics all call it, so none of them can
 * weigh a candidate differently from the others.
 */
// Điểm tổng của một ứng viên = trung bình có trọng số các tiêu chí.
// Ví dụ (trọng số mặc định 0.3/0.2/0.1/0.4, task khó): kỹ năng 90, khối lượng 80, lịch nghỉ 100, thành tích 70
// -> (90*0.3 + 80*0.2 + 100*0.1 + 70*0.4) / 1.0 = 81.
export function scoreCandidate(weights: ScoreWeights, signals: CandidateSignals) {
  const task = weightsForTask(weights, signals.difficulty);
  return combineScores([
    { value: signals.skillScore, weight: task.skill },
    { value: signals.workloadScore, weight: task.workload },
    ...(signals.availabilityScore === undefined
      ? []
      : [{ value: signals.availabilityScore, weight: task.availability }]),
    { value: signals.historyScore, weight: task.history }
  ]);
}

/** Keeps a hand-edited settings row from zeroing every candidate's score. */
// Trọng số sửa tay mà bằng 0 hết thì dùng mặc định, tránh mọi ứng viên đều 0 điểm.
export function usableWeights(weights: ScoreWeights): ScoreWeights {
  const total =
    weights.skill + weights.workload + weights.availability + weights.history;
  return total > 0 ? weights : DEFAULT_SCORE_WEIGHTS;
}

/**
 * Below this many finished tasks a person counts as cold-start. It no longer
 * switches the signal off - see `historySignal` - but the evaluation reports
 * this group separately, because a ranking that quietly buries every new hire
 * looks fine on average and is unusable in practice.
 */
// Dưới 3 task đã xong thì coi là người mới (cold-start).
export const COLD_START_TASKS = 3;

export type FinishedTask = {
  dueDate: Date | null;
  completedAt: Date;
  estimatedHours: unknown;
  actualHours: unknown;
};

export type HistoryTuning = {
  /** Share of the score that comes from meeting due dates; the rest is hours. */
  onTimeShare: number;
  /**
   * Tasks finished more recently than this are ignored. Two reasons: a
   * manager's picture of someone lags reality, and - for the offline
   * evaluation - it breaks the short loop where a task finished yesterday
   * feeds the score that is graded against today's outcome.
   */
  lagDays: number;
  /** Strength of the peer prior, in units of tasks (k in the shrinkage). */
  priorStrength: number;
};

export const DEFAULT_HISTORY_TUNING: HistoryTuning = {
  onTimeShare: 0.6,
  lagDays: 45,
  priorStrength: 4
};

export type HistorySignal = {
  score: number;
  /** n / (n + k): how much of the score is the person's own record. */
  confidence: number;
  sampleSize: number;
};

/** Finished tasks old enough to count at `asOf`. */
// Chỉ tính các task đã xong đủ lâu tại thời điểm xét.
export function usableHistory(
  finished: FinishedTask[],
  asOf: Date,
  lagDays: number
) {
  const cutoff = asOf.getTime() - lagDays * DAY_MS;
  return finished.filter((task) => task.completedAt.getTime() <= cutoff);
}

/**
 * Raw track record, or null when the person has finished nothing yet.
 * Used both as the candidate's own score and to build the peer prior.
 */
// Điểm thành tích thô = kết hợp tỉ lệ hoàn thành đúng hạn và hiệu suất giờ
// (làm vượt giờ ước tính bị trừ, làm nhanh hơn không được cộng).
export function rawHistoryScore(finished: FinishedTask[], onTimeShare: number) {
  if (!finished.length) {
    return null;
  }
  const onTime =
    finished.filter((task) => !task.dueDate || toDayStart(task.completedAt) <= task.dueDate)
      .length / finished.length;
  const estimated = finished.reduce((sum, task) => sum + Number(task.estimatedHours ?? 0), 0);
  const actual = finished.reduce((sum, task) => sum + Number(task.actualHours ?? 0), 0);
  // Over-running the estimate counts against; beating it is not a bonus,
  // since a wildly low actual usually means the estimate was wrong.
  const efficiency = actual > 0 ? Math.min(1, estimated / actual) : 1;
  return clampScore(100 * (onTimeShare * onTime + (1 - onTimeShare) * efficiency));
}

/** Neutral score for someone nobody can be compared against yet. */
export const NEUTRAL_HISTORY = 50;

/**
 * Median track record of the peers a candidate is judged against - same
 * career level first, then the whole shortlist, then a neutral 50. Computed
 * from the candidates of this very suggestion, so it needs no extra query and
 * means exactly the same thing in the API and in the offline replay.
 */
// Mức tham chiếu: trung vị thành tích của các ứng viên cùng cấp bậc, không có thì cả danh sách, không có nữa thì 50.
export function historyPrior(peerScores: Array<number | null>, fallback: Array<number | null> = []) {
  return (
    median(peerScores) ?? median(fallback) ?? NEUTRAL_HISTORY
  );
}

function median(values: Array<number | null>) {
  const usable = values.filter((value): value is number => value !== null).sort((a, b) => a - b);
  if (!usable.length) {
    return null;
  }
  const middle = Math.floor(usable.length / 2);
  return usable.length % 2 === 0
    ? (usable[middle - 1] + usable[middle]) / 2
    : usable[middle];
}

/**
 * The track record signal, shrunk towards the peer prior.
 *
 *     score = (n * own + k * prior) / (n + k)
 *
 * A new hire is scored at their peers' level rather than dropped from the
 * ranking's strongest signal, and their own record takes over smoothly as it
 * accumulates. `confidence` is surfaced so an explanation can say how much of
 * the number is really about this person.
 */
// Điểm thành tích "co về" mức tham chiếu: (n * điểm riêng + k * tham chiếu) / (n + k), n = số task đã xong.
// Người mới được chấm ngang đồng nghiệp thay vì bị loại; càng làm nhiều thì điểm riêng càng chiếm ưu thế.
export function historySignal(
  finished: FinishedTask[],
  asOf: Date,
  prior: number,
  tuning: HistoryTuning = DEFAULT_HISTORY_TUNING
): HistorySignal {
  const usable = usableHistory(finished, asOf, tuning.lagDays);
  const own = rawHistoryScore(usable, tuning.onTimeShare);
  const n = usable.length;
  const confidence = n / (n + tuning.priorStrength);
  const score = own === null ? prior : confidence * own + (1 - confidence) * prior;
  return { score: clampScore(score), confidence, sampleSize: n };
}

/** Completion is compared against a date-only due date. */
function toDayStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export const WORKLOAD_CAPACITY_HOURS_PER_WEEK = 40;

/** Career levels from the least to the most experienced. */
export const CAREER_LEVELS: CareerLevel[] = [
  CareerLevel.INTERN,
  CareerLevel.FRESHER,
  CareerLevel.JUNIOR,
  CareerLevel.MIDDLE,
  CareerLevel.SENIOR,
  CareerLevel.LEAD
];
/** Skill points lost per level below the task's range, capped. */
export const UNDER_LEVEL_PENALTY = 15;
export const MAX_UNDER_LEVEL_PENALTY = 45;
/** Skill points lost per level above it: milder, overqualified is not unable. */
export const OVER_LEVEL_PENALTY = 8;
export const MAX_OVER_LEVEL_PENALTY = 24;

export type LevelFit = {
  fit: "ANY" | "FIT" | "UNDER" | "OVER";
  /** Levels outside the range; 0 inside it. */
  gap: number;
  penalty: number;
};

/**
 * How well someone's career level suits the work. Skill scores alone rank
 * the most experienced person first for everything - an expert scores 100 on
 * a task that asks for a beginner - so a senior tops the list even for simple
 * jobs and a new hire never gets them. With a level range on the task, people
 * inside it keep their skill score, people below it lose more (they may not
 * cope) and people above it lose a little (their time is better spent
 * elsewhere). No range, or no level on the person, changes nothing.
 * Folded into the skill score, so it needs no weight of its own.
 */
// Cấp bậc so với khoảng yêu cầu của task: thấp hơn bị trừ nặng (15 điểm/bậc), cao hơn trừ nhẹ (8 điểm/bậc).
export function levelFit(
  level: CareerLevel | null | undefined,
  minLevel: CareerLevel | null | undefined,
  maxLevel: CareerLevel | null | undefined
): LevelFit {
  if (!level || (!minLevel && !maxLevel)) {
    return { fit: "ANY", gap: 0, penalty: 0 };
  }
  const index = CAREER_LEVELS.indexOf(level);
  const under = minLevel ? CAREER_LEVELS.indexOf(minLevel) - index : 0;
  if (under > 0) {
    return {
      fit: "UNDER",
      gap: under,
      penalty: Math.min(MAX_UNDER_LEVEL_PENALTY, under * UNDER_LEVEL_PENALTY)
    };
  }
  const over = maxLevel ? index - CAREER_LEVELS.indexOf(maxLevel) : 0;
  if (over > 0) {
    return {
      fit: "OVER",
      gap: over,
      penalty: Math.min(MAX_OVER_LEVEL_PENALTY, over * OVER_LEVEL_PENALTY)
    };
  }
  return { fit: "FIT", gap: 0, penalty: 0 };
}

/** The skill score after the level fit, still on 0-100. */
// Điểm kỹ năng sau khi trừ điểm lệch cấp bậc.
export function skillScoreWithLevel(skillScore: number, fit: LevelFit) {
  return clampScore(skillScore - fit.penalty);
}

/** Assumed size of an open task nobody estimated. */
export const DEFAULT_TASK_HOURS = 4;

export type OpenTaskLoad = {
  status: string;
  estimatedHours: number | null;
  /** Hours already logged; unknown (undefined) when replaying the past. */
  actualHours?: number | null;
  startDate?: Date | null;
  dueDate?: Date | null;
};

export type WeeklyLoad = {
  /** Work still left on open tasks, whenever it is due. */
  remainingHours: number;
  /** The part of it that lands in the coming week - what capacity is measured against. */
  weeklyHours: number;
  overdueCount: number;
};

/**
 * How much of someone's open work falls in the coming week. Adding up every
 * open estimate against a 40-hour week made a person with one 80-hour task
 * due in two months look overloaded for all of those months; instead:
 *
 * - only what is left counts: the estimate minus hours already logged (at
 *   least an hour while the task is open, since it is not finished);
 * - work handed in for review is done from the assignee's side and adds none;
 * - the rest is spread evenly over the weeks from today (or the start date)
 *   to the due date; overdue or undated work all lands this week, and a task
 *   that only starts after the coming week adds nothing yet.
 */
// Khối lượng việc: số giờ còn lại của task đang mở, và phần rơi vào tuần tới (để so với 40 giờ/tuần).
export function weeklyLoad(tasks: OpenTaskLoad[], today: Date): WeeklyLoad {
  const day = toDayStart(today).getTime();
  const weekEnd = day + 6 * DAY_MS;
  let remainingHours = 0;
  let weeklyHours = 0;
  let overdueCount = 0;

  for (const task of tasks) {
    const due = task.dueDate ? toDayStart(task.dueDate).getTime() : null;
    if (due !== null && due < day && task.status !== "IN_REVIEW") {
      overdueCount += 1;
    }
    if (task.status !== "TODO" && task.status !== "IN_PROGRESS") {
      continue;
    }
    const estimate = task.estimatedHours ?? DEFAULT_TASK_HOURS;
    const remaining = Math.max(1, estimate - (task.actualHours ?? 0));
    remainingHours += remaining;

    const start = task.startDate ? Math.max(day, toDayStart(task.startDate).getTime()) : day;
    if (start > weekEnd) {
      continue;
    }
    if (due === null || due <= weekEnd) {
      weeklyHours += remaining;
      continue;
    }
    const weeks = Math.max(1, Math.ceil((due - start + DAY_MS) / (7 * DAY_MS)));
    weeklyHours += remaining / weeks;
  }

  return {
    remainingHours: roundHours(remainingHours),
    weeklyHours: roundHours(weeklyHours),
    overdueCount
  };
}

function roundHours(value: number) {
  return Math.round(value * 10) / 10;
}

export const skillImportanceWeights: Record<TaskSkillImportance, number> = {
  REQUIRED: 1.5,
  IMPORTANT: 1,
  NICE_TO_HAVE: 0.5
};

const missingSkillScores: Record<TaskSkillImportance, number> = {
  REQUIRED: 0,
  IMPORTANT: 30,
  NICE_TO_HAVE: 60
};

const DAY_MS = 24 * 60 * 60 * 1000;

export type RequiredSkillInput = {
  skillId: number;
  importance: TaskSkillImportance;
  requiredProficiency: SkillProficiency;
  skill: { code: string };
};

export type EmployeeSkillInput = {
  skillId: number;
  proficiency: SkillProficiency;
  yearsExperience?: unknown;
  lastUsedAt?: Date | null;
};

export type SkillAssessment = {
  score: number;
  eligible: boolean;
  matchedSkills: string[];
  missingRequiredSkills: string[];
  missingImportantSkills: string[];
  missingNiceToHaveSkills: string[];
  belowMinimumSkills: string[];
  requiredSkillCount: number;
  matchedRequiredSkillCount: number;
  warnings: string[];
  breakdown: Array<{
    skillId: number;
    code: string;
    importance: TaskSkillImportance;
    requiredProficiency: SkillProficiency;
    actualProficiency: SkillProficiency | null;
    score: number;
  }>;
};

/** `asOf` dates skill recency; the evaluation replays it at assignment time. */
// Điểm kỹ năng: so trình độ thực tế với yêu cầu từng kỹ năng, có trọng số theo mức quan trọng,
// cộng điểm kinh nghiệm, trừ điểm nếu lâu không dùng. Thiếu kỹ năng bắt buộc -> không đủ điều kiện.
export function assessSkills(
  requiredSkills: RequiredSkillInput[],
  employeeSkills: EmployeeSkillInput[],
  asOf: Date = new Date()
): SkillAssessment {
  if (!requiredSkills.length) {
    return {
      score: 70,
      eligible: true,
      matchedSkills: [],
      missingRequiredSkills: [],
      missingImportantSkills: [],
      missingNiceToHaveSkills: [],
      belowMinimumSkills: [],
      requiredSkillCount: 0,
      matchedRequiredSkillCount: 0,
      warnings: ["NO_REQUIRED_SKILLS"],
      breakdown: []
    };
  }

  const employeeSkillById = new Map(employeeSkills.map((skill) => [skill.skillId, skill]));
  const totalWeight = requiredSkills.reduce(
    (total, item) => total + skillImportanceWeights[item.importance],
    0
  );
  const matchedSkills: string[] = [];
  const missingRequiredSkills: string[] = [];
  const missingImportantSkills: string[] = [];
  const missingNiceToHaveSkills: string[] = [];
  const belowMinimumSkills: string[] = [];
  const breakdown: SkillAssessment["breakdown"] = [];
  let matchedRequiredSkillCount = 0;

  const weighted = requiredSkills.reduce((total, required) => {
    const employeeSkill = employeeSkillById.get(required.skillId);
    if (employeeSkill) {
      matchedSkills.push(required.skill.code);
      if (
        required.importance === TaskSkillImportance.REQUIRED &&
        meetsProficiency(employeeSkill.proficiency, required.requiredProficiency)
      ) {
        matchedRequiredSkillCount += 1;
      }
      if (
        required.importance === TaskSkillImportance.REQUIRED &&
        !meetsProficiency(employeeSkill.proficiency, required.requiredProficiency)
      ) {
        belowMinimumSkills.push(required.skill.code);
      }
    } else if (required.importance === TaskSkillImportance.REQUIRED) {
      missingRequiredSkills.push(required.skill.code);
    } else if (required.importance === TaskSkillImportance.IMPORTANT) {
      missingImportantSkills.push(required.skill.code);
    } else {
      missingNiceToHaveSkills.push(required.skill.code);
    }

    const score = employeeSkill
      ? clampScore(
          proficiencyScore(employeeSkill.proficiency, required.requiredProficiency) +
            experienceBonus(Number(employeeSkill.yearsExperience ?? 0)) -
            recencyPenalty(employeeSkill.lastUsedAt, asOf)
        )
      : missingSkillScores[required.importance];
    breakdown.push({
      skillId: required.skillId,
      code: required.skill.code,
      importance: required.importance,
      requiredProficiency: required.requiredProficiency,
      actualProficiency: employeeSkill?.proficiency ?? null,
      score
    });
    return total + score * skillImportanceWeights[required.importance];
  }, 0);

  const warnings = Array.from(
    new Set([
      ...(missingRequiredSkills.length ? ["MISSING_REQUIRED_SKILLS"] : []),
      ...(belowMinimumSkills.length ? ["REQUIRED_SKILL_BELOW_MINIMUM"] : []),
      ...(missingImportantSkills.length ? ["MISSING_IMPORTANT_SKILLS"] : []),
      ...(missingNiceToHaveSkills.length ? ["MISSING_NICE_TO_HAVE_SKILLS"] : [])
    ])
  );
  return {
    score: totalWeight > 0 ? weighted / totalWeight : 0,
    eligible: !missingRequiredSkills.length && !belowMinimumSkills.length,
    matchedSkills,
    missingRequiredSkills,
    missingImportantSkills,
    missingNiceToHaveSkills,
    belowMinimumSkills,
    requiredSkillCount: requiredSkills.filter(
      (skill) => skill.importance === TaskSkillImportance.REQUIRED
    ).length,
    matchedRequiredSkillCount,
    warnings,
    breakdown
  };
}

/**
 * How well a person's level in one skill fits the level the task asks for.
 * An exact fit scores highest. Below it costs a lot - they may not manage the
 * work; above it costs a little - they can do it, but their time is worth
 * more on harder work, and a beginner's task is how a beginner grows. So a
 * task asking for Beginner goes to a beginner before an expert.
 */
// Điểm trình độ: đúng mức yêu cầu hoặc cao hơn thì cao, thấp hơn càng nhiều bậc càng ít điểm.
export function proficiencyScore(actual: SkillProficiency, required: SkillProficiency) {
  const gap = PROFICIENCY_RANK[actual] - PROFICIENCY_RANK[required];
  if (gap >= 0) {
    return OVER_PROFICIENCY_SCORES[Math.min(gap, OVER_PROFICIENCY_SCORES.length - 1)];
  }
  return UNDER_PROFICIENCY_SCORES[Math.min(-gap, UNDER_PROFICIENCY_SCORES.length - 1)];
}

/** Score by how many levels above the requirement: exact, +1, +2, +3. */
const OVER_PROFICIENCY_SCORES = [100, 85, 75, 65];
/** Score by how many levels below it: -, -1, -2, -3. */
const UNDER_PROFICIENCY_SCORES = [100, 50, 25, 10];

// Điểm cộng theo số năm kinh nghiệm.
export function experienceBonus(years: number) {
  if (years >= 4) {
    return 10;
  }
  if (years >= 2) {
    return 7;
  }
  if (years >= 1) {
    return 4;
  }
  return 0;
}

// Điểm trừ khi kỹ năng lâu rồi không dùng.
export function recencyPenalty(lastUsedAt: Date | null | undefined, asOf: Date = new Date()) {
  if (!lastUsedAt) {
    return 0;
  }
  const ageInDays = Math.max(0, (asOf.getTime() - lastUsedAt.getTime()) / DAY_MS);
  if (ageInDays > 2 * 365) {
    return 10;
  }
  return ageInDays > 365 ? 5 : 0;
}

// Trình độ thực tế có đạt yêu cầu không.
export function meetsProficiency(actual: SkillProficiency, required: SkillProficiency) {
  const rank: Record<SkillProficiency, number> = {
    BEGINNER: 0,
    INTERMEDIATE: 1,
    ADVANCED: 2,
    EXPERT: 3
  };
  return rank[actual] >= rank[required];
}

export type LeaveOverlap = {
  /** The task's working days this leave falls on. */
  keys: string[];
  approved: boolean;
  /** A half-day leave takes half of its day. */
  halfDay?: string | null;
};

/**
 * Leave days inside a task's window, split into approved and still-pending.
 * A half day counts 0.5, two halves of one date add up to the whole day, and
 * a day already off on approved leave adds nothing more from a pending one.
 */
// Số ngày làm việc của task bị trùng với ngày nghỉ (nghỉ nửa ngày tính 0.5).
export function leaveOverlapDays(leaves: LeaveOverlap[]) {
  const approved = new Map<string, number>();
  const pending = new Map<string, number>();
  for (const leave of leaves) {
    const share = leave.halfDay ? 0.5 : 1;
    const bucket = leave.approved ? approved : pending;
    for (const key of leave.keys) {
      bucket.set(key, Math.min(1, (bucket.get(key) ?? 0) + share));
    }
  }
  let approvedDays = 0;
  approved.forEach((share) => (approvedDays += share));
  let pendingOnlyDays = 0;
  pending.forEach((share, key) => {
    pendingOnlyDays += Math.max(0, Math.min(share, 1 - (approved.get(key) ?? 0)));
  });
  return { approvedDays, pendingOnlyDays };
}

/** Approved leave costs up to 60 points and pending leave up to 25. */
// Điểm lịch nghỉ = 100 - phạt nghỉ đã duyệt (tối đa 60) - phạt nghỉ đang chờ (tối đa 25), theo tỉ lệ ngày trùng.
export function availabilityScoreFor(
  taskWorkDays: number,
  approvedOverlapWorkDays: number,
  pendingOverlapWorkDays: number
) {
  if (taskWorkDays <= 0) {
    return 100;
  }
  const approvedPenalty = Math.min(60, (approvedOverlapWorkDays / taskWorkDays) * 60);
  const pendingPenalty = Math.min(25, (pendingOverlapWorkDays / taskWorkDays) * 25);
  return clampScore(100 - approvedPenalty - pendingPenalty);
}

/** Open estimated hours against a 40-hour week, minus 10 per overdue task. */
// Điểm khối lượng: còn trống >= 20 giờ/tuần -> 100, >= 10 -> 80, >= 5 -> 60, > 0 -> 40, hết chỗ -> 20;
// trừ thêm 10 điểm cho mỗi task quá hạn.
export function workloadScoreFor(
  totalEstimatedHours: number,
  overdueTaskCount: number,
  capacityHours = WORKLOAD_CAPACITY_HOURS_PER_WEEK
) {
  const availableHours = capacityHours - totalEstimatedHours;
  return Math.max(0, baseWorkloadScore(availableHours) - overdueTaskCount * 10);
}

function baseWorkloadScore(availableHours: number) {
  if (availableHours >= 20) {
    return 100;
  }
  if (availableHours >= 10) {
    return 80;
  }
  if (availableHours >= 5) {
    return 60;
  }
  if (availableHours > 0) {
    return 40;
  }
  return 20;
}

/**
 * Combines the weighted signals, dropping any the candidate has no data for
 * and renormalising what remains so every candidate is scored out of 100.
 */
// Gộp điểm có trọng số; tiêu chí nào ứng viên không có dữ liệu thì bỏ và chia lại theo tổng trọng số còn lại.
export function combineScores(components: Array<{ value: number | null; weight: number }>) {
  const usable = components.filter(
    (component): component is { value: number; weight: number } => component.value !== null
  );
  const totalWeight = usable.reduce((sum, component) => sum + component.weight, 0);
  if (totalWeight <= 0) {
    return 0;
  }
  const weighted = usable.reduce((sum, component) => sum + component.value * component.weight, 0);
  return weighted / totalWeight;
}

/** How many days of recent assignments the fair-share check looks at. */
// Cân bằng công bằng xét số task được giao trong 14 ngày gần đây.
export const FAIR_SHARE_WINDOW_DAYS = 14;
/** Points removed per team share above the average: twice the share costs this much. */
export const FAIR_SHARE_PENALTY = 10;

/**
 * Linear and deliberately uncapped. Someone at 3x the team's share loses 20,
 * and that is the point: in the replay a 10-point cap nearly doubled load
 * imbalance on held-out decisions (0.228 -> 0.430) for no real gain in
 * separation, because a runaway count is exactly what rebalancing is for.
 */
// Điểm trừ theo mức nhận việc vượt trung bình team (gấp đôi trung bình -> trừ 10 điểm).
export function fairSharePenalty(share: number) {
  return FAIR_SHARE_PENALTY * Math.max(0, share - 1);
}

export type FairShare = {
  /** Recent assignments relative to the team average; 1 is exactly average. */
  share: number;
  penalty: number;
};

/**
 * Fair-share rebalancing, applied after ranking rather than folded into the
 * component scores: it is a team-level policy, not a property of the
 * candidate, and keeping it separate means the UI can show it as its own
 * line ("đang nhận gấp 1,8 lần mức trung bình nhóm") and an audit can tell
 * the two apart.
 *
 * Only people above the team average are touched, so the penalty can never
 * promote a candidate the ranking did not already rate.
 */
// Mức nhận việc của từng người so với trung bình team (1 = đúng bằng trung bình).
export function fairShares(recentCounts: Map<number, number>): Map<number, FairShare> {
  const counts = [...recentCounts.values()];
  const average = counts.length
    ? counts.reduce((sum, value) => sum + value, 0) / counts.length
    : 0;
  const shares = new Map<number, FairShare>();

  for (const [employeeId, count] of recentCounts) {
    const share = average > 0 ? count / average : 0;
    shares.set(employeeId, {
      share,
      penalty: fairSharePenalty(share)
    });
  }
  return shares;
}

/**
 * Above this share of the task's workdays already covered by approved leave,
 * a candidate is set aside rather than merely scored down.
 */
// Nghỉ phép đã duyệt quá 50% số ngày làm việc của task -> xếp sau mọi người.
export const LEAVE_BLOCK_THRESHOLD = 0.5;

export type RankableCandidate = {
  eligible: boolean;
  score: number;
  skillScore: number;
  /** Away for most of the task window on already-approved leave. */
  leaveBlocked?: boolean;
};

/**
 * Order: candidates who can do the task, then candidates who will be there
 * to do it, then score, then skill as the tie-break.
 *
 * Leave is a tier rather than points for the same reason missing a required
 * skill is: no amount of track record makes up for not being at work that
 * fortnight, and a manager shown that suggestion stops trusting the rest of
 * the list. Weights decide who is *better*; tiers decide who is *possible*.
 */
// Thứ tự xếp hạng: đủ kỹ năng bắt buộc trước -> không bị chặn vì nghỉ phép -> điểm cao hơn -> điểm kỹ năng cao hơn.
// Trọng số quyết định ai GIỎI HƠN; các tầng quyết định ai CÓ THỂ làm.
export function compareCandidates(left: RankableCandidate, right: RankableCandidate) {
  return (
    Number(right.eligible) - Number(left.eligible) ||
    Number(left.leaveBlocked ?? false) - Number(right.leaveBlocked ?? false) ||
    right.score - left.score ||
    right.skillScore - left.skillScore
  );
}

function clampScore(value: number) {
  return Math.min(Math.max(value, 0), 100);
}
