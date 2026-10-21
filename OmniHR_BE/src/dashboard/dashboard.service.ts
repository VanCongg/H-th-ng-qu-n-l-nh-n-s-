import { Injectable } from "@nestjs/common";
import {
  AttendanceRecordType,
  EmployeeStatus,
  LeaveRequestStatus,
  TeamMemberRole
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { AuthUser, RequestContext } from "../common/types";
import { toDateOnly } from "../common/utils";
import { currentEmployeeWhere } from "../common/prisma-where";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly systemSettings: SystemSettingsService,
    private readonly audit: AuditService
  ) {}

  async adminDashboard() {
    const today = toDateOnly(new Date());
    const [
      totalEmployees,
      totalDepartments,
      totalPositions,
      activeEmployees,
      pendingLeaveRequests,
      checkedInToday,
      recentAuditLogs
    ] = await this.prisma.$transaction([
      this.prisma.employee.count({ where: currentEmployeeWhere() }),
      this.prisma.department.count({ where: { deletedAt: null } }),
      this.prisma.position.count({ where: { deletedAt: null } }),
      // Employees, not user accounts: the admin account has no employee.
      this.prisma.employee.count({
        where: currentEmployeeWhere({ status: EmployeeStatus.ACTIVE })
      }),
      this.prisma.leaveRequest.count({
        where: {
          status: LeaveRequestStatus.PENDING,
          employee: currentEmployeeWhere()
        }
      }),
      // People who checked in today; counting records counted check-outs too.
      this.prisma.employee.count({
        where: currentEmployeeWhere({
          attendanceRecords: {
            some: { workDate: today, recordType: AttendanceRecordType.CHECK_IN }
          }
        })
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
      activeEmployees,
      pendingLeaveRequests,
      checkedInToday,
      recentAuditLogs
    };
  }

  async managerDashboard(user: AuthUser) {
    const teamIds = await this.accessControl.teamEmployeeIds(user);
    const today = toDateOnly(new Date());
    const [
      teamEmployees,
      pendingTeamLeaves,
      pendingCancellations,
      teamCheckedInToday,
      latestTeamLeaves,
      subordinateRows
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
      // Approved leave its owner asked to withdraw: still waiting on a decision.
      this.prisma.leaveRequest.count({
        where: {
          employeeId: { in: teamIds },
          status: LeaveRequestStatus.APPROVED,
          cancelRequestedAt: { not: null },
          employee: currentEmployeeWhere()
        }
      }),
      this.prisma.employee.count({
        where: currentEmployeeWhere({
          id: { in: teamIds },
          attendanceRecords: {
            some: { workDate: today, recordType: AttendanceRecordType.CHECK_IN }
          }
        })
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
      // Everyone in scope, not the five newest: the card is the manager's
      // view of who reports to them, and its count must match the stat.
      this.prisma.employee.findMany({
        where: currentEmployeeWhere({ id: { in: teamIds } }),
        include: {
          department: true,
          position: true,
          teamMemberships: {
            where: { isActive: true, team: { deletedAt: null, isActive: true } },
            select: { role: true, team: { select: { id: true, name: true, leadId: true } } }
          }
        },
        orderBy: { fullName: "asc" },
        take: 300
      })
    ]);

    // Team leads first - who a head actually works through - then by name.
    const subordinates = subordinateRows
      .map(({ teamMemberships, ...employee }) => {
        const teams = teamMemberships.map((membership) => ({
          id: membership.team.id,
          name: membership.team.name,
          isLead:
            membership.role === TeamMemberRole.LEAD ||
            membership.team.leadId === employee.id
        }));
        return { ...employee, teams, isTeamLead: teams.some((team) => team.isLead) };
      })
      .sort((a, b) => Number(b.isTeamLead) - Number(a.isTeamLead));

    return {
      teamEmployees,
      pendingTeamLeaves,
      pendingCancellations,
      teamCheckedInToday,
      latestTeamLeaves,
      subordinates
    };
  }

  async getSettings() {
    return this.systemSettings.getSettings();
  }

  async updateSettings(
    settings: Record<string, unknown>,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const before = await this.systemSettings.getSettings();
    const after = await this.systemSettings.updateSettings(settings);

    // Only the keys that moved, so the trail answers "who changed the
    // attendance radius" instead of repeating the whole settings blob. A save
    // that changed nothing is not a mutation, so it is not logged.
    const changed = Object.keys(after).filter(
      (key) =>
        JSON.stringify(before[key as keyof typeof before]) !==
        JSON.stringify(after[key as keyof typeof after])
    );
    if (changed.length) {
      await this.audit.log({
        userId: actor.id,
        action: "UPDATE_SYSTEM_SETTINGS",
        entityType: "SystemSetting",
        entityId: "default",
        oldValue: pick(before, changed),
        newValue: pick(after, changed),
        context
      });
    }

    return after;
  }
}

function pick(source: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, source[key]]));
}
