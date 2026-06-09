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
const utils_1 = require("../common/utils");
let DashboardService = class DashboardService {
    prisma;
    accessControl;
    settings = {
        workWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
        leaveCalculation: "WEEKDAYS_ONLY",
        phase: "PHASE_1"
    };
    constructor(prisma, accessControl) {
        this.prisma = prisma;
        this.accessControl = accessControl;
    }
    async adminDashboard() {
        const today = (0, utils_1.toDateOnly)(new Date());
        const [totalEmployees, totalDepartments, totalPositions, activeUsers, pendingLeaveRequests, todayAttendanceRecords, recentAuditLogs] = await this.prisma.$transaction([
            this.prisma.employee.count({ where: { deletedAt: null } }),
            this.prisma.department.count({ where: { deletedAt: null } }),
            this.prisma.position.count({ where: { deletedAt: null } }),
            this.prisma.user.count({ where: { isActive: true, deletedAt: null } }),
            this.prisma.leaveRequest.count({
                where: { status: client_1.LeaveRequestStatus.PENDING }
            }),
            this.prisma.attendanceRecord.count({ where: { workDate: today } }),
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
            this.prisma.employee.count({ where: { id: { in: teamIds }, deletedAt: null } }),
            this.prisma.leaveRequest.count({
                where: {
                    employeeId: { in: teamIds },
                    status: client_1.LeaveRequestStatus.PENDING
                }
            }),
            this.prisma.attendanceRecord.count({
                where: { employeeId: { in: teamIds }, workDate: today }
            }),
            this.prisma.leaveRequest.findMany({
                where: { employeeId: { in: teamIds } },
                include: {
                    employee: true,
                    leaveType: true
                },
                orderBy: { createdAt: "desc" },
                take: 5
            }),
            this.prisma.employee.findMany({
                where: { id: { in: teamIds }, deletedAt: null },
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
    getSettings() {
        return this.settings;
    }
    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
        return this.settings;
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        access_control_service_1.AccessControlService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map