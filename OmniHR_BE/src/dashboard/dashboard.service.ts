import { Injectable } from "@nestjs/common";
import { LeaveRequestStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AccessControlService } from "../common/services/access-control.service";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { AuthUser } from "../common/types";
import { toDateOnly } from "../common/utils";
import { currentEmployeeWhere, currentUserWhere } from "../common/prisma-where";

const orgChartDepartmentInclude = {
  manager: { select: { id: true, fullName: true } },
  teams: {
    where: { deletedAt: null },
    include: {
      lead: { select: { id: true, fullName: true } },
      _count: { select: { members: { where: { isActive: true } } } }
    }
  },
  _count: { select: { employees: { where: currentEmployeeWhere() } } }
} satisfies Prisma.DepartmentInclude;

type OrgChartDepartment = Prisma.DepartmentGetPayload<{
  include: typeof orgChartDepartmentInclude;
}>;

type OrgChartNode = OrgChartDepartment & { children: OrgChartNode[] };

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

  async orgChart(): Promise<OrgChartNode[]> {
    const departments = await this.prisma.department.findMany({
      where: { deletedAt: null },
      include: orgChartDepartmentInclude,
      orderBy: { name: "asc" }
    });

    const byId = new Map<number, OrgChartNode>();
    const roots: OrgChartNode[] = [];
    for (const department of departments) {
      byId.set(department.id, { ...department, children: [] });
    }
    for (const department of byId.values()) {
      if (department.parentId && byId.has(department.parentId)) {
        byId.get(department.parentId)?.children.push(department);
      } else {
        roots.push(department);
      }
    }

    return roots;
  }

  async orgAnalytics() {
    const today = toDateOnly(new Date());
    const [departments, headcountByDepartment, totalActiveEmployees, todayAttendance] =
      await this.prisma.$transaction([
        this.prisma.department.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true }
        }),
        this.prisma.employee.groupBy({
          by: ["departmentId"],
          where: currentEmployeeWhere(),
          orderBy: { departmentId: "asc" },
          _count: true
        }),
        this.prisma.employee.count({ where: currentEmployeeWhere() }),
        this.prisma.attendanceRecord.count({
          where: { workDate: today, employee: currentEmployeeWhere() }
        })
      ]);

    const departmentNames = new Map(
      departments.map((department) => [department.id, department.name])
    );
    const byDepartment = headcountByDepartment
      .filter((row) => row.departmentId !== null)
      .map((row) => ({
        departmentId: row.departmentId as number,
        departmentName: departmentNames.get(row.departmentId as number) ?? "Unknown",
        headcount: Number(row._count ?? 0)
      }))
      .sort((a, b) => b.headcount - a.headcount);

    return {
      totalActiveEmployees,
      todayAttendance,
      attendanceRate: totalActiveEmployees > 0 ? todayAttendance / totalActiveEmployees : 0,
      byDepartment
    };
  }

  async getSettings() {
    return this.systemSettings.getSettings();
  }

  async updateSettings(settings: Record<string, unknown>) {
    return this.systemSettings.updateSettings(settings);
  }
}
