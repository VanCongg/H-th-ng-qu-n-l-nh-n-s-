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
exports.TaskWorkloadService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const access_control_service_1 = require("../common/services/access-control.service");
const prisma_where_1 = require("../common/prisma-where");
const utils_1 = require("../common/utils");
const activeStatuses = [
    client_1.TaskStatus.TODO,
    client_1.TaskStatus.IN_PROGRESS,
    client_1.TaskStatus.IN_REVIEW
];
let TaskWorkloadService = class TaskWorkloadService {
    prisma;
    accessControl;
    constructor(prisma, accessControl) {
        this.prisma = prisma;
        this.accessControl = accessControl;
    }
    async findAll(user, query) {
        const allowedIds = await this.employeeScope(user, query.scope ?? "all");
        const employeeIds = query.employeeId
            ? await this.singleEmployeeScope(user, query.employeeId, allowedIds)
            : allowedIds;
        const employees = await this.prisma.employee.findMany({
            where: (0, prisma_where_1.currentEmployeeWhere)({ id: { in: employeeIds } }),
            include: { department: true, position: true },
            orderBy: { fullName: "asc" }
        });
        const summaries = await this.summariesForEmployees(employees.map((item) => item.id));
        return employees.map((employee) => ({
            employee,
            workload: summaries.get(employee.id) ?? this.emptySummary(employee.id)
        }));
    }
    async summariesForEmployees(employeeIds) {
        const map = new Map();
        await Promise.all(employeeIds.map(async (employeeId) => {
            map.set(employeeId, await this.summaryForEmployee(employeeId));
        }));
        return map;
    }
    async summaryForEmployee(employeeId) {
        const today = (0, utils_1.toDateOnly)(new Date());
        const tasks = await this.prisma.task.findMany({
            where: {
                assigneeId: employeeId,
                deletedAt: null,
                status: { in: activeStatuses }
            },
            select: { estimatedHours: true, dueDate: true }
        });
        const totalEstimatedHours = tasks.reduce((total, task) => total + Number(task.estimatedHours ?? 4), 0);
        const overdueTaskCount = tasks.filter((task) => task.dueDate && task.dueDate < today).length;
        const capacityHoursPerWeek = 40;
        const availableHours = capacityHoursPerWeek - totalEstimatedHours;
        const workloadScore = Math.max(0, this.baseWorkloadScore(availableHours) - overdueTaskCount * 10);
        return {
            employeeId,
            activeTaskCount: tasks.length,
            totalEstimatedHours,
            overdueTaskCount,
            capacityHoursPerWeek,
            availableHours,
            workloadScore
        };
    }
    emptySummary(employeeId) {
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
    baseWorkloadScore(availableHours) {
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
    async singleEmployeeScope(user, employeeId, allowedIds) {
        await this.accessControl.ensureCanReadEmployee(user, employeeId);
        return allowedIds.includes(employeeId) ? [employeeId] : [];
    }
    async employeeScope(user, scope) {
        if (scope === "self") {
            return user.employeeId ? [user.employeeId] : [];
        }
        if (scope === "team") {
            return this.accessControl.teamEmployeeIds(user);
        }
        return this.defaultEmployeeScope(user);
    }
    async defaultEmployeeScope(user) {
        if (this.accessControl.isAdmin(user)) {
            return this.accessControl.candidateEmployeeIdsForTask(user);
        }
        if (this.accessControl.isManager(user)) {
            return this.accessControl.teamEmployeeIds(user);
        }
        return user.employeeId ? [user.employeeId] : [];
    }
};
exports.TaskWorkloadService = TaskWorkloadService;
exports.TaskWorkloadService = TaskWorkloadService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        access_control_service_1.AccessControlService])
], TaskWorkloadService);
//# sourceMappingURL=task-workload.service.js.map