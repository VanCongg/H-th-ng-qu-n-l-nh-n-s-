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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const access_control_service_1 = require("../common/services/access-control.service");
const system_settings_service_1 = require("../common/services/system-settings.service");
const utils_1 = require("../common/utils");
const prisma_where_1 = require("../common/prisma-where");
let DashboardService = class DashboardService {
    prisma;
    accessControl;
    systemSettings;
    constructor(prisma, accessControl, systemSettings) {
        this.prisma = prisma;
        this.accessControl = accessControl;
        this.systemSettings = systemSettings;
    }
    async adminDashboard() {
        const today = (0, utils_1.toDateOnly)(new Date());
        const [totalEmployees, totalDepartments, totalPositions, activeUsers, pendingLeaveRequests, todayAttendanceRecords, recentAuditLogs] = await this.prisma.$transaction([
            this.prisma.employee.count({ where: (0, prisma_where_1.currentEmployeeWhere)() }),
            this.prisma.department.count({ where: { deletedAt: null } }),
            this.prisma.position.count({ where: { deletedAt: null } }),
            this.prisma.user.count({ where: (0, prisma_where_1.currentUserWhere)({ isActive: true }) }),
            this.prisma.leaveRequest.count({
                where: {
                    status: client_1.LeaveRequestStatus.PENDING,
                    employee: (0, prisma_where_1.currentEmployeeWhere)()
                }
            }),
            this.prisma.attendanceRecord.count({
                where: { workDate: today, employee: (0, prisma_where_1.currentEmployeeWhere)() }
            }),
            this.prisma.auditLog.findMany({
                include: {
                    user: { select: { id: true, username: true, email: true } }
                },
                orderBy: { createdAt: "desc" },
                take: 10
            })
        ]);
        return {
            totalEmployees,
            totalDepartments,
            totalPositions,
            activeUsers,
            pendingLeaveRequests,
            todayAttendanceRecords,
            recentAuditLogs
        };
    }
    async managerDashboard(user) {
        const teamIds = await this.accessControl.teamEmployeeIds(user);
        const today = (0, utils_1.toDateOnly)(new Date());
        const [teamEmployees, pendingTeamLeaves, todayTeamAttendance, latestTeamLeaves, latestSubordinates] = await this.prisma.$transaction([
            this.prisma.employee.count({
                where: (0, prisma_where_1.currentEmployeeWhere)({ id: { in: teamIds } })
            }),
            this.prisma.leaveRequest.count({
                where: {
                    employeeId: { in: teamIds },
                    status: client_1.LeaveRequestStatus.PENDING,
                    employee: (0, prisma_where_1.currentEmployeeWhere)()
                }
            }),
            this.prisma.attendanceRecord.count({
                where: {
                    employeeId: { in: teamIds },
                    workDate: today,
                    employee: (0, prisma_where_1.currentEmployeeWhere)()
                }
            }),
            this.prisma.leaveRequest.findMany({
                where: { employeeId: { in: teamIds }, employee: (0, prisma_where_1.currentEmployeeWhere)() },
                include: {
                    employee: true,
                    leaveType: true
                },
                orderBy: { createdAt: "desc" },
                take: 5
            }),
            this.prisma.employee.findMany({
                where: (0, prisma_where_1.currentEmployeeWhere)({ id: { in: teamIds } }),
                include: { department: true, position: true },
                orderBy: { createdAt: "desc" },
                take: 5
            })
        ]);
        return {
            teamEmployees,
            pendingTeamLeaves,
            todayTeamAttendance,
            latestTeamLeaves,
            latestSubordinates
        };
    }
    async getSettings() {
        return this.systemSettings.getSettings();
    }
    async updateSettings(settings) {
        return this.systemSettings.updateSettings(settings);
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        access_control_service_1.AccessControlService,
        system_settings_service_1.SystemSettingsService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map