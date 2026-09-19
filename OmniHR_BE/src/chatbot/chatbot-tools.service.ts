import { HttpStatus, Injectable } from "@nestjs/common";
import {
  AttendanceRecordType,
  AttendanceStatus,
  ChatbotActionStatus,
  ChatbotActionType,
  EmployeeStatus,
  LeaveRequestStatus,
  PayrollPeriodStatus,
  Prisma,
  TaskStatus,
  TeamMemberRole,
} from "@prisma/client";
import { monthRange } from "../attendance/timesheet";
import { TimesheetService } from "../attendance/timesheet.service";
import { ANNUAL_LEAVE_CODE } from "../leave-balances/leave-accrual";
import { LeaveBalancesService } from "../leave-balances/leave-balances.service";
import { ApiError } from "../common/api-error";
import { currentEmployeeWhere } from "../common/prisma-where";
import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { AuthUser, RequestContext } from "../common/types";
import { calculateLeaveDays, toDateOnly } from "../common/utils";
import { LeaveRequestsService } from "../leave-requests/leave-requests.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  AiToolCall,
  ChatbotToolDefinition,
  PendingActionView,
  ToolExecutionResult,
} from "./types/chatbot.types";

const DEFAULT_PENDING_ACTION_TTL_MINUTES = 30;
const ACTIVE_TASK_STATUSES = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
];
const MAX_BIRTHDAY_RANGE_DAYS = 93;
const MAX_LEAVE_RANGE_DAYS = 31;
const WEEKDAY_INDEX: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

