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
exports.TasksService = exports.taskInclude = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const api_error_1 = require("../common/api-error");
const access_control_service_1 = require("../common/services/access-control.service");
const audit_service_1 = require("../common/services/audit.service");
const prisma_where_1 = require("../common/prisma-where");
const utils_1 = require("../common/utils");
const prisma_service_1 = require("../prisma/prisma.service");
exports.taskInclude = {
    project: true,
    department: true,
    team: {
        include: {
            department: true,
            lead: { include: { department: true, position: true } },
            members: {
                where: { isActive: true },
                include: { employee: { include: { department: true, position: true } } }
            }
        }
    },
    assignee: { include: { department: true, position: true } },
    createdByUser: { select: { id: true, username: true, email: true } },
    assignedByUser: { select: { id: true, username: true, email: true } },
    requiredSkills: { include: { skill: true } },
    _count: { select: { assignments: true, aiTaskSuggestions: true } }
};
let TasksService = class TasksService {
    prisma;
    audit;
    accessControl;
    constructor(prisma, audit, accessControl) {
        this.prisma = prisma;
        this.audit = audit;
        this.accessControl = accessControl;
    }
    async findAll(query, user) {
        const where = await this.buildWhere(query, user, "all");
        return this.paginatedList(where, query);
    }
    async findTeam(query, user) {
        const where = await this.buildWhere(query, user, "team");
        return this.paginatedList(where, query);
    }
    async findSelf(query, user) {
        if (!user.employeeId) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Employee not found", "EMPLOYEE_NOT_FOUND");
        }
        const where = await this.buildWhere(query, user, "self");
        return this.paginatedList(where, query);
    }
    async findOne(id, user) {
        await this.accessControl.ensureCanReadTask(user, id);
        const task = await this.prisma.task.findFirst({
            where: { id, deletedAt: null },
            include: exports.taskInclude
        });
        if (!task) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Task not found", "TASK_NOT_FOUND");
        }
        return task;
    }
    async create(dto, actor, context) {
        const scope = await this.resolveTaskScope(dto.projectId, dto.departmentId, dto.teamId, dto.assigneeId);
        await this.ensureRequiredSkills(dto.requiredSkills);
        this.ensureDateRange(dto.startDate, dto.dueDate);
        if (dto.assigneeId) {
            await this.accessControl.ensureCanAssignToEmployee(actor, dto.assigneeId);
        }
        if (dto.projectId) {
            await this.accessControl.ensureCanReadProject(actor, dto.projectId);
        }
        const task = await this.prisma.$transaction(async (tx) => {
            const created = await tx.task.create({
                data: {
                    projectId: dto.projectId,
                    departmentId: scope.departmentId,
                    teamId: scope.teamId,
                    title: dto.title,
                    description: dto.description,
                    priority: dto.priority ?? client_1.TaskPriority.MEDIUM,
                    status: dto.status ?? client_1.TaskStatus.TODO,
                    assigneeId: dto.assigneeId,
                    createdByUserId: actor.id,
                    assignedByUserId: dto.assigneeId ? actor.id : undefined,
                    startDate: dto.startDate ? (0, utils_1.toDateOnly)(dto.startDate) : undefined,
                    dueDate: dto.dueDate ? (0, utils_1.toDateOnly)(dto.dueDate) : undefined,
                    estimatedHours: dto.estimatedHours,
                    actualHours: dto.actualHours,
                    completedAt: dto.status === client_1.TaskStatus.DONE ? new Date() : undefined,
                    requiredSkills: this.requiredSkillsCreate(dto.requiredSkills)
                },
                include: exports.taskInclude
            });
            if (dto.assigneeId) {
                await tx.taskAssignment.create({
                    data: {
                        taskId: created.id,
                        assigneeId: dto.assigneeId,
                        assignedByUserId: actor.id,
                        assignmentType: client_1.TaskAssignmentType.MANUAL,
                        note: "Assigned during task creation"
                    }
                });
            }
            return created;
        });
        await this.audit.log({
            userId: actor.id,
            action: "CREATE_TASK",
            entityType: "Task",
            entityId: task.id,
            newValue: task,
            context
        });
        if (dto.assigneeId) {
            await this.audit.log({
                userId: actor.id,
                action: "ASSIGN_TASK",
                entityType: "Task",
                entityId: task.id,
                newValue: { assigneeId: dto.assigneeId, assignmentType: "MANUAL" },
                context
            });
        }
        return task;
    }
    async update(id, dto, actor, context) {
        const oldValue = await this.findOne(id, actor);
        await this.accessControl.ensureCanUpdateTask(actor, id);
        const scope = await this.resolveTaskScope(dto.projectId ?? oldValue.projectId ?? undefined, dto.departmentId ?? oldValue.departmentId ?? undefined, dto.teamId ?? oldValue.teamId ?? undefined, dto.assigneeId ?? oldValue.assigneeId ?? undefined);
        if (dto.assigneeId) {
            await this.accessControl.ensureCanAssignToEmployee(actor, dto.assigneeId);
        }
        await this.ensureRequiredSkills(dto.requiredSkills);
        this.ensureDateRange(dto.startDate, dto.dueDate);
        const task = await this.prisma.$transaction(async (tx) => {
            if (dto.requiredSkills) {
                await tx.taskRequiredSkill.deleteMany({ where: { taskId: id } });
                if (dto.requiredSkills.length) {
                    await tx.taskRequiredSkill.createMany({
                        data: this.requiredSkillsData(id, dto.requiredSkills),
                        skipDuplicates: true
                    });
                }
            }
            return tx.task.update({
                where: { id },
                data: {
                    projectId: dto.projectId,
                    departmentId: dto.departmentId !== undefined || dto.teamId !== undefined || dto.projectId !== undefined
                        ? scope.departmentId
                        : undefined,
                    teamId: dto.teamId !== undefined || dto.projectId !== undefined ? scope.teamId : undefined,
                    assigneeId: dto.assigneeId,
                    assignedByUserId: dto.assigneeId ? actor.id : undefined,
                    title: dto.title,
                    description: dto.description,
                    priority: dto.priority,
                    status: dto.status,
                    startDate: dto.startDate ? (0, utils_1.toDateOnly)(dto.startDate) : undefined,
                    dueDate: dto.dueDate ? (0, utils_1.toDateOnly)(dto.dueDate) : undefined,
                    estimatedHours: dto.estimatedHours,
                    actualHours: dto.actualHours,
                    completedAt: dto.status === client_1.TaskStatus.DONE ? new Date() : undefined
                },
                include: exports.taskInclude
            });
        });
        await this.audit.log({
            userId: actor.id,
            action: "UPDATE_TASK",
            entityType: "Task",
            entityId: id,
            oldValue,
            newValue: task,
            context
        });
        return task;
    }
    async assign(id, dto, actor, context, assignmentType = client_1.TaskAssignmentType.MANUAL) {
        const oldValue = await this.findOne(id, actor);
        await this.accessControl.ensureCanAssignTask(actor, id, dto.assigneeId);
        await this.ensureAssigneeInTaskTeam(oldValue.teamId, dto.assigneeId);
        const task = await this.prisma.$transaction(async (tx) => {
            const updated = await tx.task.update({
                where: { id },
                data: {
                    assigneeId: dto.assigneeId,
                    assignedByUserId: actor.id
                },
                include: exports.taskInclude
            });
            await tx.taskAssignment.create({
                data: {
                    taskId: id,
                    assigneeId: dto.assigneeId,
                    assignedByUserId: actor.id,
                    assignmentType: oldValue.assigneeId && oldValue.assigneeId !== dto.assigneeId
                        ? client_1.TaskAssignmentType.REASSIGNED
                        : assignmentType,
                    note: dto.note
                }
            });
            return updated;
        });
        await this.audit.log({
            userId: actor.id,
            action: oldValue.assigneeId ? "REASSIGN_TASK" : "ASSIGN_TASK",
            entityType: "Task",
            entityId: id,
            oldValue: { assigneeId: oldValue.assigneeId },
            newValue: { assigneeId: dto.assigneeId, assignmentType },
            context
        });
        return task;
    }
    async updateStatus(id, dto, actor, context) {
        const oldValue = await this.findOne(id, actor);
        await this.accessControl.ensureCanUpdateTaskStatus(actor, id);
        const task = await this.prisma.task.update({
            where: { id },
            data: {
                status: dto.status,
                completedAt: dto.status === client_1.TaskStatus.DONE ? new Date() : null
            },
            include: exports.taskInclude
        });
        await this.audit.log({
            userId: actor.id,
            action: "UPDATE_TASK_STATUS",
            entityType: "Task",
            entityId: id,
            oldValue: { status: oldValue.status },
            newValue: { status: task.status, note: dto.note },
            context
        });
        return task;
    }
    async softDelete(id, actor, context) {
        const oldValue = await this.findOne(id, actor);
        await this.accessControl.ensureCanUpdateTask(actor, id);
        const task = await this.prisma.task.update({
            where: { id },
            data: { status: client_1.TaskStatus.CANCELLED, deletedAt: new Date() },
            include: exports.taskInclude
        });
        await this.audit.log({
            userId: actor.id,
            action: "DELETE_TASK",
            entityType: "Task",
            entityId: id,
            oldValue,
            newValue: task,
            context
        });
        return task;
    }
    async paginatedList(where, query) {
        const { skip, take, page, limit } = (0, utils_1.pagination)(query.page, query.limit);
        const [items, total] = await this.prisma.$transaction([
            this.prisma.task.findMany({
                where,
                include: exports.taskInclude,
                orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
                skip,
                take
            }),
            this.prisma.task.count({ where })
        ]);
        return { items, meta: { total, page, limit } };
    }
    async buildWhere(query, user, scope) {
        const base = {
            deletedAt: null,
            projectId: query.projectId,
            departmentId: query.departmentId,
            teamId: query.teamId,
            assigneeId: query.assigneeId,
            status: query.status,
            priority: query.priority,
            dueDate: query.fromDate || query.toDate
                ? {
                    gte: query.fromDate ? (0, utils_1.toDateOnly)(query.fromDate) : undefined,
                    lte: query.toDate ? (0, utils_1.toDateOnly)(query.toDate) : undefined
                }
                : undefined,
            ...(query.search
                ? {
                    OR: [
                        { title: { contains: query.search, mode: "insensitive" } },
                        { description: { contains: query.search, mode: "insensitive" } }
                    ]
                }
                : {})
        };
        if (scope === "self") {
            return { AND: [base, { assigneeId: user.employeeId ?? -1 }] };
        }
        if (this.accessControl.isAdmin(user) && scope === "all") {
            return base;
        }
        if (scope === "team" && !user.employeeId) {
            return { AND: [base, { id: -1 }] };
        }
        const teamIds = await this.accessControl.teamEmployeeIds(user);
        const managedTeamIds = await this.accessControl.managedTeamIds(user);
        if (scope === "team") {
            return {
                AND: [
                    base,
                    {
                        OR: [
                            { assigneeId: { in: teamIds.length ? teamIds : [-1] } },
                            { teamId: { in: managedTeamIds.length ? managedTeamIds : [-1] } }
                        ]
                    }
                ]
            };
        }
        return {
            AND: [
                base,
                {
                    OR: [
                        { assigneeId: { in: teamIds } },
                        { createdByUserId: user.id },
                        { project: { managerId: user.employeeId ?? -1 } },
                        { teamId: { in: managedTeamIds } }
                    ]
                }
            ]
        };
    }
    async resolveTaskScope(projectId, departmentId, teamId, assigneeId) {
        let resolvedDepartmentId = departmentId ?? undefined;
        let resolvedTeamId = teamId ?? undefined;
        if (projectId) {
            const project = await this.prisma.project.findFirst({
                where: { id: projectId, deletedAt: null },
                select: { id: true, departmentId: true, teamId: true }
            });
            if (!project) {
                throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Project not found", "PROJECT_NOT_FOUND");
            }
            if (project.departmentId) {
                if (resolvedDepartmentId && resolvedDepartmentId !== project.departmentId) {
                    throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Task department must match selected project", "VALIDATION_ERROR");
                }
                resolvedDepartmentId = project.departmentId;
            }
            if (project.teamId) {
                if (resolvedTeamId && resolvedTeamId !== project.teamId) {
                    throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Task team must match selected project", "VALIDATION_ERROR");
                }
                resolvedTeamId = project.teamId;
            }
        }
        if (resolvedTeamId) {
            const team = await this.prisma.team.findFirst({
                where: { id: resolvedTeamId, deletedAt: null, isActive: true },
                select: { id: true, departmentId: true }
            });
            if (!team) {
                throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Team not found", "TEAM_NOT_FOUND");
            }
            if (resolvedDepartmentId && resolvedDepartmentId !== team.departmentId) {
                throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Task team must belong to selected department", "VALIDATION_ERROR");
            }
            resolvedDepartmentId = team.departmentId;
        }
        if (resolvedDepartmentId) {
            const department = await this.prisma.department.findFirst({
                where: { id: resolvedDepartmentId, deletedAt: null },
                select: { id: true }
            });
            if (!department) {
                throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Department not found", "DEPARTMENT_NOT_FOUND");
            }
        }
        if (assigneeId && resolvedTeamId) {
            await this.ensureAssigneeInTaskTeam(resolvedTeamId, assigneeId);
        }
        return { departmentId: resolvedDepartmentId, teamId: resolvedTeamId };
    }
    async ensureAssigneeInTaskTeam(teamId, assigneeId) {
        if (!teamId) {
            return;
        }
        const membership = await this.prisma.teamMember.findFirst({
            where: {
                teamId,
                employeeId: assigneeId,
                isActive: true,
                employee: (0, prisma_where_1.currentEmployeeWhere)({ status: "ACTIVE" })
            },
            select: { id: true }
        });
        if (!membership) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Task assignee must belong to selected team", "VALIDATION_ERROR");
        }
    }
    async ensureRequiredSkills(requiredSkills) {
        if (!requiredSkills?.length) {
            return;
        }
        const skillIds = Array.from(new Set(requiredSkills.map((item) => item.skillId)));
        if (skillIds.length !== requiredSkills.length) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Task required skills must be unique", "TASK_REQUIRED_SKILL_INVALID");
        }
        const skills = await this.prisma.skill.findMany({
            where: { id: { in: skillIds }, isActive: true },
            select: { id: true }
        });
        if (skills.length !== skillIds.length) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Skill not found", "SKILL_NOT_FOUND");
        }
    }
    ensureDateRange(startDate, dueDate) {
        if (startDate && dueDate && (0, utils_1.toDateOnly)(startDate) > (0, utils_1.toDateOnly)(dueDate)) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Start date must be before or equal to due date", "VALIDATION_ERROR");
        }
    }
    requiredSkillsCreate(requiredSkills) {
        if (!requiredSkills?.length) {
            return undefined;
        }
        return {
            create: requiredSkills.map((item) => ({
                skillId: item.skillId,
                requiredProficiency: item.requiredProficiency,
                weight: item.weight ?? 1,
                isRequired: item.isRequired ?? true
            }))
        };
    }
    requiredSkillsData(taskId, requiredSkills) {
        return requiredSkills.map((item) => ({
            taskId,
            skillId: item.skillId,
            requiredProficiency: item.requiredProficiency,
            weight: item.weight ?? 1,
            isRequired: item.isRequired ?? true
        }));
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        access_control_service_1.AccessControlService])
], TasksService);
//# sourceMappingURL=tasks.service.js.map