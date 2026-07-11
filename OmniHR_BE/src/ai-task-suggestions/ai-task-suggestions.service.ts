import { createHash } from "crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import {
  AiTaskSuggestionStatus,
  EmployeeStatus,
  LeaveRequestStatus,
  Prisma,
  SkillProficiency,
  TaskAssignmentType,
  TaskSkillImportance,
  TaskStatus
} from "@prisma/client";
import { ApiError } from "../common/api-error";
import { currentEmployeeWhere } from "../common/prisma-where";
import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { pagination, toDateOnly } from "../common/utils";
import { PrismaService } from "../prisma/prisma.service";
import { TaskWorkloadService, WorkloadSummary } from "../task-workload/task-workload.service";
import { AiTaskSuggestionQueryDto } from "./dto/ai-task-suggestion-query.dto";
import { CancelAiTaskSuggestionDto } from "./dto/cancel-ai-task-suggestion.dto";
import { GenerateAiTaskSuggestionDto } from "./dto/generate-ai-task-suggestion.dto";
import { SelectAiTaskSuggestionDto } from "./dto/select-ai-task-suggestion.dto";

const AI_TASK_ALGORITHM_VERSION = "rule-based-v3";
const AI_SUGGESTION_TTL_MS = 24 * 60 * 60 * 1000;

const scoreWeights = {
  withAvailability: { skill: 0.5, workload: 0.35, availability: 0.15 },
  withoutAvailability: { skill: 0.6, workload: 0.4 }
};

const skillImportanceWeights: Record<TaskSkillImportance, number> = {
  REQUIRED: 1.5,
  IMPORTANT: 1,
  NICE_TO_HAVE: 0.5
};

const missingSkillScores: Record<TaskSkillImportance, number> = {
  REQUIRED: 0,
  IMPORTANT: 30,
  NICE_TO_HAVE: 60
};

const suggestionInclude = {
  task: {
    include: {
      project: true,
      requiredSkills: { include: { skill: true } },
      assignee: { include: { department: true, position: true } }
    }
  },
  requestedByUser: { select: { id: true, username: true, email: true } },
  items: {
    include: {
      employee: { include: { department: true, position: true } }
    },
    orderBy: { rank: "asc" as const }
  }
} satisfies Prisma.AiTaskSuggestionInclude;

type GenerateOptions = {
  limit: number;
  includeAvailability: boolean;
  includeSelf: boolean;
  includePendingLeave: boolean;
};

type TaskWithRequiredSkills = Prisma.TaskGetPayload<{
  include: { requiredSkills: { include: { skill: true } } };
}>;

type EmployeeWithSkills = Prisma.EmployeeGetPayload<{
  include: {
    department: true;
    position: true;
    employeeSkills: { include: { skill: true } };
  };
}>;

type SuggestionForSelect = Prisma.AiTaskSuggestionGetPayload<{
  include: {
    items: true;
    task: { include: { requiredSkills: { include: { skill: true } } } };
  };
}>;

