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
exports.AccessControlService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const api_error_1 = require("../api-error");
const prisma_where_1 = require("../prisma-where");
const position_role_1 = require("../position-role");
const utils_1 = require("../utils");
let AccessControlService = class AccessControlService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    isAdmin(user) {
        return user.roles.includes("ADMIN");
    }
    isManager(user) {
        return user.roles.includes("MANAGER");
    }
    async ensureCanReadEmployee(user, employeeId) {
        if (this.isAdmin(user)) {
            return;
        }
        if (user.employeeId === employeeId) {
            return;
        }
        if (await this.isSubordinate(user, employeeId)) {
            return;
        }
        throw new api_error_1.ApiError(common_1.HttpStatus.FORBIDDEN, "Manager scope denied", "MANAGER_SCOPE_DENIED");
    }
    async ensureCanManageLeave(user, employeeId) {
        if (this.isAdmin(user)) {
            return;
        }
        if (user.employeeId === employeeId) {
            throw new api_error_1.ApiError(common_1.HttpStatus.FORBIDDEN, "You cannot approve or reject your own leave request", "MANAGER_SCOPE_DENIED");
        }
        if (!(await this.isSubordinate(user, employeeId))) {
            throw new api_error_1.ApiError(common_1.HttpStatus.FORBIDDEN, "Manager scope denied", "MANAGER_SCOPE_DENIED");
        }
    }
    async teamEmployeeIds(user) {
        if (!user.employeeId) {
            return [];
        }
        const today = (0, utils_1.toDateOnly)(new Date());
        const manualRows = await this.prisma.employeeManager.findMany({
            where: {
                managerId: user.employeeId,
                isActive: true,
                employee: (0, prisma_where_1.currentEmployeeWhere)(),
                manager: (0, prisma_where_1.currentEmployeeWhere)(),
                OR: [{ endDate: null }, { endDate: { gte: today } }]
            },
            select: { employeeId: true }
        });
        const manualIds = manualRows.map((row) => row.employeeId);
        const ledTeamRows = await this.prisma.teamMember.findMany({
            where: {
                isActive: true,
                employeeId: { not: user.employeeId },
                employee: (0, prisma_where_1.currentEmployeeWhere)({ status: client_1.EmployeeStatus.ACTIVE }),
                team: {
                    deletedAt: null,
                    isActive: true,
                    OR: [
                        { leadId: user.employeeId },
                        {
                            members: {
                                some: {
                                    employeeId: user.employeeId,
                                    isActive: true,
                                    role: client_1.TeamMemberRole.LEAD
                                }
                            }
                        }
                    ]
                }
            },
            select: { employeeId: true }
        });
        const ledTeamIds = ledTeamRows.map((row) => row.employeeId);
        if (!this.isManager(user)) {
            return Array.from(new Set([...manualIds, ...ledTeamIds]));
        }
        const manager = await this.prisma.employee.findFirst({
            where: (0, prisma_where_1.currentEmployeeWhere)({
                id: user.employeeId,
                status: client_1.EmployeeStatus.ACTIVE
            }),
            select: { departmentId: true }
        });
        if (!manager?.departmentId) {
            return Array.from(new Set([...manualIds, ...ledTeamIds]));
        }
        const managedDepartment = await this.prisma.department.findFirst({
            where: {
                id: manager.departmentId,
                deletedAt: null,
                managerId: user.employeeId
            },
            select: { id: true }
        });
        if (!managedDepartment) {
            return Array.from(new Set([...manualIds, ...ledTeamIds]));
        }
        const departmentRows = await this.prisma.employee.findMany({
            where: (0, prisma_where_1.currentEmployeeWhere)({
                departmentId: manager.departmentId,
                id: { not: user.employeeId },
                status: client_1.EmployeeStatus.ACTIVE,
                OR: [
                    { userId: null },
                    {
                        user: {
                            is: {
                                userRoles: {
                                    none: { role: { name: "MANAGER" } }
                                }
                            }
                        }
                    }
                ]
            }),
            select: {
                id: true,
                position: {
                    select: { code: true, name: true }
                }
            }
        });
        const departmentIds = departmentRows
            .filter((employee) => !(0, position_role_1.isManagerPosition)(employee.position))
            .map((employee) => employee.id);
        return Array.from(new Set([...manualIds, ...ledTeamIds, ...departmentIds]));
    }
    async managedTeamIds(user) {
        if (!user.employeeId) {
            return [];
        }
        const teams = await this.prisma.team.findMany({
            where: {
                deletedAt: null,
                isActive: true,
                OR: [
                    { leadId: user.employeeId },
                    {
                        members: {
                            some: {
                                employeeId: user.employeeId,
                                isActive: true,
                                role: client_1.TeamMemberRole.LEAD
                            }
                        }
                    }
                ]
            },
            select: { id: true }
        });
        return teams.map((team) => team.id);
    }
    async isSubordinate(user, employeeId) {
        if (!user.employeeId) {
            return false;
        }
        const teamIds = await this.teamEmployeeIds(user);
        return teamIds.includes(employeeId);
    }
    async ensureCanReadProject(user, projectId) {
        if (this.isAdmin(user)) {
            return;
        }
        const project = await this.prisma.project.findFirst({
            where: { id: projectId, deletedAt: null },
            include: {
                team: {
                    include: {
                        members: {
                            where: { isActive: true },
                            select: { employeeId: true }
                        }
                    }
                },
                tasks: {
                    where: { deletedAt: null },
                    select: { assigneeId: true, createdByUserId: true }
                }
            }
        });
        if (!project) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Project not found", "PROJECT_NOT_FOUND");
        }
        if (project.managerId && project.managerId === user.employeeId) {
            return;
        }
        if (project.team &&
            (project.team.leadId === user.employeeId ||
                project.team.members.some((member) => member.employeeId === user.employeeId))) {
            return;
        }
        const teamIds = await this.teamEmployeeIds(user);
        if (project.tasks.some((task) => (task.assigneeId && teamIds.includes(task.assigneeId)) ||
            task.createdByUserId === user.id)) {
            return;
        }
        throw new api_error_1.ApiError(common_1.HttpStatus.FORBIDDEN, "Project scope denied", "PROJECT_SCOPE_DENIED");
    }
    async ensureCanReadTask(user, taskId) {
        const task = await this.prisma.task.findFirst({
            where: { id: taskId, deletedAt: null },
            select: {
                assigneeId: true,
                createdByUserId: true,
                team: {
                    select: {
                        leadId: true,
                        members: {
                            where: { isActive: true },
                            select: { employeeId: true }
                        }
                    }
                }
            }
        });
        if (!task) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Task not found", "TASK_NOT_FOUND");
        }
        if (this.isAdmin(user)) {
            return task;
        }
        if (task.assigneeId && task.assigneeId === user.employeeId) {
            return task;
        }
        if (this.isManager(user)) {
            const teamIds = await this.teamEmployeeIds(user);
            if (task.createdByUserId === user.id ||
                (task.assigneeId && teamIds.includes(task.assigneeId)) ||
                task.team?.leadId === user.employeeId ||
                task.team?.members.some((member) => member.employeeId === user.employeeId)) {
                return task;
            }
        }
        throw new api_error_1.ApiError(common_1.HttpStatus.FORBIDDEN, "Task scope denied", "TASK_ASSIGNMENT_DENIED");
    }
    async ensureCanUpdateTask(user, taskId) {
        const task = await this.ensureCanReadTask(user, taskId);
        if (this.isAdmin(user) || this.isManager(user)) {
            return task;
        }
        throw new api_error_1.ApiError(common_1.HttpStatus.FORBIDDEN, "Task update denied", "TASK_ASSIGNMENT_DENIED");
    }
    async ensureCanUpdateTaskStatus(user, taskId) {
        const task = await this.ensureCanReadTask(user, taskId);
        if (this.isAdmin(user) ||
            this.isManager(user) ||
            task.assigneeId === user.employeeId) {
            return task;
        }
        throw new api_error_1.ApiError(common_1.HttpStatus.FORBIDDEN, "Task status update denied", "TASK_ASSIGNMENT_DENIED");
    }
    async ensureCanAssignToEmployee(user, employeeId) {
        const employee = await this.prisma.employee.findFirst({
            where: (0, prisma_where_1.currentEmployeeWhere)({ id: employeeId, status: client_1.EmployeeStatus.ACTIVE }),
            select: { id: true }
        });
        if (!employee) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Employee not found", "EMPLOYEE_NOT_FOUND");
        }
        if (this.isAdmin(user)) {
            return;
        }
        if (this.isManager(user) && (await this.isSubordinate(user, employeeId))) {
            return;
        }
        throw new api_error_1.ApiError(common_1.HttpStatus.FORBIDDEN, "Task assignee is outside manager scope", "TASK_ASSIGNEE_NOT_IN_MANAGER_SCOPE");
    }
    async ensureCanAssignTask(user, taskId, employeeId) {
        await this.ensureCanUpdateTask(user, taskId);
        await this.ensureCanAssignToEmployee(user, employeeId);
    }
    async candidateEmployeeIdsForTask(user) {
        if (this.isAdmin(user)) {
            const employees = await this.prisma.employee.findMany({
                where: (0, prisma_where_1.currentEmployeeWhere)({ status: client_1.EmployeeStatus.ACTIVE }),
                select: { id: true }
            });
            return employees.map((employee) => employee.id);
        }
        if (this.isManager(user)) {
            const teamIds = await this.teamEmployeeIds(user);
            if (!teamIds.length) {
                return [];
            }
            const employees = await this.prisma.employee.findMany({
                where: {
                    ...(0, prisma_where_1.currentEmployeeWhere)({ status: client_1.EmployeeStatus.ACTIVE }),
                    id: { in: teamIds }
                },
                select: { id: true }
            });
            return employees.map((employee) => employee.id);
        }
        return [];
    }
    async ensureCanGenerateTaskSuggestion(user, taskId) {
        if (!this.isAdmin(user) && !this.isManager(user)) {
            throw new api_error_1.ApiError(common_1.HttpStatus.FORBIDDEN, "AI suggestion denied", "TASK_ASSIGNMENT_DENIED");
        }
        await this.ensureCanReadTask(user, taskId);
    }
    async ensureCanReadEmployeeSkill(user, employeeId) {
        await this.ensureCanReadEmployee(user, employeeId);
    }
    async ensureCanUpdateEmployeeSkill(user, employeeId) {
        if (this.isAdmin(user)) {
            return;
        }
        if (this.isManager(user) && (await this.isSubordinate(user, employeeId))) {
            return;
        }
        throw new api_error_1.ApiError(common_1.HttpStatus.FORBIDDEN, "Employee skill update denied", "MANAGER_SCOPE_DENIED");
    }
};
exports.AccessControlService = AccessControlService;
exports.AccessControlService = AccessControlService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AccessControlService);
//# sourceMappingURL=access-control.service.js.map