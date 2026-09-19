import { SkillProficiency, TaskSkillImportance } from "@prisma/client";

/**
 * Pure scoring for AI assignee suggestions. The service feeds it live data;
 * prisma/evaluate-suggestions.ts replays it against history. Keeping one copy
 * means the offline evaluation measures exactly what the API ranks with.
 */

export const SCORE_WEIGHTS = {
  withAvailability: { skill: 0.5, workload: 0.35, availability: 0.15 },
  withoutAvailability: { skill: 0.6, workload: 0.4 }
};

// Past performance is an extra term on top of the weights above rather than a
// redistribution of them, so a candidate with no finalized review scores
// exactly as they did before this signal existed - new hires are not penalised
// for having no history.
export const PERFORMANCE_WEIGHT = 0.2;

// Only the most recent cycles count, so one weak quarter years ago does not
// follow someone forever.
export const PERFORMANCE_REVIEW_WINDOW = 3;

export const WORKLOAD_CAPACITY_HOURS_PER_WEEK = 40;

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

export function proficiencyScore(actual: SkillProficiency, required: SkillProficiency) {
  const scoreByLevel: Record<SkillProficiency, number> = {
    BEGINNER: 40,
    INTERMEDIATE: 65,
    ADVANCED: 85,
    EXPERT: 100
  };
  const levels: SkillProficiency[] = [
    SkillProficiency.BEGINNER,
    SkillProficiency.INTERMEDIATE,
    SkillProficiency.ADVANCED,
    SkillProficiency.EXPERT
  ];
  const actualScore = scoreByLevel[actual];
  const gap = levels.indexOf(required) - levels.indexOf(actual);
  return gap <= 0 ? actualScore : Math.max(0, actualScore - (gap === 1 ? 15 : 30));
}

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

export function meetsProficiency(actual: SkillProficiency, required: SkillProficiency) {
  const rank: Record<SkillProficiency, number> = {
    BEGINNER: 0,
    INTERMEDIATE: 1,
    ADVANCED: 2,
    EXPERT: 3
  };
  return rank[actual] >= rank[required];
}

/** Approved leave costs up to 60 points and pending leave up to 25. */
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
export function workloadScoreFor(totalEstimatedHours: number, overdueTaskCount: number) {
  const availableHours = WORKLOAD_CAPACITY_HOURS_PER_WEEK - totalEstimatedHours;
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

/** Ratings newest first; a 1-5 average maps onto 0-100, no reviews gives null. */
export function performanceFromRatings(ratings: number[]) {
  const recent = ratings.slice(0, PERFORMANCE_REVIEW_WINDOW);
  if (!recent.length) {
    return { score: null, averageRating: null, reviewCount: 0 };
  }
  const averageRating = recent.reduce((sum, rating) => sum + rating, 0) / recent.length;
  return { score: ((averageRating - 1) / 4) * 100, averageRating, reviewCount: recent.length };
}

/**
 * Combines the weighted signals, dropping any the candidate has no data for
 * and renormalising what remains so every candidate is scored out of 100.
 */
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

/** Eligible candidates first, then total score, then skill score. */
export function compareCandidates(
  left: { eligible: boolean; score: number; skillScore: number },
  right: { eligible: boolean; score: number; skillScore: number }
) {
  return (
    Number(right.eligible) - Number(left.eligible) ||
    right.score - left.score ||
    right.skillScore - left.skillScore
  );
}

function clampScore(value: number) {
  return Math.min(Math.max(value, 0), 100);
}
