"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiTaskSuggestionsService = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const api_error_1 = require("../common/api-error");
const prisma_where_1 = require("../common/prisma-where");
const access_control_service_1 = require("../common/services/access-control.service");
const audit_service_1 = require("../common/services/audit.service");
const utils_1 = require("../common/utils");
const prisma_service_1 = require("../prisma/prisma.service");
const task_workload_service_1 = require("../task-workload/task-workload.service");
const AI_TASK_ALGORITHM_VERSION = "rule-based-v3";
const AI_SUGGESTION_TTL_MS = 24 * 60 * 60 * 1000;
const scoreWeights = {
    withAvailability: { skill: 0.5, workload: 0.35, availability: 0.15 },
    withoutAvailability: { skill: 0.6, workload: 0.4 }
};
const skillImportanceWeights = {
    REQUIRED: 1.5,
    IMPORTANT: 1,
    NICE_TO_HAVE: 0.5
};
const missingSkillScores = {
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
        orderBy: { rank: "asc" }
    }
};
let AiTaskSuggestionsService = class AiTaskSuggestionsService {
    prisma;
    audit;
    accessControl;
    workloadService;
    constructor(prisma, audit, accessControl, workloadService) {
        this.prisma = prisma;
        this.audit = audit;
        this.accessControl = accessControl;
        this.workloadService = workloadService;
    }
    async generate(taskId, dto, actor, context) {
        const options = this.normalizeGenerateOptions(dto);
        await this.accessControl.ensureCanGenerateTaskSuggestion(actor, taskId);
        const task = await this.prisma.task.findFirst({
            where: { id: taskId, deletedAt: null },
            include: {
                requiredSkills: { include: { skill: true } }
            }
        });
        if (!task) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Task not found", "TASK_NOT_FOUND");
        }
        this.ensureTaskCanReceiveSuggestion(task);
        let candidateIds = await this.accessControl.candidateEmployeeIdsForTask(actor);
        if (!options.includeSelf && actor.employeeId) {
            candidateIds = candidateIds.filter((candidateId) => candidateId !== actor.employeeId);
        }
        candidateIds = await this.candidateIdsForTask(candidateIds, task.teamId);
        if (!candidateIds.length) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "No candidates available for AI suggestion", "AI_SUGGESTION_NO_CANDIDATES");
        }
        const [employees, workloads] = await Promise.all([
            this.prisma.employee.findMany({
                where: (0, prisma_where_1.currentEmployeeWhere)({
                    id: { in: candidateIds },
                    status: client_1.EmployeeStatus.ACTIVE
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
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "No candidates available for AI suggestion", "AI_SUGGESTION_NO_CANDIDATES");
        }
        const scored = await Promise.all(employees.map(async (employee) => {
            const workload = workloads.get(employee.id) ?? this.emptyWorkload(employee.id);
            const skill = this.skillAssessment(task.requiredSkills, employee.employeeSkills);
            const availability = options.includeAvailability
                ? await this.availabilityAssessment(employee.id, task.startDate, task.dueDate, options.includePendingLeave)
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
            };
        }));
        const items = scored
            .sort((left, right) => Number(right.eligible) - Number(left.eligible) ||
            right.score - left.score ||
            right.skillScore - left.skillScore)
            .slice(0, options.limit)
            .map((item, index) => ({ ...item, rank: index + 1 }));
        if (!items.length) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "No candidates available for AI suggestion", "AI_SUGGESTION_NO_CANDIDATES");
        }
        const generatedAt = new Date();
        const suggestion = await this.prisma.aiTaskSuggestion.create({
            data: {
                taskId,
                requestedByUserId: actor.id,
                algorithmVersion: AI_TASK_ALGORITHM_VERSION,
                inputSnapshot: this.buildInputSnapshot(task, options, candidateIds, items, generatedAt),
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
    async findAll(query, user) {
        const { skip, take, page, limit } = (0, utils_1.pagination)(query.page, query.limit);
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
    async findByTask(taskId, user) {
        await this.accessControl.ensureCanReadTask(user, taskId);
        const suggestions = await this.prisma.aiTaskSuggestion.findMany({
            where: { taskId },
            include: suggestionInclude,
            orderBy: { createdAt: "desc" }
        });
        return suggestions.map((item) => this.present(item));
    }
    async findOne(id, user) {
        const suggestion = await this.prisma.aiTaskSuggestion.findUnique({
            where: { id },
            include: suggestionInclude
        });
        if (!suggestion) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "AI task suggestion not found", "AI_TASK_SUGGESTION_NOT_FOUND");
        }
        await this.accessControl.ensureCanReadTask(user, suggestion.taskId);
        return this.present(suggestion);
    }
    async select(id, dto, actor, context) {
        const suggestion = await this.prisma.aiTaskSuggestion.findUnique({
            where: { id },
            include: {
                items: true,
                task: { include: { requiredSkills: { include: { skill: true } } } }
            }
        });
        if (!suggestion) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "AI task suggestion not found", "AI_TASK_SUGGESTION_NOT_FOUND");
        }
        await this.ensureSuggestionCanBeSelected(suggestion);
        const item = suggestion.items.find((candidate) => candidate.id === dto.suggestionItemId);
        if (!item) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "AI task suggestion item not found", "AI_TASK_SUGGESTION_ITEM_NOT_FOUND");
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
                data: { status: client_1.AiTaskSuggestionStatus.SELECTED }
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
                    assignmentType: client_1.TaskAssignmentType.AI_SUGGESTED,
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
                assignmentType: client_1.TaskAssignmentType.AI_SUGGESTED
            },
            context
        });
        return this.present(updated);
    }
    async cancel(id, dto, actor, context) {
        const suggestion = await this.prisma.aiTaskSuggestion.findUnique({
            where: { id },
            include: suggestionInclude
        });
        if (!suggestion) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "AI task suggestion not found", "AI_TASK_SUGGESTION_NOT_FOUND");
        }
        await this.accessControl.ensureCanReadTask(actor, suggestion.taskId);
        if (suggestion.status === client_1.AiTaskSuggestionStatus.SELECTED) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Selected AI suggestion cannot be cancelled", "AI_SUGGESTION_ALREADY_SELECTED");
        }
        if (suggestion.status === client_1.AiTaskSuggestionStatus.CANCELLED ||
            suggestion.status === client_1.AiTaskSuggestionStatus.EXPIRED) {
            return this.present(suggestion);
        }
        const updated = (await this.prisma.aiTaskSuggestion.update({
            where: { id },
            data: {
                status: client_1.AiTaskSuggestionStatus.CANCELLED,
                inputSnapshot: this.mergeSnapshot(suggestion.inputSnapshot, {
                    cancelledAt: new Date().toISOString(),
                    cancelledByUserId: actor.id,
                    cancelReason: dto.reason ?? null
                })
            },
            include: suggestionInclude
        }));
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
    async buildWhere(query, user) {
        const base = {
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
    present(suggestion) {
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
                    availabilityScore: item.availabilityScore === null ? null : Number(item.availabilityScore),
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
    normalizeGenerateOptions(dto) {
        return {
            limit: dto.limit ?? 5,
            includeAvailability: dto.includeAvailability ?? true,
            includeSelf: dto.includeSelf ?? false,
            includePendingLeave: dto.includePendingLeave ?? true
        };
    }
    ensureTaskCanReceiveSuggestion(task) {
        if (!task.parentTaskId) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "AI assignment suggestions are only available for subtasks", "AI_SUGGESTION_SUBTASK_REQUIRED");
        }
        if (task.deletedAt || task.status === client_1.TaskStatus.DONE || task.status === client_1.TaskStatus.CANCELLED) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Cannot generate AI suggestion for closed task", "AI_SUGGESTION_TASK_CLOSED");
        }
    }
    async ensureSuggestionCanBeSelected(suggestion) {
        if (suggestion.status === client_1.AiTaskSuggestionStatus.SELECTED) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "AI suggestion already selected", "AI_SUGGESTION_ALREADY_SELECTED");
        }
        if (suggestion.status === client_1.AiTaskSuggestionStatus.CANCELLED) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "AI suggestion has been cancelled", "AI_SUGGESTION_CANCELLED");
        }
        if (suggestion.status === client_1.AiTaskSuggestionStatus.EXPIRED) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "AI suggestion has expired", "AI_SUGGESTION_EXPIRED");
        }
        if (suggestion.task.deletedAt ||
            suggestion.task.status === client_1.TaskStatus.DONE ||
            suggestion.task.status === client_1.TaskStatus.CANCELLED) {
            await this.expireSuggestion(suggestion.id);
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "AI suggestion has expired because the task is closed", "AI_SUGGESTION_EXPIRED");
        }
        const snapshot = this.snapshotObject(suggestion.inputSnapshot);
        const expiresAt = this.snapshotString(snapshot, "expiresAt");
        if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
            await this.expireSuggestion(suggestion.id);
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "AI suggestion has expired", "AI_SUGGESTION_EXPIRED");
        }
        const taskFingerprint = this.snapshotString(snapshot, "taskFingerprint");
        if (taskFingerprint && taskFingerprint !== this.taskFingerprint(suggestion.task)) {
            await this.expireSuggestion(suggestion.id);
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "AI suggestion has expired because the task changed", "AI_SUGGESTION_EXPIRED");
        }
    }
    async expireSuggestion(id) {
        await this.prisma.aiTaskSuggestion.update({
            where: { id },
            data: { status: client_1.AiTaskSuggestionStatus.EXPIRED }
        });
    }
    skillAssessment(requiredSkills, employeeSkills) {
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
        const totalWeight = requiredSkills.reduce((total, item) => total + skillImportanceWeights[item.importance], 0);
        const matchedSkills = [];
        const missingRequiredSkills = [];
        const missingImportantSkills = [];
        const missingNiceToHaveSkills = [];
        const belowMinimumSkills = [];
        const breakdown = [];
        let matchedRequiredSkillCount = 0;
        const weighted = requiredSkills.reduce((total, required) => {
            const employeeSkill = employeeSkillById.get(required.skillId);
            if (employeeSkill) {
                matchedSkills.push(required.skill.code);
                if (required.importance === client_1.TaskSkillImportance.REQUIRED &&
                    this.meetsProficiency(employeeSkill.proficiency, required.requiredProficiency)) {
                    matchedRequiredSkillCount += 1;
                }
                if (required.importance === client_1.TaskSkillImportance.REQUIRED &&
                    !this.meetsProficiency(employeeSkill.proficiency, required.requiredProficiency)) {
                    belowMinimumSkills.push(required.skill.code);
                }
            }
            else {
                if (required.importance === client_1.TaskSkillImportance.REQUIRED) {
                    missingRequiredSkills.push(required.skill.code);
                }
                else if (required.importance === client_1.TaskSkillImportance.IMPORTANT) {
                    missingImportantSkills.push(required.skill.code);
                }
                else {
                    missingNiceToHaveSkills.push(required.skill.code);
                }
            }
            const score = employeeSkill
                ? this.clamp(this.proficiencyScore(employeeSkill.proficiency, required.requiredProficiency) +
                    this.experienceBonus(Number(employeeSkill.yearsExperience ?? 0)) -
                    this.recencyPenalty(employeeSkill.lastUsedAt))
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
            requiredSkillCount: requiredSkills.filter((skill) => skill.importance === client_1.TaskSkillImportance.REQUIRED).length,
            matchedRequiredSkillCount,
            warnings,
            breakdown
        };
    }
    proficiencyScore(actual, required) {
        const scoreByLevel = {
            BEGINNER: 40,
            INTERMEDIATE: 65,
            ADVANCED: 85,
            EXPERT: 100
        };
        const levels = [
            client_1.SkillProficiency.BEGINNER,
            client_1.SkillProficiency.INTERMEDIATE,
            client_1.SkillProficiency.ADVANCED,
            client_1.SkillProficiency.EXPERT
        ];
        const actualScore = scoreByLevel[actual];
        const gap = levels.indexOf(required) - levels.indexOf(actual);
        return gap <= 0 ? actualScore : Math.max(0, actualScore - (gap === 1 ? 15 : 30));
    }
    experienceBonus(years) {
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
    recencyPenalty(lastUsedAt) {
        if (!lastUsedAt) {
            return 0;
        }
        const ageInDays = Math.max(0, (Date.now() - lastUsedAt.getTime()) / (24 * 60 * 60 * 1000));
        if (ageInDays > 2 * 365) {
            return 10;
        }
        return ageInDays > 365 ? 5 : 0;
    }
    meetsProficiency(actual, required) {
        const rank = {
            BEGINNER: 0,
            INTERMEDIATE: 1,
            ADVANCED: 2,
            EXPERT: 3
        };
        return rank[actual] >= rank[required];
    }
    async availabilityAssessment(employeeId, startDate, dueDate, includePendingLeave = true) {
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
            ? [client_1.LeaveRequestStatus.APPROVED, client_1.LeaveRequestStatus.PENDING]
            : [client_1.LeaveRequestStatus.APPROVED];
        const leaves = await this.prisma.leaveRequest.findMany({
            where: {
                employeeId,
                status: { in: statuses },
                startDate: { lte: range.to },
                endDate: { gte: range.from }
            },
            select: { startDate: true, endDate: true, status: true }
        });
        const approvedDays = new Set();
        const pendingDays = new Set();
        for (const leave of leaves) {
            const keys = this.overlapWorkdayKeys(leave.startDate, leave.endDate, range.from, range.to);
            const bucket = leave.status === client_1.LeaveRequestStatus.APPROVED ? approvedDays : pendingDays;
            keys.forEach((key) => bucket.add(key));
        }
        const approvedOverlapWorkDays = approvedDays.size;
        const pendingOverlapWorkDays = Array.from(pendingDays).filter((key) => !approvedDays.has(key)).length;
        const approvedPenalty = Math.min(60, (approvedOverlapWorkDays / taskWorkDays) * 60);
        const pendingPenalty = Math.min(25, (pendingOverlapWorkDays / taskWorkDays) * 25);
        const score = this.clamp(100 - approvedPenalty - pendingPenalty, 0, 100);
        const warnings = [];
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
    availabilityNotUsed(includePendingLeave) {
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
    async ensureAssigneeInTaskTeam(teamId, employeeId) {
        if (!teamId) {
            return;
        }
        const membership = await this.prisma.teamMember.findFirst({
            where: {
                teamId,
                employeeId,
                isActive: true,
                employee: (0, prisma_where_1.currentEmployeeWhere)({ status: client_1.EmployeeStatus.ACTIVE })
            },
            select: { id: true }
        });
        if (!membership) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Task assignee must belong to selected team", "VALIDATION_ERROR");
        }
    }
    async candidateIdsForTask(candidateIds, teamId) {
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
                        employee: (0, prisma_where_1.currentEmployeeWhere)({ status: client_1.EmployeeStatus.ACTIVE })
                    },
                    select: { employeeId: true }
                }
            }
        });
        if (!team) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Team not found", "TEAM_NOT_FOUND");
        }
        const teamCandidateIds = new Set(team.members.map((member) => member.employeeId));
        if (team.leadId && candidateIds.includes(team.leadId)) {
            teamCandidateIds.add(team.leadId);
        }
        return candidateIds.filter((candidateId) => teamCandidateIds.has(candidateId));
    }
    reason(employee, skill, workload, availability, options) {
        const skillText = this.skillReason(skill);
        const workloadText = `${workload.activeTaskCount} task active, còn ${workload.availableHours}h khả dụng/tuần`;
        const availabilityText = options.includeAvailability
            ? this.availabilityReason(availability)
            : "không dùng lịch nghỉ trong lần chấm điểm này";
        return `${employee.fullName}: ${skillText}; ${workloadText}; ${availabilityText}.`;
    }
    skillReason(skill) {
        if (!skill.requiredSkillCount && !skill.matchedSkills.length) {
            return "task chưa khai báo kỹ năng yêu cầu nên độ tin cậy thấp";
        }
        const parts = [];
        if (skill.matchedSkills.length) {
            parts.push(`khớp ${skill.matchedSkills.join(", ")}`);
        }
        if (skill.requiredSkillCount) {
            parts.push(`đạt ${skill.matchedRequiredSkillCount}/${skill.requiredSkillCount} kỹ năng bắt buộc`);
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
    }
    availabilityReason(availability) {
        if (!availability.hasDateRange) {
            return "task chưa có đủ ngày bắt đầu/kết thúc nên tạm coi là sẵn sàng";
        }
        if (!availability.approvedOverlapWorkDays && !availability.pendingOverlapWorkDays) {
            return "không trùng lịch nghỉ trong khoảng task";
        }
        const parts = [];
        if (availability.approvedOverlapWorkDays) {
            parts.push(`trùng ${availability.approvedOverlapWorkDays} ngày nghỉ đã duyệt`);
        }
        if (availability.pendingOverlapWorkDays) {
            parts.push(`trùng ${availability.pendingOverlapWorkDays} ngày nghỉ chờ duyệt`);
        }
        return parts.join(", ");
    }
    workloadWarnings(workload) {
        const warnings = [];
        if (workload.availableHours <= 0) {
            warnings.push("NO_AVAILABLE_CAPACITY");
        }
        if (workload.overdueTaskCount > 0) {
            warnings.push("HAS_OVERDUE_TASKS");
        }
        return warnings;
    }
    emptyWorkload(employeeId) {
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
    buildInputSnapshot(task, options, candidateIds, items, generatedAt) {
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
                    .filter((skill) => skill.importance === client_1.TaskSkillImportance.IMPORTANT &&
                    skill.actualProficiency === null)
                    .map((skill) => skill.code),
                missingNiceToHaveSkills: item.skillBreakdown
                    .filter((skill) => skill.importance === client_1.TaskSkillImportance.NICE_TO_HAVE &&
                    skill.actualProficiency === null)
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
    requiredSkillSnapshot(task) {
        return task.requiredSkills
            .map((item) => ({
            skillId: item.skillId,
            code: item.skill.code,
            name: item.skill.name,
            importance: item.importance,
            weight: skillImportanceWeights[item.importance],
            requiredProficiency: item.requiredProficiency,
            isRequired: item.importance === client_1.TaskSkillImportance.REQUIRED
        }))
            .sort((left, right) => left.skillId - right.skillId);
    }
    taskFingerprint(task) {
        return (0, crypto_1.createHash)("sha256")
            .update(JSON.stringify(this.taskFingerprintPayload(task)))
            .digest("hex");
    }
    taskFingerprintPayload(task) {
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
    mergeSnapshot(snapshot, patch) {
        return {
            ...this.snapshotObject(snapshot),
            ...patch
        };
    }
    snapshotObject(value) {
        if (value && typeof value === "object" && !Array.isArray(value)) {
            return value;
        }
        return {};
    }
    snapshotString(snapshot, key) {
        const value = snapshot[key];
        return typeof value === "string" ? value : null;
    }
    snapshotItemsByEmployeeId(snapshot) {
        const items = Array.isArray(snapshot.items) ? snapshot.items : [];
        const map = new Map();
        for (const value of items) {
            const item = this.snapshotObject(value);
            const employeeId = Number(item.employeeId);
            if (Number.isInteger(employeeId)) {
                map.set(employeeId, item);
            }
        }
        return map;
    }
    stringArray(value) {
        return Array.isArray(value)
            ? value.filter((item) => typeof item === "string")
            : [];
    }
    uniqueWarnings(warnings) {
        return Array.from(new Set(warnings));
    }
    taskDateRange(startDate, dueDate) {
        if (!startDate && !dueDate) {
            return null;
        }
        const from = (0, utils_1.toDateOnly)(startDate ?? dueDate ?? new Date());
        const to = (0, utils_1.toDateOnly)(dueDate ?? startDate ?? new Date());
        return from <= to ? { from, to } : { from: to, to: from };
    }
    overlapWorkdayKeys(leaveStart, leaveEnd, rangeStart, rangeEnd) {
        const from = leaveStart > rangeStart ? (0, utils_1.toDateOnly)(leaveStart) : (0, utils_1.toDateOnly)(rangeStart);
        const to = leaveEnd < rangeEnd ? (0, utils_1.toDateOnly)(leaveEnd) : (0, utils_1.toDateOnly)(rangeEnd);
        return this.workdayKeysBetween(from, to);
    }
    workdayKeysBetween(startDate, endDate) {
        const keys = [];
        const current = (0, utils_1.toDateOnly)(startDate);
        const end = (0, utils_1.toDateOnly)(endDate);
        while (current <= end) {
            const day = current.getUTCDay();
            if (day !== 0 && day !== 6) {
                keys.push(this.dateKey(current));
            }
            current.setUTCDate(current.getUTCDate() + 1);
        }
        return keys;
    }
    dateKeyOrNull(value) {
        return value ? this.dateKey(value) : null;
    }
    dateKey(value) {
        return (0, utils_1.toDateOnly)(value).toISOString().slice(0, 10);
    }
    clamp(value, min = 0, max = 100) {
        return Math.min(Math.max(value, min), max);
    }
    round(value) {
        return Math.round(value * 100) / 100;
    }
};
exports.AiTaskSuggestionsService = AiTaskSuggestionsService;
exports.AiTaskSuggestionsService = AiTaskSuggestionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        access_control_service_1.AccessControlService,
        task_workload_service_1.TaskWorkloadService])
], AiTaskSuggestionsService);
//# sourceMappingURL=ai-task-suggestions.service.js.map