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
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const api_error_1 = require("../common/api-error");
const access_control_service_1 = require("../common/services/access-control.service");
const audit_service_1 = require("../common/services/audit.service");
const prisma_where_1 = require("../common/prisma-where");
const utils_1 = require("../common/utils");
const prisma_service_1 = require("../prisma/prisma.service");
const task_workload_service_1 = require("../task-workload/task-workload.service");
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
        await this.accessControl.ensureCanGenerateTaskSuggestion(actor, taskId);
        const task = await this.prisma.task.findFirst({
            where: { id: taskId, deletedAt: null },
            include: {
                requiredSkills: { include: { skill: true } },
                project: true
            }
        });
        if (!task) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Task not found", "TASK_NOT_FOUND");
        }
        const candidateIds = await this.accessControl.candidateEmployeeIdsForTask(actor);
        if (!candidateIds.length) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "No candidates available for AI suggestion", "AI_SUGGESTION_NO_CANDIDATES");
        }
        const [employees, workloads] = await Promise.all([
            this.prisma.employee.findMany({
                where: (0, prisma_where_1.currentEmployeeWhere)({ id: { in: candidateIds }, status: "ACTIVE" }),
                include: {
                    department: true,
                    position: true,
                    employeeSkills: { include: { skill: true } }
                }
            }),
            this.workloadService.summariesForEmployees(candidateIds)
        ]);
        const scored = await Promise.all(employees.map(async (employee) => {
            const workload = workloads.get(employee.id) ?? this.emptyWorkload(employee.id);
            const skillScore = this.skillScore(task.requiredSkills, employee.employeeSkills);
            const workloadScore = workload.workloadScore;
            const availabilityScore = dto.includeAvailability
                ? await this.availabilityScore(employee.id, task.startDate, task.dueDate)
                : 100;
            const score = dto.includeAvailability
                ? skillScore * 0.5 + workloadScore * 0.35 + availabilityScore * 0.15
                : skillScore * 0.6 + workloadScore * 0.4;
            return {
                employeeId: employee.id,
                score: this.round(score),
                skillScore: this.round(skillScore),
                workloadScore: this.round(workloadScore),
                availabilityScore: this.round(availabilityScore),
                reason: this.reason(employee.fullName, task.requiredSkills, workload, availabilityScore)
            };
        }));
        const items = scored
            .sort((left, right) => right.score - left.score)
            .slice(0, dto.limit ?? 5)
            .map((item, index) => ({ ...item, rank: index + 1 }));
        if (!items.length) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "No candidates available for AI suggestion", "AI_SUGGESTION_NO_CANDIDATES");
        }
        const suggestion = await this.prisma.aiTaskSuggestion.create({
            data: {
                taskId,
                requestedByUserId: actor.id,
                algorithmVersion: "rule-based-v1",
                inputSnapshot: {
                    taskId,
                    candidateIds,
                    requiredSkills: task.requiredSkills.map((item) => ({
                        skillId: item.skillId,
                        code: item.skill.code,
                        weight: Number(item.weight),
                        requiredProficiency: item.requiredProficiency,
                        isRequired: item.isRequired
                    })),
                    includeAvailability: dto.includeAvailability ?? true
                },
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
            include: { items: true, task: true }
        });
        if (!suggestion) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "AI task suggestion not found", "AI_TASK_SUGGESTION_NOT_FOUND");
        }
        if (suggestion.status !== client_1.AiTaskSuggestionStatus.GENERATED) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "AI suggestion already selected or closed", "AI_SUGGESTION_ALREADY_SELECTED");
        }
        const item = suggestion.items.find((candidate) => candidate.id === dto.suggestionItemId);
        if (!item) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "AI task suggestion item not found", "AI_TASK_SUGGESTION_ITEM_NOT_FOUND");
        }
        await this.accessControl.ensureCanAssignTask(actor, suggestion.taskId, item.employeeId);
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
        return {
            suggestionId: suggestion.id,
            id: suggestion.id,
            taskId: suggestion.taskId,
            task: suggestion.task,
            requestedByUser: suggestion.requestedByUser,
            algorithmVersion: suggestion.algorithmVersion,
            status: suggestion.status,
            createdAt: suggestion.createdAt,
            items: suggestion.items.map((item) => ({
                suggestionItemId: item.id,
                id: item.id,
                employeeId: item.employeeId,
                employee: item.employee,
                fullName: item.employee.fullName,
                rank: item.rank,
                score: Number(item.score),
                skillScore: Number(item.skillScore ?? 0),
                workloadScore: Number(item.workloadScore ?? 0),
                availabilityScore: Number(item.availabilityScore ?? 0),
                performanceScore: item.performanceScore ? Number(item.performanceScore) : null,
                reason: item.reason,
                selected: item.selected
            }))
        };
    }
    skillScore(requiredSkills, employeeSkills) {
        if (!requiredSkills.length) {
            return 70;
        }
        const employeeSkillById = new Map(employeeSkills.map((skill) => [skill.skillId, skill]));
        const totalWeight = requiredSkills.reduce((total, item) => total + Number(item.weight), 0);
        const weighted = requiredSkills.reduce((total, required) => {
            const employeeSkill = employeeSkillById.get(required.skillId);
            const score = employeeSkill
                ? this.proficiencyScore(employeeSkill.proficiency, required.requiredProficiency) +
                    this.experienceBonus(Number(employeeSkill.yearsExperience ?? 0))
                : required.isRequired
                    ? 0
                    : 30;
            return total + Math.min(score, 100) * Number(required.weight);
        }, 0);
        return totalWeight > 0 ? weighted / totalWeight : 0;
    }
    proficiencyScore(actual, required) {
        const scoreByLevel = {
            BEGINNER: 40,
            INTERMEDIATE: 65,
            ADVANCED: 85,
            EXPERT: 100
        };
        if (!actual) {
            return 0;
        }
        const actualScore = scoreByLevel[actual];
        if (!required) {
            return actualScore;
        }
        return actualScore < scoreByLevel[required]
            ? Math.max(0, actualScore - 15)
            : actualScore;
    }
    experienceBonus(years) {
        if (years > 4) {
            return 15;
        }
        if (years >= 2) {
            return 10;
        }
        if (years >= 1) {
            return 5;
        }
        return 0;
    }
    async availabilityScore(employeeId, startDate, dueDate) {
        if (!startDate && !dueDate) {
            return 100;
        }
        const from = startDate ? (0, utils_1.toDateOnly)(startDate) : (0, utils_1.toDateOnly)(new Date());
        const to = dueDate ? (0, utils_1.toDateOnly)(dueDate) : from;
        const overlap = await this.prisma.leaveRequest.findFirst({
            where: {
                employeeId,
                status: client_1.LeaveRequestStatus.APPROVED,
                startDate: { lte: to },
                endDate: { gte: from }
            },
            select: { id: true }
        });
        return overlap ? 40 : 100;
    }
    reason(fullName, requiredSkills, workload, availabilityScore) {
        const skills = requiredSkills.map((item) => item.skill.code).join(", ");
        const skillText = skills
            ? `phù hợp với kỹ năng yêu cầu (${skills})`
            : "task chưa yêu cầu kỹ năng cụ thể";
        const availabilityText = availabilityScore >= 100 ? "không có lịch nghỉ trùng deadline" : "có lịch nghỉ cần cân nhắc";
        return `${fullName} ${skillText}, còn ${workload.availableHours}h khả dụng/tuần, ${workload.activeTaskCount} task active, ${availabilityText}.`;
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