type SkillAssessment = {
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

type AvailabilityAssessment = {
  score: number;
  taskWorkDays: number;
  approvedOverlapWorkDays: number;
  pendingOverlapWorkDays: number;
  hasDateRange: boolean;
  includePendingLeave: boolean;
  warnings: string[];
};

type ScoredCandidate = {
  employeeId: number;
  eligible: boolean;
  score: number;
  skillScore: number;
  workloadScore: number;
  availabilityScore: number;
  performanceScore: null;
  reason: string;
  warnings: string[];
  matchedSkills: string[];
  missingRequiredSkills: string[];
  belowMinimumSkills: string[];
  skillBreakdown: SkillAssessment["breakdown"];
  availability: AvailabilityAssessment;
  workload: WorkloadSummary;
  rank?: number;
};

@Injectable()
export class AiTaskSuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accessControl: AccessControlService,
    private readonly workloadService: TaskWorkloadService
  ) {}

  async generate(
    taskId: number,
    dto: GenerateAiTaskSuggestionDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const options = this.normalizeGenerateOptions(dto);
    await this.accessControl.ensureCanGenerateTaskSuggestion(actor, taskId);
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      include: {
        requiredSkills: { include: { skill: true } }
      }
    });
    if (!task) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Task not found", "TASK_NOT_FOUND");
    }
    this.ensureTaskCanReceiveSuggestion(task);

    let candidateIds = await this.accessControl.candidateEmployeeIdsForTask(actor);
    if (!options.includeSelf && actor.employeeId) {
      candidateIds = candidateIds.filter((candidateId) => candidateId !== actor.employeeId);
    }
    candidateIds = await this.candidateIdsForTask(candidateIds, task.teamId);
    if (!candidateIds.length) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "No candidates available for AI suggestion",
        "AI_SUGGESTION_NO_CANDIDATES"
      );
    }

    const [employees, workloads] = await Promise.all([
      this.prisma.employee.findMany({
        where: currentEmployeeWhere({
          id: { in: candidateIds },
          status: EmployeeStatus.ACTIVE
        }),
        include: {
          department: true,
          position: true,
          employeeSkills: { include: { skill: true } }
        }
      }),
      this.workloadService.summariesForEmployees(candidateIds)
    ]);

    if (!employees.length) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "No candidates available for AI suggestion",
        "AI_SUGGESTION_NO_CANDIDATES"
      );
    }

    const scored = await Promise.all(
      employees.map(async (employee) => {
        const workload = workloads.get(employee.id) ?? this.emptyWorkload(employee.id);
        const skill = this.skillAssessment(task.requiredSkills, employee.employeeSkills);
        const availability = options.includeAvailability
          ? await this.availabilityAssessment(
              employee.id,
              task.startDate,
              task.dueDate,
              options.includePendingLeave
            )
          : this.availabilityNotUsed(options.includePendingLeave);
        const workloadScore = workload.workloadScore;
        const availabilityScore = options.includeAvailability ? availability.score : 100;
        const score = options.includeAvailability
          ? skill.score * scoreWeights.withAvailability.skill +
            workloadScore * scoreWeights.withAvailability.workload +
            availabilityScore * scoreWeights.withAvailability.availability
          : skill.score * scoreWeights.withoutAvailability.skill +
            workloadScore * scoreWeights.withoutAvailability.workload;
        const warnings = this.uniqueWarnings([
          ...skill.warnings,
          ...availability.warnings,
          ...this.workloadWarnings(workload)
        ]);

        return {
          employeeId: employee.id,
          eligible: skill.eligible,
          score: this.round(score),
          skillScore: this.round(skill.score),
          workloadScore: this.round(workloadScore),
          availabilityScore: this.round(availabilityScore),
          performanceScore: null,
          reason: this.reason(employee, skill, workload, availability, options),
          warnings,
          matchedSkills: skill.matchedSkills,
          missingRequiredSkills: skill.missingRequiredSkills,
          belowMinimumSkills: skill.belowMinimumSkills,
          skillBreakdown: skill.breakdown,
          availability,
          workload
        } satisfies ScoredCandidate;
      })
    );

    const items = scored
      .sort(
        (left, right) =>
          Number(right.eligible) - Number(left.eligible) ||
          right.score - left.score ||
          right.skillScore - left.skillScore
      )
      .slice(0, options.limit)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    if (!items.length) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "No candidates available for AI suggestion",
        "AI_SUGGESTION_NO_CANDIDATES"
      );
    }

    const generatedAt = new Date();
    const suggestion = await this.prisma.aiTaskSuggestion.create({
      data: {
        taskId,
        requestedByUserId: actor.id,
        algorithmVersion: AI_TASK_ALGORITHM_VERSION,
        inputSnapshot: this.buildInputSnapshot(
          task,
          options,
          candidateIds,
          items,
          generatedAt
        ),
        items: {
          create: items.map((item) => ({
            employeeId: item.employeeId,
            rank: item.rank,
            score: item.score,
            skillScore: item.skillScore,
            workloadScore: item.workloadScore,
            availabilityScore: item.availabilityScore,
            performanceScore: null,
            reason: item.reason
          }))
        }
      },
      include: suggestionInclude
    });

    await this.audit.log({
      userId: actor.id,
      action: "GENERATE_AI_TASK_SUGGESTION",
      entityType: "AiTaskSuggestion",
      entityId: suggestion.id,
      newValue: suggestion,
      context
    });

    return this.present(suggestion);
  }

  async findAll(query: AiTaskSuggestionQueryDto, user: AuthUser) {
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const where = await this.buildWhere(query, user);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.aiTaskSuggestion.findMany({
        where,
        include: suggestionInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      this.prisma.aiTaskSuggestion.count({ where })
    ]);

    return {
      items: items.map((item) => this.present(item)),
      meta: { total, page, limit }
    };
  }

  async findByTask(taskId: number, user: AuthUser) {
    await this.accessControl.ensureCanReadTask(user, taskId);
    const suggestions = await this.prisma.aiTaskSuggestion.findMany({
      where: { taskId },
      include: suggestionInclude,
      orderBy: { createdAt: "desc" }
    });
    return suggestions.map((item) => this.present(item));
  }

  async findOne(id: number, user: AuthUser) {
    const suggestion = await this.prisma.aiTaskSuggestion.findUnique({
      where: { id },
      include: suggestionInclude
    });
    if (!suggestion) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "AI task suggestion not found",
        "AI_TASK_SUGGESTION_NOT_FOUND"
      );
    }
    await this.accessControl.ensureCanReadTask(user, suggestion.taskId);
    return this.present(suggestion);
  }

  async select(
    id: number,
    dto: SelectAiTaskSuggestionDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const suggestion = await this.prisma.aiTaskSuggestion.findUnique({
      where: { id },
      include: {
        items: true,
        task: { include: { requiredSkills: { include: { skill: true } } } }
      }
    });
    if (!suggestion) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "AI task suggestion not found",
        "AI_TASK_SUGGESTION_NOT_FOUND"
      );
    }

    await this.ensureSuggestionCanBeSelected(suggestion);

    const item = suggestion.items.find((candidate) => candidate.id === dto.suggestionItemId);
    if (!item) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "AI task suggestion item not found",
        "AI_TASK_SUGGESTION_ITEM_NOT_FOUND"
      );
    }

    await this.accessControl.ensureCanAssignTask(actor, suggestion.taskId, item.employeeId);
    await this.ensureAssigneeInTaskTeam(suggestion.task.teamId, item.employeeId);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.aiTaskSuggestionItem.updateMany({
        where: { suggestionId: id },
        data: { selected: false }
      });
      await tx.aiTaskSuggestionItem.update({
        where: { id: item.id },
        data: { selected: true }
      });
      await tx.aiTaskSuggestion.update({
        where: { id },
        data: { status: AiTaskSuggestionStatus.SELECTED }
      });
      await tx.task.update({
        where: { id: suggestion.taskId },
        data: { assigneeId: item.employeeId, assignedByUserId: actor.id }
      });
      await tx.taskAssignment.create({
        data: {
          taskId: suggestion.taskId,
          assigneeId: item.employeeId,
          assignedByUserId: actor.id,
          assignmentType: TaskAssignmentType.AI_SUGGESTED,
          note: dto.note
        }
      });

      return tx.aiTaskSuggestion.findUniqueOrThrow({
        where: { id },
        include: suggestionInclude
      });
    });

    await this.audit.log({
      userId: actor.id,
      action: "SELECT_AI_TASK_SUGGESTION",
      entityType: "AiTaskSuggestion",
      entityId: id,
      newValue: { suggestionItemId: item.id, employeeId: item.employeeId },
      context
    });
    await this.audit.log({
      userId: actor.id,
      action: "ASSIGN_TASK",
      entityType: "Task",
      entityId: suggestion.taskId,
      newValue: {
        assigneeId: item.employeeId,
        assignmentType: TaskAssignmentType.AI_SUGGESTED
      },
      context
    });

    return this.present(updated);
  }

  async cancel(
    id: number,
    dto: CancelAiTaskSuggestionDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const suggestion = await this.prisma.aiTaskSuggestion.findUnique({
      where: { id },
      include: suggestionInclude
    });
    if (!suggestion) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "AI task suggestion not found",
        "AI_TASK_SUGGESTION_NOT_FOUND"
      );
    }

    await this.accessControl.ensureCanReadTask(actor, suggestion.taskId);

    if (suggestion.status === AiTaskSuggestionStatus.SELECTED) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Selected AI suggestion cannot be cancelled",
        "AI_SUGGESTION_ALREADY_SELECTED"
      );
    }

    if (
      suggestion.status === AiTaskSuggestionStatus.CANCELLED ||
      suggestion.status === AiTaskSuggestionStatus.EXPIRED
    ) {
      return this.present(suggestion);
    }

    const updated = (await this.prisma.aiTaskSuggestion.update({
      where: { id },
      data: {
        status: AiTaskSuggestionStatus.CANCELLED,
        inputSnapshot: this.mergeSnapshot(suggestion.inputSnapshot, {
          cancelledAt: new Date().toISOString(),
          cancelledByUserId: actor.id,
          cancelReason: dto.reason ?? null
        })
      },
      include: suggestionInclude
    })) as Prisma.AiTaskSuggestionGetPayload<{ include: typeof suggestionInclude }>;

    await this.audit.log({
      userId: actor.id,
      action: "CANCEL_AI_TASK_SUGGESTION",
      entityType: "AiTaskSuggestion",
      entityId: id,
      oldValue: { status: suggestion.status },
      newValue: { status: updated.status, reason: dto.reason ?? null },
      context
    });

    return this.present(updated);
  }

  private async buildWhere(query: AiTaskSuggestionQueryDto, user: AuthUser) {
    const base: Prisma.AiTaskSuggestionWhereInput = {
      taskId: query.taskId,
      status: query.status,
      task: { deletedAt: null }
    };

    if (this.accessControl.isAdmin(user)) {
      return base;
    }

    const teamIds = await this.accessControl.teamEmployeeIds(user);
    return {
      AND: [
        base,
        {
          OR: [
            { requestedByUserId: user.id },
            { task: { assigneeId: { in: teamIds } } },
            { task: { createdByUserId: user.id } }
          ]
        }
      ]
    };
  }

  private present(
    suggestion: Prisma.AiTaskSuggestionGetPayload<{ include: typeof suggestionInclude }>
  ) {
    const snapshot = this.snapshotObject(suggestion.inputSnapshot);
    const itemDetails = this.snapshotItemsByEmployeeId(snapshot);

    return {
      suggestionId: suggestion.id,
      id: suggestion.id,
      taskId: suggestion.taskId,
      task: suggestion.task,
      requestedByUser: suggestion.requestedByUser,
      algorithmVersion: suggestion.algorithmVersion,
      status: suggestion.status,
      createdAt: suggestion.createdAt,
      expiresAt: this.snapshotString(snapshot, "expiresAt"),
      inputSnapshot: suggestion.inputSnapshot,
      items: suggestion.items.map((item) => {
        const details = itemDetails.get(item.employeeId) ?? {};
        return {
          suggestionItemId: item.id,
          id: item.id,
          employeeId: item.employeeId,
          employeeCode: item.employee.employeeCode,
          employee: item.employee,
          fullName: item.employee.fullName,
          departmentName: item.employee.department?.name ?? null,
          positionName: item.employee.position?.name ?? null,
          rank: item.rank,
          score: Number(item.score),
          skillScore: item.skillScore === null ? null : Number(item.skillScore),
          workloadScore: item.workloadScore === null ? null : Number(item.workloadScore),
          availabilityScore:
            item.availabilityScore === null ? null : Number(item.availabilityScore),
          performanceScore: item.performanceScore ? Number(item.performanceScore) : null,
          reason: item.reason,
          eligible: typeof details.eligible === "boolean" ? details.eligible : true,
          warnings: this.stringArray(details.warnings),
          matchedSkills: this.stringArray(details.matchedSkills),
          missingRequiredSkills: this.stringArray(details.missingRequiredSkills),
          missingImportantSkills: this.stringArray(details.missingImportantSkills),
          missingNiceToHaveSkills: this.stringArray(details.missingNiceToHaveSkills),
          belowMinimumSkills: this.stringArray(details.belowMinimumSkills),
          skillBreakdown: Array.isArray(details.skillBreakdown)
            ? details.skillBreakdown
            : [],
          selected: item.selected
        };
      })
    };
  }

  private normalizeGenerateOptions(dto: GenerateAiTaskSuggestionDto): GenerateOptions {
    return {
      limit: dto.limit ?? 5,
      includeAvailability: dto.includeAvailability ?? true,
      includeSelf: dto.includeSelf ?? false,
      includePendingLeave: dto.includePendingLeave ?? true
    };
  }

  private ensureTaskCanReceiveSuggestion(
    task: Pick<TaskWithRequiredSkills, "parentTaskId" | "status" | "deletedAt">
  ) {
    if (!task.parentTaskId) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "AI assignment suggestions are only available for subtasks",
        "AI_SUGGESTION_SUBTASK_REQUIRED"
      );
    }
    if (task.deletedAt || task.status === TaskStatus.DONE || task.status === TaskStatus.CANCELLED) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Cannot generate AI suggestion for closed task",
        "AI_SUGGESTION_TASK_CLOSED"
      );
    }
  }

  private async ensureSuggestionCanBeSelected(suggestion: SuggestionForSelect) {
    if (suggestion.status === AiTaskSuggestionStatus.SELECTED) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "AI suggestion already selected",
        "AI_SUGGESTION_ALREADY_SELECTED"
      );
    }
    if (suggestion.status === AiTaskSuggestionStatus.CANCELLED) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "AI suggestion has been cancelled",
        "AI_SUGGESTION_CANCELLED"
      );
    }
    if (suggestion.status === AiTaskSuggestionStatus.EXPIRED) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "AI suggestion has expired",
        "AI_SUGGESTION_EXPIRED"
      );
    }

    if (
      suggestion.task.deletedAt ||
      suggestion.task.status === TaskStatus.DONE ||
      suggestion.task.status === TaskStatus.CANCELLED
    ) {
      await this.expireSuggestion(suggestion.id);
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "AI suggestion has expired because the task is closed",
        "AI_SUGGESTION_EXPIRED"
      );
    }

    const snapshot = this.snapshotObject(suggestion.inputSnapshot);
    const expiresAt = this.snapshotString(snapshot, "expiresAt");
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      await this.expireSuggestion(suggestion.id);
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "AI suggestion has expired",
        "AI_SUGGESTION_EXPIRED"
      );
    }

    const taskFingerprint = this.snapshotString(snapshot, "taskFingerprint");
    if (taskFingerprint && taskFingerprint !== this.taskFingerprint(suggestion.task)) {
      await this.expireSuggestion(suggestion.id);
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "AI suggestion has expired because the task changed",
        "AI_SUGGESTION_EXPIRED"
      );
    }
  }

  private async expireSuggestion(id: number) {
    await this.prisma.aiTaskSuggestion.update({
      where: { id },
      data: { status: AiTaskSuggestionStatus.EXPIRED }
    });
  }

  private skillAssessment(
    requiredSkills: TaskWithRequiredSkills["requiredSkills"],
    employeeSkills: EmployeeWithSkills["employeeSkills"]
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
          this.meetsProficiency(employeeSkill.proficiency, required.requiredProficiency)
        ) {
          matchedRequiredSkillCount += 1;
        }
        if (
          required.importance === TaskSkillImportance.REQUIRED &&
          !this.meetsProficiency(employeeSkill.proficiency, required.requiredProficiency)
        ) {
          belowMinimumSkills.push(required.skill.code);
        }
      } else {
        if (required.importance === TaskSkillImportance.REQUIRED) {
          missingRequiredSkills.push(required.skill.code);
        } else if (required.importance === TaskSkillImportance.IMPORTANT) {
          missingImportantSkills.push(required.skill.code);
        } else {
          missingNiceToHaveSkills.push(required.skill.code);
        }
      }

      const score = employeeSkill
        ? this.clamp(
            this.proficiencyScore(employeeSkill.proficiency, required.requiredProficiency) +
              this.experienceBonus(Number(employeeSkill.yearsExperience ?? 0)) -
              this.recencyPenalty(employeeSkill.lastUsedAt)
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

    const warnings = this.uniqueWarnings([
      ...(missingRequiredSkills.length ? ["MISSING_REQUIRED_SKILLS"] : []),
      ...(belowMinimumSkills.length ? ["REQUIRED_SKILL_BELOW_MINIMUM"] : []),
      ...(missingImportantSkills.length ? ["MISSING_IMPORTANT_SKILLS"] : []),
      ...(missingNiceToHaveSkills.length ? ["MISSING_NICE_TO_HAVE_SKILLS"] : [])
    ]);
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

  private proficiencyScore(actual: SkillProficiency, required: SkillProficiency) {
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

  private experienceBonus(years: number) {
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

  private recencyPenalty(lastUsedAt?: Date | null) {
    if (!lastUsedAt) {
      return 0;
    }
    const ageInDays = Math.max(0, (Date.now() - lastUsedAt.getTime()) / (24 * 60 * 60 * 1000));
    if (ageInDays > 2 * 365) {
      return 10;
    }
    return ageInDays > 365 ? 5 : 0;
  }

  private meetsProficiency(actual: SkillProficiency, required: SkillProficiency) {
    const rank: Record<SkillProficiency, number> = {
      BEGINNER: 0,
      INTERMEDIATE: 1,
      ADVANCED: 2,
      EXPERT: 3
    };
    return rank[actual] >= rank[required];
  }

  private async availabilityAssessment(
    employeeId: number,
    startDate?: Date | null,
    dueDate?: Date | null,
    includePendingLeave = true
  ): Promise<AvailabilityAssessment> {
    const range = this.taskDateRange(startDate, dueDate);
    if (!range) {
      return {
        score: 100,
        taskWorkDays: 0,
        approvedOverlapWorkDays: 0,
        pendingOverlapWorkDays: 0,
        hasDateRange: false,
        includePendingLeave,
        warnings: ["TASK_DATE_RANGE_MISSING"]
      };
    }

    const taskWorkDays = this.workdayKeysBetween(range.from, range.to).length;
    if (!taskWorkDays) {
      return {
        score: 100,
        taskWorkDays: 0,
        approvedOverlapWorkDays: 0,
        pendingOverlapWorkDays: 0,
        hasDateRange: true,
        includePendingLeave,
        warnings: ["TASK_HAS_NO_WORKDAYS"]
      };
    }

    const statuses = includePendingLeave
      ? [LeaveRequestStatus.APPROVED, LeaveRequestStatus.PENDING]
      : [LeaveRequestStatus.APPROVED];
    const leaves = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: { in: statuses },
        startDate: { lte: range.to },
        endDate: { gte: range.from }
      },
      select: { startDate: true, endDate: true, status: true }
    });

    const approvedDays = new Set<string>();
    const pendingDays = new Set<string>();
    for (const leave of leaves) {
      const keys = this.overlapWorkdayKeys(
        leave.startDate,
        leave.endDate,
        range.from,
        range.to
      );
      const bucket =
        leave.status === LeaveRequestStatus.APPROVED ? approvedDays : pendingDays;
      keys.forEach((key) => bucket.add(key));
    }

    const approvedOverlapWorkDays = approvedDays.size;
    const pendingOverlapWorkDays = Array.from(pendingDays).filter(
      (key) => !approvedDays.has(key)
    ).length;
    const approvedPenalty = Math.min(
      60,
      (approvedOverlapWorkDays / taskWorkDays) * 60
    );
    const pendingPenalty = Math.min(
      25,
      (pendingOverlapWorkDays / taskWorkDays) * 25
    );
    const score = this.clamp(100 - approvedPenalty - pendingPenalty, 0, 100);
    const warnings: string[] = [];
    if (approvedOverlapWorkDays > 0) {
      warnings.push("APPROVED_LEAVE_OVERLAP");
    }
    if (pendingOverlapWorkDays > 0) {
      warnings.push("PENDING_LEAVE_OVERLAP");
    }

    return {
      score: this.round(score),
      taskWorkDays,
      approvedOverlapWorkDays,
      pendingOverlapWorkDays,
      hasDateRange: true,
      includePendingLeave,
      warnings
    };
  }

  private availabilityNotUsed(includePendingLeave: boolean): AvailabilityAssessment {
    return {
      score: 100,
      taskWorkDays: 0,
      approvedOverlapWorkDays: 0,
      pendingOverlapWorkDays: 0,
      hasDateRange: false,
      includePendingLeave,
      warnings: []
    };
  }

  private async ensureAssigneeInTaskTeam(
    teamId: number | null | undefined,
    employeeId: number
  ) {
    if (!teamId) {
      return;
    }

    const membership = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        employeeId,
        isActive: true,
        employee: currentEmployeeWhere({ status: EmployeeStatus.ACTIVE })
      },
      select: { id: true }
    });
    if (!membership) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Task assignee must belong to selected team",
        "VALIDATION_ERROR"
      );
    }
  }

  private async candidateIdsForTask(
    candidateIds: number[],
    teamId: number | null | undefined
  ) {
    if (!teamId) {
      return candidateIds;
    }

    const team = await this.prisma.team.findFirst({
      where: { id: teamId, deletedAt: null, isActive: true },
      select: {
        leadId: true,
        members: {
          where: {
            isActive: true,
            employeeId: { in: candidateIds },
            employee: currentEmployeeWhere({ status: EmployeeStatus.ACTIVE })
          },
          select: { employeeId: true }
        }
      }
    });
    if (!team) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Team not found", "TEAM_NOT_FOUND");
    }

    const teamCandidateIds = new Set(team.members.map((member) => member.employeeId));
    if (team.leadId && candidateIds.includes(team.leadId)) {
      teamCandidateIds.add(team.leadId);
    }

    return candidateIds.filter((candidateId) => teamCandidateIds.has(candidateId));
  }

  private reason(
    employee: Pick<EmployeeWithSkills, "fullName">,
    skill: SkillAssessment,
    workload: WorkloadSummary,
    availability: AvailabilityAssessment,
    options: GenerateOptions
  ) {
    const skillText = this.skillReason(skill);
    const workloadText = `${workload.activeTaskCount} task active, còn ${workload.availableHours}h khả dụng/tuần`;
    const availabilityText = options.includeAvailability
      ? this.availabilityReason(availability)
      : "không dùng lịch nghỉ trong lần chấm điểm này";
    return `${employee.fullName}: ${skillText}; ${workloadText}; ${availabilityText}.`;
  }

  private skillReason(skill: SkillAssessment) {
    if (!skill.requiredSkillCount && !skill.matchedSkills.length) {
      return "task chưa khai báo kỹ năng yêu cầu nên độ tin cậy thấp";
    }

    const parts: string[] = [];
    if (skill.matchedSkills.length) {
      parts.push(`khớp ${skill.matchedSkills.join(", ")}`);
    }
    if (skill.requiredSkillCount) {
      parts.push(
        `đạt ${skill.matchedRequiredSkillCount}/${skill.requiredSkillCount} kỹ năng bắt buộc`
      );
    }
    if (skill.missingRequiredSkills.length) {
      parts.push(`thiếu kỹ năng bắt buộc ${skill.missingRequiredSkills.join(", ")}`);
    }
    if (skill.belowMinimumSkills.length) {
      parts.push(`dưới mức tối thiểu ${skill.belowMinimumSkills.join(", ")}`);
    }
    if (skill.missingImportantSkills.length) {
      parts.push(`thiếu kỹ năng quan trọng ${skill.missingImportantSkills.join(", ")}`);
    }
    if (skill.missingNiceToHaveSkills.length) {
      parts.push(`thiếu kỹ năng ưu tiên thêm ${skill.missingNiceToHaveSkills.join(", ")}`);
    }
    return `${skill.eligible ? "đủ điều kiện" : "phương án dự phòng"}; ${parts.join("; ")}`;

    /*
    const matched = skill.matchedSkills.length
      ? `khớp ${skill.matchedRequiredSkillCount}/${skill.requiredSkillCount} kỹ năng bắt buộc (${skill.matchedSkills.join(", ")})`
      : `chưa khớp kỹ năng bắt buộc nào`;
    const missing = skill.missingRequiredSkills.length
      ? `, thiếu/chưa khai báo ${skill.missingRequiredSkills.join(", ")}`
      : "";
    return `${matched}${missing}`;
    */
  }

  private availabilityReason(availability: AvailabilityAssessment) {
    if (!availability.hasDateRange) {
      return "task chưa có đủ ngày bắt đầu/kết thúc nên tạm coi là sẵn sàng";
    }
    if (!availability.approvedOverlapWorkDays && !availability.pendingOverlapWorkDays) {
      return "không trùng lịch nghỉ trong khoảng task";
    }

    const parts: string[] = [];
    if (availability.approvedOverlapWorkDays) {
      parts.push(`trùng ${availability.approvedOverlapWorkDays} ngày nghỉ đã duyệt`);
    }
    if (availability.pendingOverlapWorkDays) {
      parts.push(`trùng ${availability.pendingOverlapWorkDays} ngày nghỉ chờ duyệt`);
    }
    return parts.join(", ");
  }

  private workloadWarnings(workload: WorkloadSummary) {
    const warnings: string[] = [];
    if (workload.availableHours <= 0) {
      warnings.push("NO_AVAILABLE_CAPACITY");
    }
    if (workload.overdueTaskCount > 0) {
      warnings.push("HAS_OVERDUE_TASKS");
    }
    return warnings;
  }

  private emptyWorkload(employeeId: number): WorkloadSummary {
    return {
      employeeId,
      activeTaskCount: 0,
      totalEstimatedHours: 0,
      overdueTaskCount: 0,
      capacityHoursPerWeek: 40,
      availableHours: 40,
      workloadScore: 100
    };
  }

  private buildInputSnapshot(
    task: TaskWithRequiredSkills,
    options: GenerateOptions,
    candidateIds: number[],
    items: Array<ScoredCandidate & { rank: number }>,
    generatedAt: Date
  ) {
    return {
      algorithmVersion: AI_TASK_ALGORITHM_VERSION,
      generatedAt: generatedAt.toISOString(),
      expiresAt: new Date(generatedAt.getTime() + AI_SUGGESTION_TTL_MS).toISOString(),
      taskFingerprint: this.taskFingerprint(task),
      task: this.taskFingerprintPayload(task),
      options,
      weights: options.includeAvailability
        ? scoreWeights.withAvailability
        : scoreWeights.withoutAvailability,
      candidateIds,
      requiredSkills: this.requiredSkillSnapshot(task),
      items: items.map((item) => ({
        employeeId: item.employeeId,
        rank: item.rank,
        score: item.score,
        skillScore: item.skillScore,
        workloadScore: item.workloadScore,
        availabilityScore: item.availabilityScore,
        performanceScore: item.performanceScore,
        warnings: item.warnings,
        eligible: item.eligible,
        matchedSkills: item.matchedSkills,
        missingRequiredSkills: item.missingRequiredSkills,
        missingImportantSkills: item.skillBreakdown
          .filter(
            (skill) =>
              skill.importance === TaskSkillImportance.IMPORTANT &&
              skill.actualProficiency === null
          )
          .map((skill) => skill.code),
        missingNiceToHaveSkills: item.skillBreakdown
          .filter(
            (skill) =>
              skill.importance === TaskSkillImportance.NICE_TO_HAVE &&
              skill.actualProficiency === null
          )
          .map((skill) => skill.code),
        belowMinimumSkills: item.belowMinimumSkills,
        skillBreakdown: item.skillBreakdown,
        availability: item.availability,
        workload: {
          activeTaskCount: item.workload.activeTaskCount,
          totalEstimatedHours: item.workload.totalEstimatedHours,
          overdueTaskCount: item.workload.overdueTaskCount,
          capacityHoursPerWeek: item.workload.capacityHoursPerWeek,
          availableHours: item.workload.availableHours,
          workloadScore: item.workload.workloadScore
        }
      }))
    };
  }

  private requiredSkillSnapshot(task: TaskWithRequiredSkills) {
    return task.requiredSkills
      .map((item) => ({
        skillId: item.skillId,
        code: item.skill.code,
        name: item.skill.name,
        importance: item.importance,
        weight: skillImportanceWeights[item.importance],
        requiredProficiency: item.requiredProficiency,
        isRequired: item.importance === TaskSkillImportance.REQUIRED
      }))
      .sort((left, right) => left.skillId - right.skillId);
  }

  private taskFingerprint(task: TaskWithRequiredSkills) {
    return createHash("sha256")
      .update(JSON.stringify(this.taskFingerprintPayload(task)))
      .digest("hex");
  }

  private taskFingerprintPayload(task: TaskWithRequiredSkills) {
    return {
      taskId: task.id,
      projectId: task.projectId,
      departmentId: task.departmentId,
      teamId: task.teamId,
      assigneeId: task.assigneeId,
      startDate: this.dateKeyOrNull(task.startDate),
      dueDate: this.dateKeyOrNull(task.dueDate),
      estimatedHours: task.estimatedHours === null ? null : Number(task.estimatedHours),
      priority: task.priority,
      status: task.status,
      requiredSkills: this.requiredSkillSnapshot(task)
    };
  }

  private mergeSnapshot(
    snapshot: unknown,
    patch: Record<string, Prisma.InputJsonValue | null>
  ): Prisma.InputJsonObject {
    return {
      ...this.snapshotObject(snapshot),
      ...patch
    } as Prisma.InputJsonObject;
  }

  private snapshotObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private snapshotString(snapshot: Record<string, unknown>, key: string) {
    const value = snapshot[key];
    return typeof value === "string" ? value : null;
  }

  private snapshotItemsByEmployeeId(snapshot: Record<string, unknown>) {
    const items = Array.isArray(snapshot.items) ? snapshot.items : [];
    const map = new Map<number, Record<string, unknown>>();
    for (const value of items) {
      const item = this.snapshotObject(value);
      const employeeId = Number(item.employeeId);
      if (Number.isInteger(employeeId)) {
        map.set(employeeId, item);
      }
    }
    return map;
  }

  private stringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  }

  private uniqueWarnings(warnings: string[]) {
    return Array.from(new Set(warnings));
  }

  private taskDateRange(startDate?: Date | null, dueDate?: Date | null) {
    if (!startDate && !dueDate) {
      return null;
    }

    const from = toDateOnly(startDate ?? dueDate ?? new Date());
    const to = toDateOnly(dueDate ?? startDate ?? new Date());
    return from <= to ? { from, to } : { from: to, to: from };
  }

  private overlapWorkdayKeys(
    leaveStart: Date,
    leaveEnd: Date,
    rangeStart: Date,
    rangeEnd: Date
  ) {
    const from = leaveStart > rangeStart ? toDateOnly(leaveStart) : toDateOnly(rangeStart);
    const to = leaveEnd < rangeEnd ? toDateOnly(leaveEnd) : toDateOnly(rangeEnd);
    return this.workdayKeysBetween(from, to);
  }

  private workdayKeysBetween(startDate: Date, endDate: Date) {
    const keys: string[] = [];
    const current = toDateOnly(startDate);
    const end = toDateOnly(endDate);
    while (current <= end) {
      const day = current.getUTCDay();
      if (day !== 0 && day !== 6) {
        keys.push(this.dateKey(current));
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return keys;
  }

  private dateKeyOrNull(value?: Date | null) {
    return value ? this.dateKey(value) : null;
  }

  private dateKey(value: Date) {
    return toDateOnly(value).toISOString().slice(0, 10);
  }

  private clamp(value: number, min = 0, max = 100) {
    return Math.min(Math.max(value, min), max);
  }

  private round(value: number) {
    return Math.round(value * 100) / 100;
  }
}
