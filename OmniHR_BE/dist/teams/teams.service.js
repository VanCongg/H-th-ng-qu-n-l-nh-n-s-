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
exports.TeamsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const api_error_1 = require("../common/api-error");
const audit_service_1 = require("../common/services/audit.service");
const prisma_where_1 = require("../common/prisma-where");
const utils_1 = require("../common/utils");
const prisma_service_1 = require("../prisma/prisma.service");
const teamInclude = {
    department: true,
    lead: { include: { department: true, position: true } },
    members: {
        where: { isActive: true, employee: (0, prisma_where_1.currentEmployeeWhere)() },
        include: { employee: { include: { department: true, position: true } } },
        orderBy: [{ role: "asc" }, { employee: { fullName: "asc" } }]
    },
    _count: {
        select: {
            members: { where: { isActive: true, employee: (0, prisma_where_1.currentEmployeeWhere)() } },
            tasks: { where: { deletedAt: null } }
        }
    }
};
let TeamsService = class TeamsService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async findAll(query, actor) {
        const { skip, take, page, limit } = (0, utils_1.pagination)(query.page, query.limit);
        const where = this.scopedTeamWhere(actor, {
            deletedAt: null,
            departmentId: query.departmentId,
            leadId: query.leadId,
            ...(query.search
                ? {
                    OR: [
                        { code: { contains: query.search, mode: "insensitive" } },
                        { name: { contains: query.search, mode: "insensitive" } }
                    ]
                }
                : {})
        });
        const [items, total] = await this.prisma.$transaction([
            this.prisma.team.findMany({
                where,
                include: teamInclude,
                orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
                skip,
                take
            }),
            this.prisma.team.count({ where })
        ]);
        return { items, meta: { total, page, limit } };
    }
    async findOne(id, actor) {
        const team = await this.prisma.team.findFirst({
            where: actor ? this.scopedTeamWhere(actor, { id, deletedAt: null }) : { id, deletedAt: null },
            include: teamInclude
        });
        if (!team) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Team not found", "TEAM_NOT_FOUND");
        }
        return team;
    }
    async create(dto, actor, context) {
        await this.ensureDepartment(dto.departmentId);
        await this.ensureCanManageDepartment(actor, dto.departmentId);
        await this.ensureEmployeesInDepartment(this.memberIds(dto.memberIds, dto.leadId), dto.departmentId);
        const team = await this.prisma.$transaction(async (tx) => {
            const created = await tx.team.create({
                data: {
                    departmentId: dto.departmentId,
                    leadId: dto.leadId,
                    code: dto.code,
                    name: dto.name,
                    description: dto.description,
                    isActive: dto.isActive ?? true
                }
            });
            await this.syncMembers(tx, created.id, dto.departmentId, dto.leadId, dto.memberIds);
            return tx.team.findUniqueOrThrow({ where: { id: created.id }, include: teamInclude });
        });
        await this.audit.log({
            userId: actor.id,
            action: "CREATE_TEAM",
            entityType: "Team",
            entityId: team.id,
            newValue: team,
            context
        });
        return team;
    }
    async update(id, dto, actor, context) {
        const oldValue = await this.findOne(id, actor);
        const departmentId = dto.departmentId ?? oldValue.departmentId;
        await this.ensureDepartment(departmentId);
        await this.ensureCanManageDepartment(actor, oldValue.departmentId);
        await this.ensureCanManageDepartment(actor, departmentId);
        const employeeIds = dto.memberIds !== undefined
            ? this.memberIds(dto.memberIds, dto.leadId ?? oldValue.leadId ?? undefined)
            : this.memberIds(oldValue.members.map((member) => member.employeeId), dto.leadId ?? oldValue.leadId ?? undefined);
        await this.ensureEmployeesInDepartment(employeeIds, departmentId);
        const team = await this.prisma.$transaction(async (tx) => {
            await tx.team.update({
                where: { id },
                data: {
                    departmentId: dto.departmentId,
                    leadId: dto.leadId,
                    code: dto.code,
                    name: dto.name,
                    description: dto.description,
                    isActive: dto.isActive
                }
            });
            if (dto.memberIds !== undefined) {
                await this.syncMembers(tx, id, departmentId, dto.leadId ?? oldValue.leadId ?? undefined, dto.memberIds);
            }
            else if (dto.leadId !== undefined) {
                await this.ensureLeadMembership(tx, id, dto.leadId);
                await this.downgradePreviousLead(tx, id, oldValue.leadId, dto.leadId);
            }
            return tx.team.findUniqueOrThrow({ where: { id }, include: teamInclude });
        });
        await this.audit.log({
            userId: actor.id,
            action: "UPDATE_TEAM",
            entityType: "Team",
            entityId: id,
            oldValue,
            newValue: team,
            context
        });
        return team;
    }
    async softDelete(id, actor, context) {
        const oldValue = await this.findOne(id, actor);
        await this.ensureCanManageDepartment(actor, oldValue.departmentId);
        const activeTasks = await this.prisma.task.count({
            where: {
                teamId: id,
                deletedAt: null,
                status: { notIn: [client_1.TaskStatus.DONE, client_1.TaskStatus.CANCELLED] }
            }
        });
        if (activeTasks) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Team has active tasks", "VALIDATION_ERROR");
        }
        const team = await this.prisma.$transaction(async (tx) => {
            await tx.teamMember.updateMany({
                where: { teamId: id, isActive: true },
                data: { isActive: false, leftAt: (0, utils_1.toDateOnly)(new Date()) }
            });
            return tx.team.update({
                where: { id },
                data: { isActive: false, deletedAt: new Date() },
                include: teamInclude
            });
        });
        await this.audit.log({
            userId: actor.id,
            action: "DELETE_TEAM",
            entityType: "Team",
            entityId: id,
            oldValue,
            newValue: team,
            context
        });
        return team;
    }
    async addMember(teamId, dto, actor, context) {
        const team = await this.findOne(teamId, actor);
        await this.ensureCanManageDepartment(actor, team.departmentId);
        await this.ensureEmployeesInDepartment([dto.employeeId], team.departmentId);
        const result = await this.prisma.$transaction(async (tx) => {
            const member = await this.activateMember(tx, teamId, dto.employeeId, dto.role ?? client_1.TeamMemberRole.MEMBER);
            if (member.role === client_1.TeamMemberRole.LEAD) {
                await this.setTeamLead(tx, teamId, dto.employeeId);
            }
            return tx.team.findUniqueOrThrow({ where: { id: teamId }, include: teamInclude });
        });
        await this.audit.log({
            userId: actor.id,
            action: "ADD_TEAM_MEMBER",
            entityType: "Team",
            entityId: teamId,
            newValue: result,
            context
        });
        return result;
    }
    async updateMember(teamId, memberId, dto, actor, context) {
        const team = await this.findOne(teamId, actor);
        await this.ensureCanManageDepartment(actor, team.departmentId);
        const result = await this.prisma.$transaction(async (tx) => {
            const existing = await tx.teamMember.findFirst({
                where: { id: memberId, teamId },
                select: { id: true }
            });
            if (!existing) {
                throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Team member not found", "TEAM_MEMBER_NOT_FOUND");
            }
            const member = await tx.teamMember.update({
                where: { id: memberId },
                data: {
                    role: dto.role,
                    isActive: dto.isActive,
                    leftAt: dto.isActive === false ? (0, utils_1.toDateOnly)(new Date()) : dto.isActive === true ? null : undefined
                }
            });
            if (member.role === client_1.TeamMemberRole.LEAD && member.isActive) {
                await this.setTeamLead(tx, teamId, member.employeeId);
            }
            return tx.team.findUniqueOrThrow({ where: { id: teamId }, include: teamInclude });
        });
        await this.audit.log({
            userId: actor.id,
            action: "UPDATE_TEAM_MEMBER",
            entityType: "Team",
            entityId: teamId,
            newValue: result,
            context
        });
        return result;
    }
    async removeMember(teamId, memberId, actor, context) {
        const oldValue = await this.findOne(teamId, actor);
        await this.ensureCanManageDepartment(actor, oldValue.departmentId);
        const result = await this.prisma.$transaction(async (tx) => {
            const existing = await tx.teamMember.findFirst({
                where: { id: memberId, teamId },
                select: { id: true }
            });
            if (!existing) {
                throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Team member not found", "TEAM_MEMBER_NOT_FOUND");
            }
            const member = await tx.teamMember.update({
                where: { id: memberId },
                data: { isActive: false, leftAt: (0, utils_1.toDateOnly)(new Date()) }
            });
            if (oldValue.leadId === member.employeeId) {
                await tx.team.update({ where: { id: teamId }, data: { leadId: null } });
            }
            return tx.team.findUniqueOrThrow({ where: { id: teamId }, include: teamInclude });
        });
        await this.audit.log({
            userId: actor.id,
            action: "REMOVE_TEAM_MEMBER",
            entityType: "Team",
            entityId: teamId,
            oldValue,
            newValue: result,
            context
        });
        return result;
    }
    memberIds(memberIds, leadId) {
        return Array.from(new Set([...(memberIds ?? []), ...(leadId ? [leadId] : [])]));
    }
    scopedTeamWhere(actor, base) {
        if (actor.roles.includes("ADMIN")) {
            return base;
        }
        if (!actor.employeeId) {
            return { AND: [base, { id: -1 }] };
        }
        return {
            AND: [
                base,
                {
                    OR: [
                        { department: { managerId: actor.employeeId } },
                        { leadId: actor.employeeId },
                        { members: { some: { employeeId: actor.employeeId, isActive: true } } }
                    ]
                }
            ]
        };
    }
    async ensureCanManageDepartment(actor, departmentId) {
        if (actor.roles.includes("ADMIN")) {
            return;
        }
        if (!actor.employeeId) {
            throw new api_error_1.ApiError(common_1.HttpStatus.FORBIDDEN, "Department scope denied", "DEPARTMENT_SCOPE_DENIED");
        }
        const department = await this.prisma.department.findFirst({
            where: { id: departmentId, deletedAt: null, managerId: actor.employeeId },
            select: { id: true }
        });
        if (!department) {
            throw new api_error_1.ApiError(common_1.HttpStatus.FORBIDDEN, "Department scope denied", "DEPARTMENT_SCOPE_DENIED");
        }
    }
    async ensureDepartment(id) {
        const department = await this.prisma.department.findFirst({
            where: { id, deletedAt: null, isActive: true },
            select: { id: true }
        });
        if (!department) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Department not found", "DEPARTMENT_NOT_FOUND");
        }
    }
    async ensureEmployeesInDepartment(employeeIds, departmentId) {
        if (!employeeIds.length) {
            return;
        }
        const employees = await this.prisma.employee.findMany({
            where: (0, prisma_where_1.currentEmployeeWhere)({
                id: { in: employeeIds },
                departmentId,
                status: client_1.EmployeeStatus.ACTIVE
            }),
            select: { id: true }
        });
        if (employees.length !== employeeIds.length) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Team lead and members must belong to the selected department", "VALIDATION_ERROR");
        }
    }
    async syncMembers(tx, teamId, departmentId, leadId, memberIds = []) {
        const targetIds = this.memberIds(memberIds, leadId);
        await this.ensureEmployeesInDepartment(targetIds, departmentId);
        await tx.teamMember.updateMany({
            where: {
                teamId,
                isActive: true,
                ...(targetIds.length ? { employeeId: { notIn: targetIds } } : {})
            },
            data: { isActive: false, leftAt: (0, utils_1.toDateOnly)(new Date()) }
        });
        for (const employeeId of targetIds) {
            await this.activateMember(tx, teamId, employeeId, employeeId === leadId ? client_1.TeamMemberRole.LEAD : client_1.TeamMemberRole.MEMBER);
        }
        if (leadId) {
            await this.setTeamLead(tx, teamId, leadId);
        }
    }
    async ensureLeadMembership(tx, teamId, leadId) {
        if (!leadId) {
            return;
        }
        await this.activateMember(tx, teamId, leadId, client_1.TeamMemberRole.LEAD);
        await this.setTeamLead(tx, teamId, leadId);
    }
    async downgradePreviousLead(tx, teamId, oldLeadId, newLeadId) {
        if (!oldLeadId || oldLeadId === newLeadId) {
            return;
        }
        await tx.teamMember.updateMany({
            where: { teamId, employeeId: oldLeadId, isActive: true },
            data: { role: client_1.TeamMemberRole.MEMBER }
        });
    }
    async activateMember(tx, teamId, employeeId, role) {
        const activeMember = await tx.teamMember.findFirst({
            where: { teamId, employeeId, isActive: true },
            select: { id: true }
        });
        if (activeMember) {
            return tx.teamMember.update({
                where: { id: activeMember.id },
                data: { role, leftAt: null }
            });
        }
        return tx.teamMember.create({
            data: {
                teamId,
                employeeId,
                role,
                joinedAt: (0, utils_1.toDateOnly)(new Date()),
                isActive: true
            }
        });
    }
    async setTeamLead(tx, teamId, leadId) {
        await tx.team.update({ where: { id: teamId }, data: { leadId } });
        await tx.teamMember.updateMany({
            where: {
                teamId,
                employeeId: { not: leadId },
                isActive: true,
                role: client_1.TeamMemberRole.LEAD
            },
            data: { role: client_1.TeamMemberRole.MEMBER }
        });
    }
};
exports.TeamsService = TeamsService;
exports.TeamsService = TeamsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], TeamsService);
//# sourceMappingURL=teams.service.js.map