import { Injectable } from "@nestjs/common";
import { LeaveRequestStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AccessControlService } from "../common/services/access-control.service";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { AuthUser } from "../common/types";
import { toDateOnly } from "../common/utils";
import { currentEmployeeWhere, currentUserWhere } from "../common/prisma-where";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly systemSettings: SystemSettingsService
  ) {}

  async adminDashboard() {
    const today = toDateOnly(new Date());
    const [
      totalEmployees,
      totalDepartments,
      totalPositions,
      activeUsers,
      pendingLeaveRequests,
      todayAttendanceRecords,
      recentAuditLogs
    ] = await this.prisma.$transaction([
      this.prisma.employee.count({ where: currentEmployeeWhere() }),
      this.prisma.department.count({ where: { deletedAt: null } }),
      this.prisma.position.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: currentUserWhere({ isActive: true }) }),
      this.prisma.leaveRequest.count({
        where: {
          status: LeaveRequestStatus.PENDING,
          employee: currentEmployeeWhere()
        }
      }),
      this.prisma.attendanceRecord.count({
        where: { workDate: today, employee: currentEmployeeWhere() }
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

  async managerDashboard(user: AuthUser) {
    const teamIds = await this.accessControl.teamEmployeeIds(user);
    const today = toDateOnly(new Date());
    const [
      teamEmployees,
      pendingTeamLeaves,
      todayTeamAttendance,
      latestTeamLeaves,
      latestSubordinates
    ] = await this.prisma.$transaction([
      this.prisma.employee.count({
        where: currentEmployeeWhere({ id: { in: teamIds } })
      }),
      this.prisma.leaveRequest.count({
        where: {
          employeeId: { in: teamIds },
          status: LeaveRequestStatus.PENDING,
          employee: currentEmployeeWhere()
        }
      }),
      this.prisma.attendanceRecord.count({
        where: {
          employeeId: { in: teamIds },
          workDate: today,
          employee: currentEmployeeWhere()
        }
      }),
      this.prisma.leaveRequest.findMany({
        where: { employeeId: { in: teamIds }, employee: currentEmployeeWhere() },
        include: {
          employee: true,
          leaveType: true
        },
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      this.prisma.employee.findMany({
        where: currentEmployeeWhere({ id: { in: teamIds } }),
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

  async updateSettings(settings: Record<string, unknown>) {
    return this.systemSettings.updateSettings(settings);
  }
}