@Injectable()
export class ChatbotToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accessControl: AccessControlService,
    private readonly systemSettings: SystemSettingsService,
    private readonly leaveRequests: LeaveRequestsService,
    private readonly leaveBalances: LeaveBalancesService,
    private readonly timesheets: TimesheetService,
  ) {}

  availableTools(user: AuthUser): ChatbotToolDefinition[] {
    const tools: ChatbotToolDefinition[] = [
      {
        name: "get_attendance_policy",
        description:
          "Get current company attendance settings and working hours",
      },
      {
        name: "get_leave_types",
        description: "Get active leave types",
      },
    ];

    if (user.employeeId && this.hasAny(user, "EMPLOYEE_READ_SELF")) {
      tools.push({
        name: "get_my_profile",
        description:
          "Get current employee profile, department, position, and manager",
      });
      tools.push({
        name: "get_my_manager",
        description:
          "Get current employee department and direct or department manager",
      });
    }

    if (
      this.hasAny(
        user,
        "EMPLOYEE_READ_ALL",
        "EMPLOYEE_READ_TEAM",
        "EMPLOYEE_READ_SELF",
      )
    ) {
      tools.push({
        name: "get_employee_birthdays",
        description:
          "Find employee birthdays in the allowed scope without exposing birth year",
      });
      tools.push({
        name: "get_department_headcount",
        description: "Count active employees in company, team, or department scope",
      });
    }

    if (
      user.employeeId &&
      this.hasAny(user, "LEAVE_READ_SELF", "LEAVE_CREATE")
    ) {
      tools.push({
        name: "get_my_leave_balance",
        description: "Get current employee leave balance for a year",
      });
      tools.push({
        name: "get_my_leave_requests",
        description: "Get recent leave requests of the current employee",
      });
    }

    if (this.hasAny(user, "LEAVE_READ_ALL", "LEAVE_READ_TEAM", "LEAVE_READ_SELF")) {
      tools.push({
        name: "get_who_is_on_leave_today",
        description: "Find approved leaves on a specific date in allowed scope",
      });
      tools.push({
        name: "get_upcoming_leaves",
        description: "Find approved leaves in an upcoming date range in allowed scope",
      });
    }

    if (user.employeeId && this.hasAny(user, "LEAVE_CREATE")) {
      tools.push({
        name: "create_leave_request_draft",
        description:
          "Validate and prepare a leave request pending user confirmation",
      });
    }

    if (user.employeeId && this.hasAny(user, "LEAVE_CANCEL_SELF")) {
      tools.push({
        name: "cancel_my_pending_leave_request",
        description:
          "Prepare cancellation of the current employee pending leave request",
      });
    }

    if (user.employeeId && this.hasAny(user, "ATTENDANCE_READ_SELF")) {
      tools.push({
        name: "get_today_attendance",
        description: "Get current employee attendance records for today",
      });
    }

    if (
      this.hasAny(
        user,
        "ATTENDANCE_READ_ALL",
        "ATTENDANCE_READ_TEAM",
        "ATTENDANCE_READ_SELF",
      )
    ) {
      tools.push({
        name: "get_team_attendance_summary",
        description:
          "Summarize attendance for today or a date in the allowed employee scope",
      });
    }

    if (user.employeeId && this.hasAny(user, "TASK_READ_SELF")) {
      tools.push({
        name: "get_my_tasks",
        description: "Get current employee open tasks",
      });
      tools.push({
        name: "get_my_upcoming_tasks",
        description: "Get current employee upcoming or overdue tasks",
      });
    }

    if (this.hasAny(user, "TASK_READ_ALL", "TASK_READ_TEAM")) {
      tools.push({
        name: "get_team_task_summary",
        description: "Summarize active and overdue tasks in allowed team scope",
      });
    }

    if (user.employeeId && this.hasAny(user, "ATTENDANCE_READ_SELF")) {
      tools.push({
        name: "get_my_attendance_summary",
        description:
          "Monthly attendance of the current employee: days worked, late, early leave, missing check-out, absences",
      });
    }

    if (user.employeeId && this.hasAny(user, "EMPLOYEE_READ_SELF")) {
      tools.push({
        name: "get_my_payslip",
        description:
          "Finalized payslip of the current employee for a month (gross, deductions, net)",
      });
      tools.push({
        name: "get_my_team_members",
        description: "Teams of the current employee with their lead and members",
      });
    }

    if (user.employeeId && this.hasAny(user, "REVIEW_READ_SELF")) {
      tools.push({
        name: "get_my_performance_reviews",
        description:
          "Performance reviews of the current employee: cycle, step, ratings, manager comment",
      });
    }

    if (user.employeeId && this.hasAny(user, "TASK_READ_SELF")) {
      tools.push({
        name: "get_my_projects",
        description: "Projects the current employee has tasks in",
      });
      tools.push({
        name: "get_my_task_stats",
        description:
          "Monthly task statistics of the current employee: completed, on time, late, overdue, hours",
      });
    }

    if (
      user.employeeId &&
      this.hasAny(user, "EMPLOYEE_SKILL_READ", "EMPLOYEE_READ_SELF")
    ) {
      tools.push({
        name: "get_my_skills",
        description: "Skills recorded for the current employee",
      });
    }

    return tools;
  }

  async executeTool(
    conversationId: number,
    call: AiToolCall,
    user: AuthUser,
    context?: RequestContext,
  ): Promise<ToolExecutionResult> {
    const allowed = new Set(this.availableTools(user).map((tool) => tool.name));
    if (!allowed.has(call.toolName)) {
      return {
        toolName: call.toolName,
        success: false,
        errorCode: "CHATBOT_TOOL_FORBIDDEN",
        message: "Bạn không có quyền thực hiện thao tác này.",
      };
    }

    try {
      switch (call.toolName) {
        case "get_my_profile":
          return this.success(call.toolName, await this.getMyProfile(user));
        case "get_my_manager":
          return this.success(call.toolName, await this.getMyManager(user));
        case "get_my_leave_balance":
          return this.success(
            call.toolName,
            await this.getMyLeaveBalance(user, call.arguments),
          );
        case "get_my_leave_requests":
          return this.success(
            call.toolName,
            await this.getMyLeaveRequests(user, call.arguments),
          );
        case "get_leave_types":
          return this.success(call.toolName, await this.getLeaveTypes());
        case "get_employee_birthdays":
          return this.success(
            call.toolName,
            await this.getEmployeeBirthdays(user, call.arguments),
          );
        case "get_who_is_on_leave_today":
          return this.success(
            call.toolName,
            await this.getWhoIsOnLeaveToday(user, call.arguments),
          );
        case "get_upcoming_leaves":
          return this.success(
            call.toolName,
            await this.getUpcomingLeaves(user, call.arguments),
          );
        case "get_team_attendance_summary":
          return this.success(
            call.toolName,
            await this.getTeamAttendanceSummary(user, call.arguments),
          );
        case "create_leave_request_draft":
          return this.success(
            call.toolName,
            await this.createLeaveRequestDraft(
              conversationId,
              user,
              call.arguments,
              context,
            ),
          );
        case "cancel_my_pending_leave_request":
          return this.success(
            call.toolName,
            await this.cancelMyPendingLeaveRequestDraft(
              conversationId,
              user,
              call.arguments,
              context,
            ),
          );
        case "get_today_attendance":
          return this.success(
            call.toolName,
            await this.getTodayAttendance(user),
          );
        case "get_attendance_policy":
          return this.success(
            call.toolName,
            await this.systemSettings.getSettings(),
          );
        case "get_my_tasks":
          return this.success(
            call.toolName,
            await this.getMyTasks(user, call.arguments),
          );
        case "get_my_upcoming_tasks":
          return this.success(
            call.toolName,
            await this.getMyUpcomingTasks(user, call.arguments),
          );
        case "get_team_task_summary":
          return this.success(
            call.toolName,
            await this.getTeamTaskSummary(user, call.arguments),
          );
        case "get_department_headcount":
          return this.success(
            call.toolName,
            await this.getDepartmentHeadcount(user, call.arguments),
          );
        case "get_my_attendance_summary":
          return this.success(
            call.toolName,
            await this.getMyAttendanceSummary(user, call.arguments),
          );
        case "get_my_payslip":
          return this.success(
            call.toolName,
            await this.getMyPayslip(user, call.arguments),
          );
        case "get_my_performance_reviews":
          return this.success(
            call.toolName,
            await this.getMyPerformanceReviews(user, call.arguments),
          );
        case "get_my_projects":
          return this.success(call.toolName, await this.getMyProjects(user));
        case "get_my_skills":
          return this.success(call.toolName, await this.getMySkills(user));
        case "get_my_team_members":
          return this.success(
            call.toolName,
            await this.getMyTeamMembers(user),
          );
        case "get_my_task_stats":
          return this.success(
            call.toolName,
            await this.getMyTaskStats(user, call.arguments),
          );
        default:
          return {
            toolName: call.toolName,
            success: false,
            errorCode: "CHATBOT_TOOL_UNKNOWN",
            message: "Tôi chưa hỗ trợ thao tác này.",
          };
      }
    } catch (error) {
      await this.audit.log({
        userId: user.id,
        action: "CHATBOT_TOOL_CALL_FAILED",
        entityType: "ChatbotTool",
        entityId: call.toolName,
        newValue: this.errorSnapshot(error),
        context,
      });
      return {
        toolName: call.toolName,
        success: false,
        ...this.errorSnapshot(error),
      };
    }
  }

  async confirmAction(
    actionId: number,
    user: AuthUser,
    context?: RequestContext,
  ) {
    const action = await this.loadOwnedAction(actionId, user.id);
    await this.ensurePending(action, user.id, context);
    this.ensureActionPermission(action.actionType, user);
    let claimedAction = false;

    try {
      const claimed = await this.prisma.chatbotPendingAction.updateMany({
        where: {
          id: action.id,
          userId: user.id,
          status: ChatbotActionStatus.PENDING,
          expiresAt: { gt: new Date() },
        },
        data: { status: ChatbotActionStatus.CONFIRMED, confirmedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          "Action is not pending",
          "CHATBOT_ACTION_NOT_PENDING",
        );
      }
      claimedAction = true;

      await this.audit.log({
        userId: user.id,
        action: "CHATBOT_CONFIRM_ACTION",
        entityType: "ChatbotPendingAction",
        entityId: action.id,
        oldValue: { status: action.status },
        newValue: { status: ChatbotActionStatus.CONFIRMED },
        context,
      });

      const execution = await this.executeConfirmedAction(action, user, context);
      const updated = await this.prisma.chatbotPendingAction.update({
        where: { id: action.id },
        data: {
          status: ChatbotActionStatus.EXECUTED,
          result: this.toJsonValue(execution.result),
        },
      });

      await this.audit.log({
        userId: user.id,
        action: "CHATBOT_EXECUTE_ACTION",
        entityType: "ChatbotPendingAction",
        entityId: action.id,
        oldValue: { status: ChatbotActionStatus.CONFIRMED },
        newValue: { status: updated.status, ...execution.auditValue },
        context,
      });
      return {
        conversationId: action.conversationId,
        reply: execution.reply,
        data: {
          ...execution.data,
        },
      };
    } catch (error) {
      if (claimedAction) {
        await this.prisma.chatbotPendingAction.update({
          where: { id: action.id },
          data: {
            status: ChatbotActionStatus.FAILED,
            result: this.toJsonValue(this.errorSnapshot(error)),
          },
        });
        await this.audit.log({
          userId: user.id,
          action: "CHATBOT_TOOL_CALL_FAILED",
          entityType: "ChatbotPendingAction",
          entityId: action.id,
          newValue: this.errorSnapshot(error),
          context,
        });
      }
      throw error;
    }
  }

  async cancelAction(
    actionId: number,
    user: AuthUser,
    reason?: string,
    context?: RequestContext,
  ) {
    const action = await this.loadOwnedAction(actionId, user.id);
    await this.ensurePending(action, user.id, context);

    const updated = await this.prisma.chatbotPendingAction.updateMany({
      where: {
        id: action.id,
        userId: user.id,
        status: ChatbotActionStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      data: {
        status: ChatbotActionStatus.CANCELLED,
        cancelledAt: new Date(),
        result: reason ? this.toJsonValue({ reason }) : undefined,
      },
    });
    if (updated.count !== 1) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Action is not pending",
        "CHATBOT_ACTION_NOT_PENDING",
      );
    }

    await this.audit.log({
      userId: user.id,
      action: "CHATBOT_CANCEL_ACTION",
      entityType: "ChatbotPendingAction",
      entityId: action.id,
      oldValue: { status: action.status },
      newValue: { status: ChatbotActionStatus.CANCELLED, reason: reason ?? null },
      context,
    });

    return {
      conversationId: action.conversationId,
      reply: "Tôi đã hủy thao tác đang chờ xác nhận.",
      data: { actionId: action.id, status: ChatbotActionStatus.CANCELLED },
    };
  }

  private async getMyProfile(user: AuthUser) {
    const employeeId = this.requireEmployee(user);
    const today = toDateOnly(new Date());
    const employee = await this.prisma.employee.findFirst({
      where: currentEmployeeWhere({ id: employeeId }),
      include: {
        department: true,
        position: true,
        subordinateRelations: {
          where: {
            isActive: true,
            OR: [{ endDate: null }, { endDate: { gte: today } }],
          },
          include: {
            manager: { include: { department: true, position: true } },
          },
          orderBy: { startDate: "desc" },
          take: 1,
        },
      },
    });
    if (!employee) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Employee profile not found",
        "EMPLOYEE_NOT_FOUND",
      );
    }

    const manager = employee.subordinateRelations[0]?.manager ?? null;
    return {
      fullName: employee.fullName,
      employeeCode: employee.employeeCode,
      department: employee.department?.name ?? null,
      position: employee.position?.name ?? null,
      manager: manager?.fullName ?? null,
    };
  }

  private async getMyManager(user: AuthUser) {
    const employeeId = this.requireEmployee(user);
    const today = toDateOnly(new Date());
    const employee = await this.prisma.employee.findFirst({
      where: currentEmployeeWhere({ id: employeeId, status: EmployeeStatus.ACTIVE }),
      include: {
        department: {
          include: {
            manager: {
              include: { department: true, position: true },
            },
          },
        },
        position: true,
        subordinateRelations: {
          where: {
            isActive: true,
            OR: [{ endDate: null }, { endDate: { gte: today } }],
          },
          include: {
            manager: { include: { department: true, position: true } },
          },
          orderBy: { startDate: "desc" },
          take: 1,
        },
      },
    });
    if (!employee) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Employee profile not found",
        "EMPLOYEE_NOT_FOUND",
      );
    }

    const departmentManager =
      employee.department?.manager &&
      employee.department.manager.id !== employee.id
        ? employee.department.manager
        : null;
    const directManager = employee.subordinateRelations[0]?.manager ?? null;
    const manager = departmentManager ?? directManager;

    return {
      employeeId: String(employee.id),
      fullName: employee.fullName,
      departmentName: employee.department?.name ?? null,
      positionName: employee.position?.name ?? null,
      manager: manager
        ? {
            employeeId: String(manager.id),
            fullName: manager.fullName,
            positionName: manager.position?.name ?? null,
            departmentName: manager.department?.name ?? null,
          }
        : null,
    };
  }

  private async getMyLeaveBalance(
    user: AuthUser,
    args: Record<string, unknown>,
  ) {
    const employeeId = this.requireEmployee(user);
    const year = this.integerArg(args.year, new Date().getFullYear());
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31));
    const [leaveTypes, grouped, annual] = await Promise.all([
      this.prisma.leaveType.findMany({
        where: { isActive: true },
        orderBy: { code: "asc" },
      }),
      this.prisma.leaveRequest.groupBy({
        by: ["leaveTypeId", "status"],
        where: {
          employeeId,
          startDate: { gte: start },
          endDate: { lte: end },
          status: {
            in: [LeaveRequestStatus.APPROVED, LeaveRequestStatus.PENDING],
          },
        },
        _sum: { totalDays: true },
      }),
      this.leaveBalances.forSelf(user, year),
    ]);

    return {
      year,
      items: leaveTypes.map((leaveType) => {
        const approved =
          grouped.find(
            (item) =>
              item.leaveTypeId === leaveType.id &&
              item.status === LeaveRequestStatus.APPROVED,
          )?._sum.totalDays ?? 0;
        const pending =
          grouped.find(
            (item) =>
              item.leaveTypeId === leaveType.id &&
              item.status === LeaveRequestStatus.PENDING,
          )?._sum.totalDays ?? 0;
        const allowance = leaveType.annualAllowance ?? null;
        // Annual leave accrues monthly with seniority and carry-over, like the admin and app views.
        if (leaveType.code === ANNUAL_LEAVE_CODE) {
          return {
            leaveTypeId: leaveType.id,
            code: leaveType.code,
            name: leaveType.name,
            annualAllowance: allowance,
            accruedDays: annual.accruedDays,
            seniorityDays: annual.seniorityDays,
            carriedOverDays: annual.carriedOverDays,
            approvedDays: annual.usedDays,
            pendingDays: annual.pendingDays,
            remainingDays: annual.availableDays,
          };
        }
        return {
          leaveTypeId: leaveType.id,
          code: leaveType.code,
          name: leaveType.name,
          annualAllowance: allowance,
          approvedDays: approved,
          pendingDays: pending,
          remainingDays:
            allowance === null ? null : allowance - approved - pending,
        };
      }),
    };
  }

  private async getMyLeaveRequests(
    user: AuthUser,
    args: Record<string, unknown>,
  ) {
    const employeeId = this.requireEmployee(user);
    const status =
      typeof args.status === "string" && args.status in LeaveRequestStatus
        ? (args.status as LeaveRequestStatus)
        : undefined;
    return this.prisma.leaveRequest.findMany({
      where: { employeeId, status },
      include: { leaveType: true },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(this.integerArg(args.limit, 5), 1), 10),
    });
  }

  private getLeaveTypes() {
    return this.prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
    });
  }

  private async getEmployeeBirthdays(
    user: AuthUser,
    args: Record<string, unknown>,
  ) {
    const settings = await this.systemSettings.getSettings();
    const today = this.workDateFor(new Date(), settings.timezoneOffsetMinutes);
    const range = this.birthdayRange(args, today);
    const employeeIds = await this.readableEmployeeIds(user, args, {
      all: "EMPLOYEE_READ_ALL",
      team: "EMPLOYEE_READ_TEAM",
      self: "EMPLOYEE_READ_SELF",
    });
    if (!employeeIds.length) {
      return {
        month: range.month,
        fromDate: this.dateKey(range.fromDate),
        toDate: this.dateKey(range.toDate),
        items: [],
      };
    }

    const employees = await this.prisma.employee.findMany({
      where: currentEmployeeWhere({
        id: { in: employeeIds },
        status: EmployeeStatus.ACTIVE,
      }),
      select: {
        id: true,
        fullName: true,
        birthDate: true,
        department: { select: { name: true } },
      },
    });

    const items = employees
      .filter((employee) =>
        this.birthdayInRange(employee.birthDate, range.fromDate, range.toDate),
      )
      .sort((left, right) => {
        const leftNext = this.nextBirthdayTime(left.birthDate, range.fromDate);
        const rightNext = this.nextBirthdayTime(right.birthDate, range.fromDate);
        return leftNext - rightNext || left.fullName.localeCompare(right.fullName);
      })
      .map((employee) => ({
        employeeId: String(employee.id),
        fullName: employee.fullName,
        departmentName: employee.department?.name ?? null,
        birthday: this.birthdayKey(employee.birthDate),
      }));

    return {
      month: range.month,
      fromDate: this.dateKey(range.fromDate),
      toDate: this.dateKey(range.toDate),
      items,
    };
  }

  private async getWhoIsOnLeaveToday(
    user: AuthUser,
    args: Record<string, unknown>,
  ) {
    const settings = await this.systemSettings.getSettings();
    const today = this.workDateFor(new Date(), settings.timezoneOffsetMinutes);
    const date =
      typeof args.date === "string" && args.date.trim()
        ? this.dateArg(args.date, "date")
        : today;
    const employeeIds = await this.readableEmployeeIds(user, args, {
      all: "LEAVE_READ_ALL",
      team: "LEAVE_READ_TEAM",
      self: "LEAVE_READ_SELF",
    });

    return {
      date: this.dateKey(date),
      items: await this.leaveItems(employeeIds, date, date),
    };
  }

  private async getUpcomingLeaves(
    user: AuthUser,
    args: Record<string, unknown>,
  ) {
    const settings = await this.systemSettings.getSettings();
    const today = this.workDateFor(new Date(), settings.timezoneOffsetMinutes);
    const range = this.dateRange(args, today, 7, MAX_LEAVE_RANGE_DAYS);
    const employeeIds = await this.readableEmployeeIds(user, args, {
      all: "LEAVE_READ_ALL",
      team: "LEAVE_READ_TEAM",
      self: "LEAVE_READ_SELF",
    });

    return {
      fromDate: this.dateKey(range.fromDate),
      toDate: this.dateKey(range.toDate),
      items: await this.leaveItems(employeeIds, range.fromDate, range.toDate),
    };
  }

  private async leaveItems(employeeIds: number[], fromDate: Date, toDate: Date) {
    if (!employeeIds.length) {
      return [];
    }

    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: LeaveRequestStatus.APPROVED,
        startDate: { lte: toDate },
        endDate: { gte: fromDate },
      },
      include: {
        employee: { include: { department: true } },
        leaveType: true,
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    });

    return requests.map((request) => ({
      employeeId: String(request.employeeId),
      fullName: request.employee.fullName,
      departmentName: request.employee.department?.name ?? null,
      leaveTypeName: request.leaveType?.name ?? null,
      startDate: this.dateKey(request.startDate),
      endDate: this.dateKey(request.endDate),
    }));
  }

  private async getTeamAttendanceSummary(
    user: AuthUser,
    args: Record<string, unknown>,
  ) {
    const settings = await this.systemSettings.getSettings();
    const today = this.workDateFor(new Date(), settings.timezoneOffsetMinutes);
    const date =
      typeof args.date === "string" && args.date.trim()
        ? this.dateArg(args.date, "date")
        : today;
    const employeeIds = await this.readableEmployeeIds(user, args, {
      all: "ATTENDANCE_READ_ALL",
      team: "ATTENDANCE_READ_TEAM",
      self: "ATTENDANCE_READ_SELF",
    });
    const employees = employeeIds.length
      ? await this.prisma.employee.findMany({
          where: currentEmployeeWhere({
            id: { in: employeeIds },
            status: EmployeeStatus.ACTIVE,
          }),
          select: { id: true, fullName: true },
          orderBy: { fullName: "asc" },
        })
      : [];
    const scopedIds = employees.map((employee) => employee.id);
    const records = scopedIds.length
      ? await this.prisma.attendanceRecord.findMany({
          where: {
            employeeId: { in: scopedIds },
            workDate: date,
          },
          orderBy: { recordedAt: "asc" },
        })
      : [];

    const checkedInIds = new Set(
      records
        .filter((record) => record.recordType === AttendanceRecordType.CHECK_IN)
        .map((record) => record.employeeId),
    );
    const lateByEmployee = new Map<number, Date>();
    const earlyOutIds = new Set<number>();
    for (const record of records) {
      if (
        record.recordType === AttendanceRecordType.CHECK_IN &&
        record.attendanceStatus === AttendanceStatus.LATE &&
        !lateByEmployee.has(record.employeeId)
      ) {
        lateByEmployee.set(record.employeeId, record.recordedAt);
      }
      if (
        record.recordType === AttendanceRecordType.CHECK_OUT &&
        record.attendanceStatus === AttendanceStatus.EARLY_OUT
      ) {
        earlyOutIds.add(record.employeeId);
      }
    }

    return {
      date: this.dateKey(date),
      totalEmployees: employees.length,
      checkedInCount: checkedInIds.size,
      notCheckedInCount: employees.length - checkedInIds.size,
      lateCount: lateByEmployee.size,
      earlyOutCount: earlyOutIds.size,
      notCheckedInEmployees: employees
        .filter((employee) => !checkedInIds.has(employee.id))
        .map((employee) => ({
          employeeId: String(employee.id),
          fullName: employee.fullName,
        })),
      lateEmployees: employees
        .filter((employee) => lateByEmployee.has(employee.id))
        .map((employee) => ({
          employeeId: String(employee.id),
          fullName: employee.fullName,
          recordedAt: lateByEmployee.get(employee.id)!.toISOString(),
        })),
    };
  }

  private async createLeaveRequestDraft(
    conversationId: number,
    user: AuthUser,
    args: Record<string, unknown>,
    context?: RequestContext,
  ) {
    const employeeId = this.requireEmployee(user);
    const leaveTypeCode = this.stringArg(args.leaveTypeCode, "ANNUAL_LEAVE");
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { code: leaveTypeCode, isActive: true },
    });
    if (!leaveType) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Leave type not found",
        "LEAVE_TYPE_NOT_FOUND",
      );
    }

    const startDate = this.dateArg(args.startDate, "startDate");
    const endDate = this.dateArg(args.endDate, "endDate");
    if (startDate > endDate) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Start date must be before or equal to end date",
        "VALIDATION_ERROR",
      );
    }

    const settings = await this.systemSettings.getSettings();
    const totalDays = calculateLeaveDays(startDate, endDate, settings.workWeek);
    if (totalDays <= 0) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Leave range has no valid working days",
        "LEAVE_REQUEST_INVALID_DAYS",
      );
    }

    const overlap = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: {
          in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED],
        },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    });
    if (overlap) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Leave request overlaps with an existing pending or approved request",
        "LEAVE_REQUEST_OVERLAP",
      );
    }

    const reason = this.stringArg(args.reason, "Tạo từ HRGenie").slice(0, 1000);
    const payload = {
      leaveTypeId: leaveType.id,
      leaveTypeCode: leaveType.code,
      leaveTypeName: leaveType.name,
      startDate: this.dateKey(startDate),
      endDate: this.dateKey(endDate),
      totalDays,
      reason,
    };
    const action = await this.prisma.chatbotPendingAction.create({
      data: {
        conversationId,
        userId: user.id,
        actionType: ChatbotActionType.SUBMIT_LEAVE_REQUEST,
        payload: this.toJsonValue(payload),
        expiresAt: new Date(Date.now() + this.pendingActionTtlMs()),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: "CHATBOT_CREATE_PENDING_ACTION",
      entityType: "ChatbotPendingAction",
      entityId: action.id,
      newValue: payload,
      context,
    });

    return {
      pendingAction: this.pendingActionView(
        ChatbotActionType.SUBMIT_LEAVE_REQUEST,
        action.id,
        action.expiresAt,
        payload,
      ),
    };
  }

  private async cancelMyPendingLeaveRequestDraft(
    conversationId: number,
    user: AuthUser,
    args: Record<string, unknown>,
    context?: RequestContext,
  ) {
    const employeeId = this.requireEmployee(user);
    const leaveRequestId = this.optionalIntegerArg(args.leaveRequestId);
    const startDate =
      typeof args.startDate === "string" && args.startDate.trim()
        ? this.dateArg(args.startDate, "startDate")
        : undefined;

    const matches = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: LeaveRequestStatus.PENDING,
        ...(leaveRequestId ? { id: leaveRequestId } : {}),
        ...(startDate
          ? { startDate: { lte: startDate }, endDate: { gte: startDate } }
          : {}),
      },
      include: { leaveType: true },
      orderBy: { createdAt: "desc" },
      take: 2,
    });

    if (!matches.length) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Không tìm thấy đơn nghỉ đang chờ duyệt phù hợp để hủy.",
        "CHATBOT_LEAVE_REQUEST_NOT_FOUND",
      );
    }
    if (matches.length > 1) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Bạn có nhiều đơn nghỉ đang chờ duyệt. Vui lòng nói rõ ngày nghỉ hoặc mã đơn cần hủy.",
        "CHATBOT_LEAVE_REQUEST_AMBIGUOUS",
      );
    }

    const leaveRequest = matches[0];
    const payload = {
      leaveRequestId: leaveRequest.id,
      leaveType: leaveRequest.leaveType?.name ?? null,
      startDate: this.dateKey(leaveRequest.startDate),
      endDate: this.dateKey(leaveRequest.endDate),
      totalDays: leaveRequest.totalDays,
      reason: leaveRequest.reason,
      currentStatus: leaveRequest.status,
    };
    const action = await this.prisma.chatbotPendingAction.create({
      data: {
        conversationId,
        userId: user.id,
        actionType: ChatbotActionType.CANCEL_LEAVE_REQUEST,
        payload: this.toJsonValue(payload),
        expiresAt: new Date(Date.now() + this.pendingActionTtlMs()),
      },
    });

    await this.audit.log({
      userId: user.id,
      action: "CHATBOT_CREATE_PENDING_ACTION",
      entityType: "ChatbotPendingAction",
      entityId: action.id,
      newValue: payload,
      context,
    });

    return {
      pendingAction: this.pendingActionView(
        ChatbotActionType.CANCEL_LEAVE_REQUEST,
        action.id,
        action.expiresAt,
        payload,
      ),
    };
  }

  private async getTodayAttendance(user: AuthUser) {
    const employeeId = this.requireEmployee(user);
    const settings = await this.systemSettings.getSettings();
    const workDate = this.workDateFor(
      new Date(),
      settings.timezoneOffsetMinutes,
    );
    const records = await this.prisma.attendanceRecord.findMany({
      where: { employeeId, workDate },
      orderBy: { recordedAt: "asc" },
    });
    const latest = records[records.length - 1] ?? null;

    return {
      workDate: this.dateKey(workDate),
      checkedIn: records.some((item) => item.recordType === "CHECK_IN"),
      checkedOut: latest?.recordType === "CHECK_OUT",
      latestRecordType: latest?.recordType ?? null,
      latestRecordedAt: latest?.recordedAt ?? null,
      records,
    };
  }

  private async getMyTasks(user: AuthUser, args: Record<string, unknown>) {
    const employeeId = this.requireEmployee(user);
    const statuses = this.taskStatuses(args.status);
    return this.prisma.task.findMany({
      where: {
        assigneeId: employeeId,
        deletedAt: null,
        status: { in: statuses },
      },
      include: {
        project: true,
        department: true,
        team: true,
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: Math.min(Math.max(this.integerArg(args.limit, 10), 1), 20),
    });
  }

  private async getMyUpcomingTasks(
    user: AuthUser,
    args: Record<string, unknown>,
  ) {
    const employeeId = this.requireEmployee(user);
    const limit = Math.min(Math.max(this.integerArg(args.limit, 10), 1), 20);
    const mode = this.stringArg(args.mode, "upcoming");
    const includeOverdue = this.booleanArg(args.includeOverdue, mode === "overdue");
    const days = Math.min(Math.max(this.integerArg(args.days, 7), 1), 30);
    const today = toDateOnly(new Date());
    const endDate = new Date(today);
    endDate.setUTCDate(endDate.getUTCDate() + days);

    const dueDate =
      mode === "overdue"
        ? { lt: today }
        : mode === "today"
          ? { gte: today, lte: today }
          : includeOverdue
            ? { lte: endDate }
            : { gte: today, lte: endDate };

    const tasks = await this.prisma.task.findMany({
      where: {
        assigneeId: employeeId,
        deletedAt: null,
        status: {
          in: ACTIVE_TASK_STATUSES,
        },
        dueDate,
      },
      include: {
        project: true,
        department: true,
        team: true,
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    return {
      items: tasks.map((task) => ({
        taskId: String(task.id),
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ? this.dateKey(task.dueDate) : null,
        projectName: task.project?.name ?? null,
        isOverdue: Boolean(task.dueDate && toDateOnly(task.dueDate) < today),
      })),
    };
  }

  private async getTeamTaskSummary(
    user: AuthUser,
    args: Record<string, unknown>,
  ) {
    const where = await this.teamTaskWhere(user, args);
    const today = toDateOnly(new Date());
    const tasks = await this.prisma.task.findMany({
      where: {
        ...where,
        deletedAt: null,
        status: { in: ACTIVE_TASK_STATUSES },
      },
      include: {
        assignee: { select: { id: true, fullName: true } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 500,
    });

    const byStatus: Record<string, number> = {};
    for (const status of ACTIVE_TASK_STATUSES) {
      byStatus[status] = 0;
    }
    const assigneeCounts = new Map<number, { fullName: string; count: number }>();
    let overdueTaskCount = 0;

    for (const task of tasks) {
      byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
      if (task.dueDate && toDateOnly(task.dueDate) < today) {
        overdueTaskCount += 1;
      }
      if (task.assignee) {
        const current = assigneeCounts.get(task.assignee.id) ?? {
          fullName: task.assignee.fullName,
          count: 0,
        };
        current.count += 1;
        assigneeCounts.set(task.assignee.id, current);
      }
    }

    return {
      totalActiveTasks: tasks.length,
      overdueTaskCount,
      byStatus,
      topAssignees: Array.from(assigneeCounts.entries())
        .map(([employeeId, value]) => ({
          employeeId: String(employeeId),
          fullName: value.fullName,
          activeTaskCount: value.count,
        }))
        .sort((left, right) => right.activeTaskCount - left.activeTaskCount)
        .slice(0, 5),
    };
  }

  private async getDepartmentHeadcount(
    user: AuthUser,
    args: Record<string, unknown>,
  ) {
    const scope = this.scopeArg(args.scope);
    const employeeIds = await this.readableEmployeeIds(user, args, {
      all: "EMPLOYEE_READ_ALL",
      team: "EMPLOYEE_READ_TEAM",
      self: "EMPLOYEE_READ_SELF",
    });
    const employees = employeeIds.length
      ? await this.prisma.employee.findMany({
          where: currentEmployeeWhere({
            id: { in: employeeIds },
            status: EmployeeStatus.ACTIVE,
          }),
          include: { department: true },
          orderBy: { fullName: "asc" },
        })
      : [];
    const departmentCounts = new Map<
      number,
      { departmentId: string; departmentName: string; count: number }
    >();
    for (const employee of employees) {
      if (!employee.department) {
        continue;
      }
      const current = departmentCounts.get(employee.department.id) ?? {
        departmentId: String(employee.department.id),
        departmentName: employee.department.name,
        count: 0,
      };
      current.count += 1;
      departmentCounts.set(employee.department.id, current);
    }

    return {
      scope,
      count: employees.length,
      departments: Array.from(departmentCounts.values()).sort((left, right) =>
        left.departmentName.localeCompare(right.departmentName),
      ),
    };
  }

  private async getMyAttendanceSummary(
    user: AuthUser,
    args: Record<string, unknown>,
  ) {
    const employeeId = this.requireEmployee(user);
    const settings = await this.systemSettings.getSettings();
    const today = this.workDateFor(new Date(), settings.timezoneOffsetMinutes);
    const { year, month } = this.monthArg(args, today);
    const { start, end } = monthRange(year, month);

    const [timesheets, records, leaves, employee, firstRecord] = await Promise.all([
      this.timesheets.forEmployees(year, month, [employeeId]),
      this.prisma.attendanceRecord.findMany({
        where: { employeeId, workDate: { gte: start, lte: end } },
        select: { workDate: true, recordType: true, attendanceStatus: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: LeaveRequestStatus.APPROVED,
          startDate: { lte: end },
          endDate: { gte: start },
        },
        select: { startDate: true, endDate: true },
      }),
      this.prisma.employee.findUnique({
        where: { id: employeeId },
        select: { hireDate: true },
      }),
      this.prisma.attendanceRecord.findFirst({
        where: { employeeId },
        orderBy: { workDate: "asc" },
        select: { workDate: true },
      }),
    ]);
    const timesheet = timesheets.get(employeeId);

    const lateDays = new Set<string>();
    const earlyLeaveDays = new Set<string>();
    const attendedDays = new Set<string>();
    for (const record of records) {
      const day = this.dateKey(record.workDate);
      if (record.recordType === AttendanceRecordType.CHECK_IN) {
        attendedDays.add(day);
        if (record.attendanceStatus === AttendanceStatus.LATE) {
          lateDays.add(day);
        }
      }
      if (
        record.recordType === AttendanceRecordType.CHECK_OUT &&
        record.attendanceStatus === AttendanceStatus.EARLY_OUT
      ) {
        earlyLeaveDays.add(day);
      }
    }

    // A past work day with no check-in and no approved leave is an absence.
    // Today is left out: the employee may simply not have checked in yet.
    // Days before the hire date or before the employee's first ever record
    // (attendance was not tracked in OmniHR yet) are not absences either.
    const workDays = new Set(
      settings.workWeek.map((day) => WEEKDAY_INDEX[day.toUpperCase()]),
    );
    const trackedFrom = [start, employee?.hireDate, firstRecord?.workDate]
      .filter((value): value is Date => Boolean(value))
      .map((value) => toDateOnly(value))
      .reduce((latest, value) => (value > latest ? value : latest));
    const absentDates: string[] = [];
    for (
      let day = new Date(trackedFrom);
      day <= end && day < today;
      day = this.addDays(day, 1)
    ) {
      const key = this.dateKey(day);
      const onLeave = leaves.some(
        (leave) =>
          toDateOnly(leave.startDate) <= day && toDateOnly(leave.endDate) >= day,
      );
      if (workDays.has(day.getUTCDay()) && !attendedDays.has(key) && !onLeave) {
        absentDates.push(key);
      }
    }

    return {
      year,
      month,
      isCurrentMonth:
        year === today.getUTCFullYear() && month === today.getUTCMonth() + 1,
      standardWorkDays: timesheet?.standardWorkDays ?? 0,
      attendanceDays: timesheet?.attendanceDays ?? 0,
      paidLeaveDays: timesheet?.paidLeaveDays ?? 0,
      unpaidLeaveDays: timesheet?.unpaidLeaveDays ?? 0,
      lateCount: lateDays.size,
      lateMinutes: timesheet?.lateMinutes ?? 0,
      earlyLeaveCount: earlyLeaveDays.size,
      earlyLeaveMinutes: timesheet?.earlyLeaveMinutes ?? 0,
      missingCheckOuts: timesheet?.missingCheckOuts ?? 0,
      overtimeMinutes: timesheet?.overtimeMinutes ?? 0,
      workedHours: Math.round((timesheet?.workedMinutes ?? 0) / 6) / 10,
      absentDates,
    };
  }

  /** Only finalized payslips: a draft period can still change. */
  private async getMyPayslip(user: AuthUser, args: Record<string, unknown>) {
    const employeeId = this.requireEmployee(user);
    const requestedMonth = this.optionalIntegerArg(args.month);
    const settings = await this.systemSettings.getSettings();
    const today = this.workDateFor(new Date(), settings.timezoneOffsetMinutes);
    const target = requestedMonth ? this.monthArg(args, today) : null;

    const payslip = await this.prisma.payslip.findFirst({
      where: {
        employeeId,
        period: {
          status: PayrollPeriodStatus.FINALIZED,
          ...(target ? { year: target.year, month: target.month } : {}),
        },
      },
      include: { period: true },
      orderBy: [{ period: { year: "desc" } }, { period: { month: "desc" } }],
    });

    if (!payslip) {
      return { found: false, year: target?.year ?? null, month: target?.month ?? null };
    }
    return {
      found: true,
      year: payslip.period.year,
      month: payslip.period.month,
      baseSalary: payslip.baseSalary,
      allowance: payslip.allowance,
      standardWorkDays: payslip.standardWorkDays,
      payableDays: payslip.payableDays,
      grossSalary: payslip.grossSalary,
      overtimeMinutes: payslip.overtimeMinutes,
      overtimePay: payslip.overtimePay,
      lateAndEarlyMinutes: payslip.lateMinutes + payslip.earlyLeaveMinutes,
      attendanceDeduction: payslip.attendanceDeduction,
      insuranceDeduction: payslip.insuranceDeduction,
      netSalary: payslip.netSalary,
    };
  }

  private async getMyPerformanceReviews(
    user: AuthUser,
    args: Record<string, unknown>,
  ) {
    const employeeId = this.requireEmployee(user);
    const reviews = await this.prisma.performanceReview.findMany({
      where: { employeeId },
      include: { cycle: true },
      orderBy: { cycle: { startDate: "desc" } },
      take: Math.min(Math.max(this.integerArg(args.limit, 4), 1), 8),
    });
    return {
      items: reviews.map((review) => ({
        cycleName: review.cycle.name,
        cycleStatus: review.cycle.status,
        startDate: this.dateKey(review.cycle.startDate),
        endDate: this.dateKey(review.cycle.endDate),
        status: review.status,
        selfRating: review.selfRating,
        managerRating: review.managerRating,
        finalRating: review.finalRating,
        managerComment: review.managerComment,
      })),
    };
  }

  private async getMyProjects(user: AuthUser) {
    const employeeId = this.requireEmployee(user);
    const tasks = await this.prisma.task.findMany({
      where: {
        assigneeId: employeeId,
        deletedAt: null,
        project: { deletedAt: null },
      },
      select: {
        status: true,
        project: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            endDate: true,
            manager: { select: { fullName: true } },
          },
        },
      },
    });

    const projects = new Map<
      number,
      {
        code: string;
        name: string;
        status: string;
        endDate: string | null;
        managerName: string | null;
        openTaskCount: number;
        doneTaskCount: number;
      }
    >();
    for (const task of tasks) {
      if (!task.project) {
        continue;
      }
      const current = projects.get(task.project.id) ?? {
        code: task.project.code,
        name: task.project.name,
        status: task.project.status,
        endDate: task.project.endDate ? this.dateKey(task.project.endDate) : null,
        managerName: task.project.manager?.fullName ?? null,
        openTaskCount: 0,
        doneTaskCount: 0,
      };
      if ((ACTIVE_TASK_STATUSES as TaskStatus[]).includes(task.status)) {
        current.openTaskCount += 1;
      } else if (task.status === TaskStatus.DONE) {
        current.doneTaskCount += 1;
      }
      projects.set(task.project.id, current);
    }

    const items = Array.from(projects.values()).sort(
      (left, right) =>
        right.openTaskCount - left.openTaskCount ||
        right.doneTaskCount - left.doneTaskCount,
    );
    return { total: items.length, items: items.slice(0, 10) };
  }

  private async getMySkills(user: AuthUser) {
    const employeeId = this.requireEmployee(user);
    const skills = await this.prisma.employeeSkill.findMany({
      where: { employeeId, skill: { isActive: true } },
      include: { skill: true },
    });
    const rank = { EXPERT: 4, ADVANCED: 3, INTERMEDIATE: 2, BEGINNER: 1 };
    return {
      items: skills
        .map((item) => ({
          name: item.skill.name,
          category: item.skill.category,
          proficiency: item.proficiency,
          yearsExperience:
            item.yearsExperience === null ? null : Number(item.yearsExperience),
          lastUsedAt: item.lastUsedAt ? this.dateKey(item.lastUsedAt) : null,
        }))
        .sort(
          (left, right) =>
            rank[right.proficiency] - rank[left.proficiency] ||
            left.name.localeCompare(right.name),
        ),
    };
  }

  /** Names and positions only: enough to know who you work with. */
  private async getMyTeamMembers(user: AuthUser) {
    const employeeId = this.requireEmployee(user);
    const memberships = await this.prisma.teamMember.findMany({
      where: {
        employeeId,
        isActive: true,
        team: { isActive: true, deletedAt: null },
      },
      include: {
        team: {
          include: {
            lead: { select: { id: true, fullName: true } },
            members: {
              where: {
                isActive: true,
                employee: currentEmployeeWhere({ status: EmployeeStatus.ACTIVE }),
              },
              include: {
                employee: {
                  select: {
                    id: true,
                    fullName: true,
                    position: { select: { name: true } },
                  },
                },
              },
              orderBy: { employee: { fullName: "asc" } },
            },
          },
        },
      },
    });

    return {
      items: memberships.map(({ team }) => ({
        teamName: team.name,
        leadName: team.lead?.fullName ?? null,
        memberCount: team.members.length,
        members: team.members.map((member) => ({
          fullName: member.employee.fullName,
          positionName: member.employee.position?.name ?? null,
          isLead: member.role === TeamMemberRole.LEAD,
          isMe: member.employee.id === employeeId,
        })),
      })),
    };
  }

  private async getMyTaskStats(user: AuthUser, args: Record<string, unknown>) {
    const employeeId = this.requireEmployee(user);
    const settings = await this.systemSettings.getSettings();
    const today = this.workDateFor(new Date(), settings.timezoneOffsetMinutes);
    const { year, month } = this.monthArg(args, today);
    const { start, end } = monthRange(year, month);
    const monthEnd = this.addDays(end, 1);

    const [completed, assignedCount, overdueNow] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          assigneeId: employeeId,
          deletedAt: null,
          status: TaskStatus.DONE,
          completedAt: { gte: start, lt: monthEnd },
        },
        select: { dueDate: true, completedAt: true, actualHours: true },
      }),
      this.prisma.task.count({
        where: {
          assigneeId: employeeId,
          deletedAt: null,
          createdAt: { gte: start, lt: monthEnd },
        },
      }),
      this.prisma.task.count({
        where: {
          assigneeId: employeeId,
          deletedAt: null,
          status: { in: ACTIVE_TASK_STATUSES },
          dueDate: { lt: today },
        },
      }),
    ]);

    const onTime = completed.filter(
      (task) =>
        !task.dueDate ||
        (task.completedAt &&
          this.workDateFor(task.completedAt, settings.timezoneOffsetMinutes) <=
            toDateOnly(task.dueDate)),
    ).length;
    const actualHours = completed.reduce(
      (sum, task) => sum + Number(task.actualHours ?? 0),
      0,
    );

    return {
      year,
      month,
      completedCount: completed.length,
      onTimeCount: onTime,
      lateCount: completed.length - onTime,
      onTimeRate: completed.length
        ? Math.round((onTime / completed.length) * 100)
        : null,
      assignedCount,
      overdueOpenCount: overdueNow,
      actualHours: Math.round(actualHours * 10) / 10,
    };
  }

  private async loadOwnedAction(actionId: number, userId: number) {
    const action = await this.prisma.chatbotPendingAction.findFirst({
      where: { id: actionId, userId },
    });
    if (!action) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Pending action not found",
        "CHATBOT_ACTION_NOT_FOUND",
      );
    }
    return action;
  }

  private async ensurePending(action: {
    id: number;
    status: ChatbotActionStatus;
    expiresAt: Date;
  }, userId?: number, context?: RequestContext) {
    if (action.status !== ChatbotActionStatus.PENDING) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Action is not pending",
        "CHATBOT_ACTION_NOT_PENDING",
      );
    }

    if (action.expiresAt.getTime() <= Date.now()) {
      await this.prisma.chatbotPendingAction.update({
        where: { id: action.id },
        data: { status: ChatbotActionStatus.EXPIRED },
      });
      await this.audit.log({
        userId,
        action: "CHATBOT_EXPIRE_ACTION",
        entityType: "ChatbotPendingAction",
        entityId: action.id,
        oldValue: { status: action.status },
        newValue: { status: ChatbotActionStatus.EXPIRED },
        context,
      });
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Action has expired",
        "CHATBOT_ACTION_EXPIRED",
      );
    }
  }

  private async executeConfirmedAction(
    action: { id: number; actionType: ChatbotActionType; payload: unknown },
    user: AuthUser,
    context?: RequestContext,
  ) {
    if (action.actionType === ChatbotActionType.SUBMIT_LEAVE_REQUEST) {
      const payload = this.submitLeavePayload(action.payload);
      const leaveRequest = await this.leaveRequests.create(
        payload,
        user,
        context,
      );
      await this.audit.log({
        userId: user.id,
        action: "CREATE_LEAVE_REQUEST_BY_CHATBOT",
        entityType: "LeaveRequest",
        entityId: leaveRequest.id,
        newValue: leaveRequest,
        context,
      });
      return {
        result: leaveRequest,
        auditValue: { leaveRequestId: leaveRequest.id },
        reply: "Đơn nghỉ của bạn đã được nộp và đang chờ quản lý duyệt.",
        data: {
          leaveRequestId: leaveRequest.id,
          status: leaveRequest.status,
        },
      };
    }

    if (action.actionType === ChatbotActionType.CANCEL_LEAVE_REQUEST) {
      const payload = this.cancelLeavePayload(action.payload);
      const leaveRequest = await this.leaveRequests.cancel(
        payload.leaveRequestId,
        user,
        context,
      );
      await this.audit.log({
        userId: user.id,
        action: "CANCEL_LEAVE_REQUEST_BY_CHATBOT",
        entityType: "LeaveRequest",
        entityId: leaveRequest.id,
        newValue: leaveRequest,
        context,
      });
      return {
        result: leaveRequest,
        auditValue: { leaveRequestId: leaveRequest.id },
        reply: "Đơn nghỉ đang chờ duyệt đã được hủy.",
        data: {
          leaveRequestId: leaveRequest.id,
          status: leaveRequest.status,
        },
      };
    }

    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      "Unsupported chatbot action",
      "CHATBOT_ACTION_UNSUPPORTED",
    );
  }

  private submitLeavePayload(value: unknown) {
    const payload = isRecord(value) ? value : {};
    return {
      leaveTypeId: this.integerArg(payload.leaveTypeId, 0),
      startDate: this.stringArg(payload.startDate),
      endDate: this.stringArg(payload.endDate),
      reason: this.stringArg(payload.reason, "Tạo từ HRGenie").slice(0, 1000),
    };
  }

  private cancelLeavePayload(value: unknown) {
    const payload = isRecord(value) ? value : {};
    const leaveRequestId = this.integerArg(payload.leaveRequestId, 0);
    if (!leaveRequestId) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Leave request id is required",
        "VALIDATION_ERROR",
      );
    }
    return { leaveRequestId };
  }

  private pendingActionView(
    actionType: ChatbotActionType,
    actionId: number,
    expiresAt: Date,
    payload: Record<string, unknown>,
  ): PendingActionView {
    if (actionType === ChatbotActionType.CANCEL_LEAVE_REQUEST) {
      return {
        actionId,
        type: actionType,
        title: "Xác nhận hủy đơn nghỉ",
        summary: {
          leaveRequestId: payload.leaveRequestId,
          leaveType: payload.leaveType,
          startDate: payload.startDate,
          endDate: payload.endDate,
          totalDays: payload.totalDays,
          reason: payload.reason,
          currentStatus: payload.currentStatus,
        },
        expiresAt,
      };
    }

    return {
      actionId,
      type: actionType,
      title: "Xác nhận nộp đơn nghỉ",
      summary: {
        leaveType: payload.leaveTypeName,
        leaveTypeCode: payload.leaveTypeCode,
        startDate: payload.startDate,
        endDate: payload.endDate,
        totalDays: payload.totalDays,
        reason: payload.reason,
      },
      expiresAt,
    };
  }

  private success(toolName: string, data: unknown): ToolExecutionResult {
    if (isRecord(data) && isRecord(data.pendingAction)) {
      return {
        toolName,
        success: true,
        data,
        pendingAction: data.pendingAction as PendingActionView,
      };
    }
    return { toolName, success: true, data };
  }

  private errorSnapshot(error: unknown) {
    if (error instanceof ApiError) {
      const response = error.getResponse();
      if (isRecord(response)) {
        return {
          message: String(response.message ?? error.message),
          errorCode: String(response.errorCode ?? "CHATBOT_TOOL_FAILED"),
        };
      }
    }

    return {
      message: error instanceof Error ? error.message : "Tool execution failed",
      errorCode: "CHATBOT_TOOL_FAILED",
    };
  }

  private hasAny(user: AuthUser, ...permissions: string[]) {
    return permissions.some((permission) =>
      user.permissions.includes(permission),
    );
  }

  private requireEmployee(user: AuthUser) {
    if (!user.employeeId) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Employee profile not found",
        "EMPLOYEE_NOT_FOUND",
      );
    }
    return user.employeeId;
  }

  private ensureActionPermission(actionType: ChatbotActionType, user: AuthUser) {
    if (actionType === ChatbotActionType.SUBMIT_LEAVE_REQUEST) {
      this.requirePermission(user, "LEAVE_CREATE");
      return;
    }
    if (actionType === ChatbotActionType.CANCEL_LEAVE_REQUEST) {
      this.requirePermission(user, "LEAVE_CANCEL_SELF");
      return;
    }
  }

  private requirePermission(user: AuthUser, permission: string) {
    if (this.hasAny(user, permission)) {
      return;
    }
    throw new ApiError(
      HttpStatus.FORBIDDEN,
      "Forbidden",
      "FORBIDDEN",
    );
  }

  private async readableEmployeeIds(
    user: AuthUser,
    args: Record<string, unknown>,
    permissions: { all: string; team: string; self: string },
  ) {
    const scope = this.scopeArg(args.scope);
    if (this.accessControl.isAdmin(user) || this.hasAny(user, permissions.all)) {
      if (scope === "my_team" && user.employeeId) {
        const ids = await this.accessControl.teamEmployeeIds(user);
        return ids.length ? ids : [user.employeeId];
      }
      if (scope === "my_department" && user.employeeId) {
        const ids = await this.departmentEmployeeIdsForEmployee(user.employeeId);
        return ids.length ? ids : [user.employeeId];
      }
      return this.allActiveEmployeeIds();
    }

    if (scope === "company") {
      throw new ApiError(HttpStatus.FORBIDDEN, "Forbidden", "FORBIDDEN");
    }

    if (this.hasAny(user, permissions.team) && user.employeeId) {
      if (scope === "my_department") {
        const employee = await this.prisma.employee.findFirst({
          where: currentEmployeeWhere({ id: user.employeeId }),
          select: { departmentId: true },
        });
        if (
          employee?.departmentId &&
          (await this.accessControl.isDepartmentHead(user, employee.departmentId))
        ) {
          const ids = await this.departmentEmployeeIds(employee.departmentId);
          return ids.length ? ids : [user.employeeId];
        }
      }
      const ids = await this.accessControl.teamEmployeeIds(user);
      return ids.length ? ids : [user.employeeId];
    }

    if (this.hasAny(user, permissions.self) && user.employeeId) {
      return [user.employeeId];
    }

    return [];
  }

  private async allActiveEmployeeIds() {
    const employees = await this.prisma.employee.findMany({
      where: currentEmployeeWhere({ status: EmployeeStatus.ACTIVE }),
      select: { id: true },
    });
    return employees.map((employee) => employee.id);
  }

  private async departmentEmployeeIdsForEmployee(employeeId: number) {
    const employee = await this.prisma.employee.findFirst({
      where: currentEmployeeWhere({ id: employeeId }),
      select: { departmentId: true },
    });
    return employee?.departmentId
      ? this.departmentEmployeeIds(employee.departmentId)
      : [];
  }

  private async departmentEmployeeIds(departmentId: number) {
    const employees = await this.prisma.employee.findMany({
      where: currentEmployeeWhere({
        departmentId,
        status: EmployeeStatus.ACTIVE,
      }),
      select: { id: true },
    });
    return employees.map((employee) => employee.id);
  }

  private async teamTaskWhere(
    user: AuthUser,
    args: Record<string, unknown>,
  ): Promise<Prisma.TaskWhereInput> {
    const scope = this.scopeArg(args.scope);
    if (this.accessControl.isAdmin(user) || this.hasAny(user, "TASK_READ_ALL")) {
      if (scope === "my_team" && user.employeeId) {
        const managedTeamIds = await this.accessControl.managedTeamIds(user);
        return {
          teamId: { in: managedTeamIds.length ? managedTeamIds : [-1] },
        };
      }
      if (scope === "my_department" && user.employeeId) {
        return {
          OR: [
            { department: { managerId: user.employeeId } },
            { project: { department: { managerId: user.employeeId } } },
          ],
        };
      }
      return {};
    }

    if (!user.employeeId || !this.hasAny(user, "TASK_READ_TEAM")) {
      throw new ApiError(HttpStatus.FORBIDDEN, "Forbidden", "FORBIDDEN");
    }
    if (scope === "company") {
      throw new ApiError(HttpStatus.FORBIDDEN, "Forbidden", "FORBIDDEN");
    }

    const teamEmployeeIds = await this.accessControl.teamEmployeeIds(user);
    const managedTeamIds = await this.accessControl.managedTeamIds(user);
    const filters: Prisma.TaskWhereInput[] = [];
    if (teamEmployeeIds.length) {
      filters.push({ assigneeId: { in: teamEmployeeIds } });
    }
    if (managedTeamIds.length) {
      filters.push({ teamId: { in: managedTeamIds } });
    }
    filters.push(
      { department: { managerId: user.employeeId } },
      { project: { department: { managerId: user.employeeId } } },
    );

    return { OR: filters.length ? filters : [{ id: -1 }] };
  }

  private birthdayRange(args: Record<string, unknown>, today: Date) {
    if (
      (typeof args.fromDate === "string" && args.fromDate.trim()) ||
      (typeof args.toDate === "string" && args.toDate.trim())
    ) {
      const range = this.dateRange(args, today, 1, MAX_BIRTHDAY_RANGE_DAYS);
      return { ...range, month: undefined as number | undefined };
    }

    const currentMonth = today.getUTCMonth() + 1;
    const currentYear = today.getUTCFullYear();
    const month = this.integerArg(args.month, currentMonth);
    const year = this.integerArg(args.year, currentYear);
    if (month < 1 || month > 12) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Month must be between 1 and 12",
        "VALIDATION_ERROR",
      );
    }

    return {
      month,
      fromDate: new Date(Date.UTC(year, month - 1, 1)),
      toDate: new Date(Date.UTC(year, month, 0)),
    };
  }

  private dateRange(
    args: Record<string, unknown>,
    today: Date,
    defaultDays: number,
    maxDays: number,
  ) {
    const hasFrom = typeof args.fromDate === "string" && args.fromDate.trim();
    const hasTo = typeof args.toDate === "string" && args.toDate.trim();
    const fromDate = hasFrom ? this.dateArg(args.fromDate, "fromDate") : today;
    const toDate = hasTo
      ? this.dateArg(args.toDate, "toDate")
      : this.addDays(fromDate, defaultDays - 1);

    if (toDate < fromDate) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "toDate must be after or equal to fromDate",
        "VALIDATION_ERROR",
      );
    }
    if (this.daysBetween(fromDate, toDate) > maxDays) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Date range is too wide",
        "CHATBOT_DATE_RANGE_TOO_WIDE",
      );
    }

    return { fromDate, toDate };
  }

  private birthdayInRange(birthDate: Date, fromDate: Date, toDate: Date) {
    const birthMonth = birthDate.getUTCMonth();
    const birthDay = birthDate.getUTCDate();
    for (
      let year = fromDate.getUTCFullYear();
      year <= toDate.getUTCFullYear();
      year += 1
    ) {
      const birthday = new Date(Date.UTC(year, birthMonth, birthDay));
      if (birthday >= fromDate && birthday <= toDate) {
        return true;
      }
    }
    return false;
  }

  private nextBirthdayTime(birthDate: Date, fromDate: Date) {
    let birthday = new Date(
      Date.UTC(
        fromDate.getUTCFullYear(),
        birthDate.getUTCMonth(),
        birthDate.getUTCDate(),
      ),
    );
    if (birthday < fromDate) {
      birthday = new Date(
        Date.UTC(
          fromDate.getUTCFullYear() + 1,
          birthDate.getUTCMonth(),
          birthDate.getUTCDate(),
        ),
      );
    }
    return birthday.getTime();
  }

  private birthdayKey(value: Date) {
    const date = toDateOnly(value);
    return `${this.pad2(date.getUTCDate())}/${this.pad2(date.getUTCMonth() + 1)}`;
  }

  private scopeArg(value: unknown) {
    const scope = this.stringArg(value, "allowed");
    return ["company", "my_department", "my_team", "allowed"].includes(scope)
      ? scope
      : "allowed";
  }

  private booleanArg(value: unknown, fallback = false) {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      if (["true", "1", "yes"].includes(value.toLowerCase())) {
        return true;
      }
      if (["false", "0", "no"].includes(value.toLowerCase())) {
        return false;
      }
    }
    return fallback;
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private daysBetween(fromDate: Date, toDate: Date) {
    return Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
  }

  private pad2(value: number) {
    return value.toString().padStart(2, "0");
  }

  private stringArg(value: unknown, fallback = "") {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  private integerArg(value: unknown, fallback: number) {
    const numberValue =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : Number.NaN;
    return Number.isInteger(numberValue) ? numberValue : fallback;
  }

  private optionalIntegerArg(value: unknown) {
    const numberValue =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : Number.NaN;
    return Number.isInteger(numberValue) && numberValue > 0
      ? numberValue
      : undefined;
  }

  /**
   * Month and year from tool arguments, defaulting to the current month. A
   * month later than the current one with no year means last year's.
   */
  private monthArg(args: Record<string, unknown>, today: Date) {
    const currentYear = today.getUTCFullYear();
    const currentMonth = today.getUTCMonth() + 1;
    const requestedMonth = this.optionalIntegerArg(args.month);
    const requestedYear = this.optionalIntegerArg(args.year);
    const month =
      requestedMonth && requestedMonth <= 12 ? requestedMonth : currentMonth;
    const year =
      requestedYear && requestedYear >= 2000 && requestedYear <= 2100
        ? requestedYear
        : month > currentMonth
          ? currentYear - 1
          : currentYear;
    return { year, month };
  }

  private pendingActionTtlMs() {
    const minutes = Number(
      process.env.CHATBOT_PENDING_ACTION_TTL_MINUTES ??
        DEFAULT_PENDING_ACTION_TTL_MINUTES,
    );
    const safeMinutes = Number.isInteger(minutes)
      ? Math.min(Math.max(minutes, 1), 24 * 60)
      : DEFAULT_PENDING_ACTION_TTL_MINUTES;
    return safeMinutes * 60 * 1000;
  }

  private dateArg(value: unknown, field: string) {
    if (typeof value !== "string") {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        `${field} is required`,
        "VALIDATION_ERROR",
      );
    }
    const date = toDateOnly(value);
    if (Number.isNaN(date.getTime())) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        `${field} is invalid`,
        "VALIDATION_ERROR",
      );
    }
    return date;
  }

  private taskStatuses(value: unknown): TaskStatus[] {
    const raw = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? [value]
        : [];
    const statuses = raw.filter((item): item is TaskStatus =>
      Object.values(TaskStatus).includes(item as TaskStatus),
    );
    return statuses.length
      ? statuses
      : [TaskStatus.TODO, TaskStatus.IN_PROGRESS];
  }

  private workDateFor(recordedAt: Date, timezoneOffsetMinutes: number) {
    const local = new Date(
      recordedAt.getTime() + timezoneOffsetMinutes * 60_000,
    );
    return new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()),
    );
  }

  private dateKey(value: Date) {
    return toDateOnly(value).toISOString().slice(0, 10);
  }

  private toJsonValue(value: unknown) {
    return JSON.parse(JSON.stringify(value));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
