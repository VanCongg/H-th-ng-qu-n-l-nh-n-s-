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
exports.ProjectsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const api_error_1 = require("../common/api-error");
const audit_service_1 = require("../common/services/audit.service");
const access_control_service_1 = require("../common/services/access-control.service");
const prisma_where_1 = require("../common/prisma-where");
const utils_1 = require("../common/utils");
const prisma_service_1 = require("../prisma/prisma.service");
const projectInclude = {
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
    manager: { include: { department: true, position: true } },
    createdByUser: { select: { id: true, username: true, email: true } },
    _count: { select: { tasks: { where: { deletedAt: null } } } }
};
let ProjectsService = class ProjectsService {
    prisma;
    audit;
    accessControl;
    constructor(prisma, audit, accessControl) {
        this.prisma = prisma;
        this.audit = audit;
        this.accessControl = accessControl;
    }
    async findAll(query, user) {
        const { skip, take, page, limit } = (0, utils_1.pagination)(query.page, query.limit);
        const where = await this.buildWhere(query, user);
        const [items, total] = await this.prisma.$transaction([
            this.prisma.project.findMany({
                where,
                include: projectInclude,
                orderBy: { createdAt: "desc" },
                skip,
                take
            }),
            this.prisma.project.count({ where })
        ]);
        return { items, meta: { total, page, limit } };
    }
    async findOne(id, user) {
        await this.accessControl.ensureCanReadProject(user, id);
        const project = await this.prisma.project.findFirst({
            where: { id, deletedAt: null },
            include: projectInclude
        });
        if (!project) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Project not found", "PROJECT_NOT_FOUND");
        }
        return project;
    }
    async create(dto, actor, context) {
        const managerId = this.defaultProjectManagerId(dto.managerId, actor);
        const scope = await this.resolveProjectScope(dto.departmentId, dto.teamId, managerId);
        await this.ensureCanUseProjectManager(actor, managerId);
        this.ensureDateRange(dto.startDate, dto.endDate);
        const project = await this.prisma.project.create({
            data: {
                departmentId: scope.departmentId,
                teamId: scope.teamId,
                managerId,
                code: dto.code,
                name: dto.name,
                description: dto.description,
                status: dto.status ?? client_1.ProjectStatus.ACTIVE,
                startDate: dto.startDate ? (0, utils_1.toDateOnly)(dto.startDate) : undefined,
                endDate: dto.endDate ? (0, utils_1.toDateOnly)(dto.endDate) : undefined,
                createdByUserId: actor.id
            },
            include: projectInclude
        });
        await this.audit.log({
            userId: actor.id,
            action: "CREATE_PROJECT",
            entityType: "Project",
            entityId: project.id,
            newValue: project,
            context
        });
        return project;
    }
    async update(id, dto, actor, context) {
        const oldValue = await this.findOne(id, actor);
        const scope = await this.resolveProjectScope(dto.departmentId ?? oldValue.departmentId ?? undefined, dto.teamId ?? oldValue.teamId ?? undefined, dto.managerId ?? oldValue.managerId ?? undefined);
        if (dto.managerId !== undefined) {
            await this.ensureCanUseProjectManager(actor, dto.managerId);
        }
        this.ensureDateRange(dto.startDate, dto.endDate);
        const project = await this.prisma.project.update({
            where: { id },
            data: {
                departmentId: dto.departmentId !== undefined || dto.teamId !== undefined ? scope.departmentId : undefined,
                teamId: dto.teamId,
                managerId: dto.managerId,
                code: dto.code,
                name: dto.name,
                description: dto.description,
                status: dto.status,
                startDate: dto.startDate ? (0, utils_1.toDateOnly)(dto.startDate) : undefined,
                endDate: dto.endDate ? (0, utils_1.toDateOnly)(dto.endDate) : undefined
            },
            include: projectInclude
        });
        await this.audit.log({
            userId: actor.id,
            action: "UPDATE_PROJECT",
            entityType: "Project",
            entityId: id,
            oldValue,
            newValue: project,
            context
        });
        return project;
    }
    async softDelete(id, actor, context) {
        const oldValue = await this.findOne(id, actor);
        const activeTasks = await this.prisma.task.count({
            where: {
                projectId: id,
                deletedAt: null,
                status: { notIn: [client_1.TaskStatus.DONE, client_1.TaskStatus.CANCELLED] }
            }
        });
        if (activeTasks > 0) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Project has active tasks", "VALIDATION_ERROR");
        }
        const project = await this.prisma.project.update({
            where: { id },
            data: { status: client_1.ProjectStatus.CANCELLED, deletedAt: new Date() },
            include: projectInclude
        });
        await this.audit.log({
            userId: actor.id,
            action: "DELETE_PROJECT",
            entityType: "Project",
            entityId: id,
            oldValue,
            newValue: project,
            context
        });
        return project;
    }
    async buildWhere(query, user) {
        const base = {
            deletedAt: null,
            status: query.status,
            departmentId: query.departmentId,
            teamId: query.teamId,
            managerId: query.managerId,
            ...(query.search
                ? {
                    OR: [
                        { code: { contains: query.search, mode: "insensitive" } },
                        { name: { contains: query.search, mode: "insensitive" } }
                    ]
                }
                : {})
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
                        { managerId: user.employeeId ?? -1 },
                        { createdByUserId: user.id },
                        { team: { leadId: user.employeeId ?? -1 } },
                        {
                            team: {
                                members: {
                                    some: { employeeId: user.employeeId ?? -1, isActive: true }
                                }
                            }
                        },
                        { tasks: { some: { deletedAt: null, assigneeId: { in: teamIds } } } },
                        { tasks: { some: { deletedAt: null, createdByUserId: user.id } } }
                    ]
                }
            ]
        };
    }
    async resolveProjectScope(departmentId, teamId, managerId) {
        let resolvedDepartmentId = departmentId ?? undefined;
        if (teamId) {
            const team = await this.prisma.team.findFirst({
                where: { id: teamId, deletedAt: null, isActive: true },
                include: { members: { where: { isActive: true }, select: { employeeId: true } } }
            });
            if (!team) {
                throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Team not found", "TEAM_NOT_FOUND");
            }
            if (resolvedDepartmentId && resolvedDepartmentId !== team.departmentId) {
                throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Team must belong to selected department", "VALIDATION_ERROR");
            }
            resolvedDepartmentId = team.departmentId;
            if (managerId &&
                team.leadId !== managerId &&
                !team.members.some((member) => member.employeeId === managerId)) {
                throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Project manager must belong to selected team", "VALIDATION_ERROR");
            }
        }
        await this.ensureReferences(resolvedDepartmentId, managerId);
        return { departmentId: resolvedDepartmentId, teamId: teamId ?? undefined };
    }
    async ensureReferences(departmentId, managerId) {
        if (departmentId) {
            const department = await this.prisma.department.findFirst({
                where: { id: departmentId, deletedAt: null },
                select: { id: true }
            });
            if (!department) {
                throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Department not found", "DEPARTMENT_NOT_FOUND");
            }
        }
        if (managerId) {
            const manager = await this.prisma.employee.findFirst({
                where: (0, prisma_where_1.currentEmployeeWhere)({ id: managerId }),
                select: { id: true }
            });
            if (!manager) {
                throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Employee not found", "EMPLOYEE_NOT_FOUND");
            }
        }
    }
    ensureDateRange(startDate, endDate) {
        if (startDate && endDate && (0, utils_1.toDateOnly)(startDate) > (0, utils_1.toDateOnly)(endDate)) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Start date must be before or equal to end date", "VALIDATION_ERROR");
        }
    }
    defaultProjectManagerId(managerId, actor) {
        if (this.accessControl.isAdmin(actor)) {
            return managerId;
        }
        return managerId ?? actor.employeeId ?? undefined;
    }
    async ensureCanUseProjectManager(actor, managerId) {
        if (this.accessControl.isAdmin(actor)) {
            return;
        }
        if (!this.accessControl.isManager(actor) || !actor.employeeId || !managerId) {
            throw new api_error_1.ApiError(common_1.HttpStatus.FORBIDDEN, "Project manager scope denied", "PROJECT_MANAGER_SCOPE_DENIED");
        }
        if (managerId === actor.employeeId) {
            return;
        }
        if (await this.accessControl.isSubordinate(actor, managerId)) {
            return;
        }
        throw new api_error_1.ApiError(common_1.HttpStatus.FORBIDDEN, "Project manager is outside manager scope", "PROJECT_MANAGER_SCOPE_DENIED");
    }
};
exports.ProjectsService = ProjectsService;
exports.ProjectsService = ProjectsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        access_control_service_1.AccessControlService])
], ProjectsService);
//# sourceMappingURL=projects.service.js.map