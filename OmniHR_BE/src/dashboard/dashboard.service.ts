import { Injectable } from "@nestjs/common";
import { LeaveRequestStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AccessControlService } from "../common/services/access-control.service";
import { AuthUser } from "../common/types";
import { toDateOnly } from "../common/utils";

@Injectable()
export class DashboardService {
  private settings: Record<string, unknown> = {
    workWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
    leaveCalculation: "WEEKDAYS_ONLY",
    phase: "PHASE_1"
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService
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
      this.prisma.employee.count({ where: { deletedAt: null } }),
      this.prisma.department.count({ where: { deletedAt: null } }),
      this.prisma.position.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { isActive: true, deletedAt: null } }),
      this.prisma.leaveRequest.count({
        where: { status: LeaveRequestStatus.PENDING }
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
      this.prisma.employee.count({ where: { id: { in: teamIds }, deletedAt: null } }),
      this.prisma.leaveRequest.count({
        where: {
          employeeId: { in: teamIds },
          status: LeaveRequestStatus.PENDING
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

  updateSettings(settings: Record<string, unknown>) {
    this.settings = { ...this.settings, ...settings };
    return this.settings;
  }
}
