import { HttpStatus, Injectable } from "@nestjs/common";
import { LeaveHalf, LeaveRequestStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/services/audit.service";
import { AccessControlService } from "../common/services/access-control.service";
import { HolidaysService } from "../common/services/holidays.service";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { AuthUser, RequestContext } from "../common/types";
import { calculateLeaveDays, pagination, toDateOnly } from "../common/utils";
import { currentEmployeeWhere } from "../common/prisma-where";
import { ANNUAL_LEAVE_CODE, companyToday, leaveDaysInYear } from "../leave-balances/leave-accrual";
import { LeaveBalancesService } from "../leave-balances/leave-balances.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { LeaveRequestQueryDto } from "./dto/leave-request-query.dto";
import { RejectLeaveRequestDto } from "./dto/reject-leave-request.dto";

const leaveInclude = {
  employee: {
    include: {
      department: true,
      position: true
    }
  },
  leaveType: true,
  approver: {
    select: { id: true, username: true, email: true }
  }
} satisfies Prisma.LeaveRequestInclude;

/**
 * Requests with at least one leave day in the month, so a leave that spans
 * 30/9-2/10 shows up under both September and October.
 */
export function leaveMonthWhere(year: number, month: number): Prisma.LeaveRequestWhereInput {
  return {
    startDate: { lte: new Date(Date.UTC(year, month, 0)) },
    endDate: { gte: new Date(Date.UTC(year, month - 1, 1)) }
  };
}

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accessControl: AccessControlService,
    private readonly systemSettings: SystemSettingsService,
    private readonly notifications: NotificationsService,
    private readonly leaveBalances: LeaveBalancesService,
    private readonly holidays: HolidaysService
  ) {}

  async create(
    dto: CreateLeaveRequestDto,
    user: AuthUser,
    context?: RequestContext
  ) {
    const employeeId = this.requireEmployee(user);
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id: dto.leaveTypeId, isActive: true }
    });
    if (!leaveType) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Leave type not found",
        "LEAVE_TYPE_NOT_FOUND"
      );
    }

    const startDate = toDateOnly(dto.startDate);
    const endDate = toDateOnly(dto.endDate);
    if (startDate > endDate) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Start date must be before or equal to end date",
        "VALIDATION_ERROR"
      );
    }

    const halfDay = dto.halfDay ?? null;
    if (halfDay && startDate.getTime() !== endDate.getTime()) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "A half-day leave covers a single day",
        "LEAVE_HALF_DAY_RANGE"
      );
    }

    const settings = await this.systemSettings.getSettings();
    // Holidays inside the range cost no leave: a week over Tết is not five days.
    const workingDays = calculateLeaveDays(
      startDate,
      endDate,
      settings.workWeek,
      await this.holidays.dateSet(startDate, endDate)
    );
    const totalDays = halfDay ? workingDays / 2 : workingDays;
    if (totalDays <= 0) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Leave range has no valid working days",
        "LEAVE_REQUEST_INVALID_DAYS"
      );
    }

    await this.ensureNoOverlap(employeeId, startDate, endDate, halfDay);
    await this.ensureAnnualBalance(
      employeeId,
      leaveType.code,
      { startDate, endDate, totalDays },
      settings.workWeek,
      "availableDays"
    );

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate,
        endDate,
        totalDays,
        halfDay,
        reason: dto.reason,
        status: LeaveRequestStatus.PENDING
      },
      include: leaveInclude
    });

    await this.audit.log({
      userId: user.id,
      action: "CREATE_LEAVE_REQUEST",
      entityType: "LeaveRequest",
      entityId: leaveRequest.id,
      newValue: leaveRequest,
      context
    });

    return leaveRequest;
  }

  async findAll(query: LeaveRequestQueryDto) {
    return this.paginatedList(this.buildWhere(query), query);
  }

  async findSelf(user: AuthUser, query: LeaveRequestQueryDto) {
    const employeeId = this.requireEmployee(user);
    return this.paginatedList({ ...this.buildWhere(query), employeeId }, query);
  }

  async findTeam(user: AuthUser, query: LeaveRequestQueryDto) {
    const teamIds = await this.accessControl.teamEmployeeIds(user);
    const scopedIds = query.employeeId
      ? teamIds.includes(query.employeeId)
        ? [query.employeeId]
        : []
      : teamIds;

    return this.paginatedList(
      { ...this.buildWhere(query), employeeId: { in: scopedIds } },
      query
    );
  }

  async findOne(id: number, user: AuthUser) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: leaveInclude
    });
    if (!leaveRequest) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Leave request not found",
        "LEAVE_REQUEST_NOT_FOUND"
      );
    }

    await this.accessControl.ensureCanReadEmployee(user, leaveRequest.employeeId);
    return leaveRequest;
  }

  async approve(id: number, user: AuthUser, context?: RequestContext) {
    const leaveRequest = await this.findPendingForDecision(id, user);
    // Checked again at approval: other requests may have been approved since
    // this one was filed. Only approved leave counts here, so a colleague's
    // request still waiting does not block this one.
    const settings = await this.systemSettings.getSettings();
    await this.ensureAnnualBalance(
      leaveRequest.employeeId,
      leaveRequest.leaveType.code,
      leaveRequest,
      settings.workWeek,
      "remainingDays"
    );
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveRequestStatus.APPROVED,
        approverUserId: user.id,
        approvedAt: new Date()
      },
      include: leaveInclude
    });

    await this.audit.log({
      userId: user.id,
      action: "APPROVE_LEAVE_REQUEST",
      entityType: "LeaveRequest",
      entityId: id,
      oldValue: leaveRequest,
      newValue: updated,
      context
    });

    if (updated.employee.userId) {
      await this.notifications.create(
        updated.employee.userId,
        "LEAVE_APPROVED",
        "Leave request approved",
        `Your leave request from ${updated.startDate.toDateString()} to ${updated.endDate.toDateString()} was approved.`,
        "LeaveRequest",
        updated.id
      );
    }

    return updated;
  }

  async reject(
    id: number,
    dto: RejectLeaveRequestDto,
    user: AuthUser,
    context?: RequestContext
  ) {
    const leaveRequest = await this.findPendingForDecision(id, user);
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveRequestStatus.REJECTED,
        approverUserId: user.id,
        approvedAt: new Date(),
        rejectionReason: dto.rejectionReason
      },
      include: leaveInclude
    });

    await this.audit.log({
      userId: user.id,
      action: "REJECT_LEAVE_REQUEST",
      entityType: "LeaveRequest",
      entityId: id,
      oldValue: leaveRequest,
      newValue: updated,
      context
    });

    if (updated.employee.userId) {
      await this.notifications.create(
        updated.employee.userId,
        "LEAVE_REJECTED",
        "Leave request rejected",
        dto.rejectionReason,
        "LeaveRequest",
        updated.id
      );
    }

    return updated;
  }

  /**
   * A pending request is simply withdrawn. An approved one has already been
   * planned around, so its owner can only ask: the leave stays approved - and
   * its days stay booked - until a manager accepts or turns the request down.
   * Only leave that has not started can be withdrawn; a leave under way is
   * settled with the manager directly.
   */
  async cancel(id: number, user: AuthUser, context?: RequestContext, reason?: string) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: leaveInclude
    });
    if (!leaveRequest) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Leave request not found",
        "LEAVE_REQUEST_NOT_FOUND"
      );
    }

    if (!this.accessControl.isAdmin(user) && leaveRequest.employeeId !== user.employeeId) {
      throw new ApiError(HttpStatus.FORBIDDEN, "Forbidden", "FORBIDDEN");
    }

    if (
      leaveRequest.status === LeaveRequestStatus.APPROVED &&
      leaveRequest.employeeId === user.employeeId
    ) {
      return this.requestCancellation(leaveRequest, user, context, reason);
    }

    if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Only pending leave request can be cancelled",
        "LEAVE_REQUEST_INVALID_STATUS"
      );
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveRequestStatus.CANCELLED,
        canceledAt: new Date()
      },
      include: leaveInclude
    });

    await this.audit.log({
      userId: user.id,
      action: "CANCEL_LEAVE_REQUEST",
      entityType: "LeaveRequest",
      entityId: id,
      oldValue: leaveRequest,
      newValue: updated,
      context
    });

    return updated;
  }

  /** A manager accepts the request: the leave is withdrawn and its days come back. */
  async approveCancellation(id: number, user: AuthUser, context?: RequestContext) {
    const leaveRequest = await this.findCancellationForDecision(id, user);
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: LeaveRequestStatus.CANCELLED, canceledAt: new Date() },
      include: leaveInclude
    });

    await this.audit.log({
      userId: user.id,
      action: "APPROVE_LEAVE_CANCELLATION",
      entityType: "LeaveRequest",
      entityId: id,
      oldValue: leaveRequest,
      newValue: updated,
      context
    });
    if (updated.employee.userId) {
      await this.notifications.create(
        updated.employee.userId,
        "LEAVE_CANCEL_APPROVED",
        "Leave cancellation approved",
        `Your leave from ${updated.startDate.toDateString()} to ${updated.endDate.toDateString()} was cancelled.`,
        "LeaveRequest",
        updated.id
      );
    }
    return updated;
  }

  /** A manager keeps the leave: the request is cleared and the leave stands. */
  async rejectCancellation(
    id: number,
    dto: RejectLeaveRequestDto,
    user: AuthUser,
    context?: RequestContext
  ) {
    const leaveRequest = await this.findCancellationForDecision(id, user);
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { cancelRequestedAt: null, cancelRequestReason: null },
      include: leaveInclude
    });

    await this.audit.log({
      userId: user.id,
      action: "REJECT_LEAVE_CANCELLATION",
      entityType: "LeaveRequest",
      entityId: id,
      oldValue: leaveRequest,
      newValue: { ...updated, rejectionReason: dto.rejectionReason },
      context
    });
    if (updated.employee.userId) {
      await this.notifications.create(
        updated.employee.userId,
        "LEAVE_CANCEL_REJECTED",
        "Leave cancellation rejected",
        dto.rejectionReason,
        "LeaveRequest",
        updated.id
      );
    }
    return updated;
  }

  private async requestCancellation(
    leaveRequest: Prisma.LeaveRequestGetPayload<{ include: typeof leaveInclude }>,
    user: AuthUser,
    context?: RequestContext,
    reason?: string
  ) {
    if (leaveRequest.cancelRequestedAt) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Cancellation of this leave is already waiting for a manager",
        "LEAVE_CANCEL_ALREADY_REQUESTED"
      );
    }
    const settings = await this.systemSettings.getSettings();
    if (leaveRequest.startDate <= companyToday(settings.timezoneOffsetMinutes)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "This leave has already started; ask your manager to change it",
        "LEAVE_ALREADY_STARTED"
      );
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id: leaveRequest.id },
      data: {
        cancelRequestedAt: new Date(),
        cancelRequestReason: reason?.trim() || null
      },
      include: leaveInclude
    });
    await this.audit.log({
      userId: user.id,
      action: "REQUEST_LEAVE_CANCELLATION",
      entityType: "LeaveRequest",
      entityId: leaveRequest.id,
      oldValue: leaveRequest,
      newValue: updated,
      context
    });

    // Whoever approved it decides again; failing that, the direct managers.
    const deciders = new Set<number>();
    if (leaveRequest.approverUserId) {
      deciders.add(leaveRequest.approverUserId);
    } else {
      const managers = await this.prisma.employeeManager.findMany({
        where: { employeeId: leaveRequest.employeeId, isActive: true },
        select: { manager: { select: { userId: true } } }
      });
      managers.forEach((row) => row.manager.userId && deciders.add(row.manager.userId));
    }
    deciders.delete(user.id);
    for (const userId of deciders) {
      await this.notifications.create(
        userId,
        "LEAVE_CANCEL_REQUESTED",
        "Leave cancellation requested",
        `${updated.employee.fullName} asked to cancel their leave from ${updated.startDate.toDateString()} to ${updated.endDate.toDateString()}.`,
        "LeaveRequest",
        updated.id
      );
    }
    return updated;
  }

  private async findCancellationForDecision(id: number, user: AuthUser) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: leaveInclude
    });
    if (!leaveRequest) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Leave request not found",
        "LEAVE_REQUEST_NOT_FOUND"
      );
    }
    if (leaveRequest.status !== LeaveRequestStatus.APPROVED || !leaveRequest.cancelRequestedAt) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Nobody asked to cancel this leave",
        "LEAVE_CANCEL_NOT_REQUESTED"
      );
    }
    await this.accessControl.ensureCanManageLeave(user, leaveRequest.employeeId);
    return leaveRequest;
  }

  private async findPendingForDecision(id: number, user: AuthUser) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: leaveInclude
    });
    if (!leaveRequest) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Leave request not found",
        "LEAVE_REQUEST_NOT_FOUND"
      );
    }

    if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Only pending leave request can be processed",
        "LEAVE_REQUEST_INVALID_STATUS"
      );
    }

    await this.accessControl.ensureCanManageLeave(user, leaveRequest.employeeId);
    return leaveRequest;
  }

  private async paginatedList(
    where: Prisma.LeaveRequestWhereInput,
    query: LeaveRequestQueryDto
  ) {
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.leaveRequest.findMany({
        where,
        include: leaveInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      this.prisma.leaveRequest.count({ where })
    ]);

    return { items, meta: { total, page, limit } };
  }

  private buildWhere(query: LeaveRequestQueryDto): Prisma.LeaveRequestWhereInput {
    return {
      status: query.status,
      employeeId: query.employeeId,
      leaveTypeId: query.leaveTypeId,
      employee: currentEmployeeWhere(
        query.departmentId ? { departmentId: query.departmentId } : undefined
      ),
      startDate: query.fromDate ? { gte: toDateOnly(query.fromDate) } : undefined,
      endDate: query.toDate ? { lte: toDateOnly(query.toDate) } : undefined,
      AND: query.month ? [leaveMonthWhere(query.year ?? new Date().getUTCFullYear(), query.month)] : undefined,
      ...(query.cancelRequested
        ? { status: LeaveRequestStatus.APPROVED, cancelRequestedAt: { not: null } }
        : {})
    };
  }

  /**
   * Annual leave cannot go past the days the employee has earned. Filing
   * compares against `availableDays`, so several pending requests cannot add
   * up to more than the balance; approving compares against `remainingDays`.
   * A request over New Year is checked against each year's own balance.
   * Other leave types (sick, unpaid) have no balance to run out of.
   */
  async ensureAnnualBalance(
    employeeId: number,
    leaveTypeCode: string,
    leave: { startDate: Date; endDate: Date; totalDays: number },
    workWeek: string[],
    basis: "availableDays" | "remainingDays"
  ) {
    if (leaveTypeCode !== ANNUAL_LEAVE_CODE) {
      return;
    }
    const holidays = await this.holidays.dateSet(leave.startDate, leave.endDate);
    for (
      let year = leave.startDate.getUTCFullYear();
      year <= leave.endDate.getUTCFullYear();
      year += 1
    ) {
      const needed = leaveDaysInYear(leave, year, workWeek, holidays);
      if (needed <= 0) {
        continue;
      }
      const yearEnd = new Date(Date.UTC(year, 11, 31));
      const balance = await this.leaveBalances.annualBalanceOn(
        employeeId,
        year,
        leave.endDate < yearEnd ? leave.endDate : yearEnd
      );
      if (!balance) {
        return;
      }
      const left = Math.max(0, balance[basis]);
      if (needed > left) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          `Not enough annual leave: ${left} day(s) left for ${year}, this request needs ${needed}`,
          "LEAVE_BALANCE_INSUFFICIENT"
        );
      }
    }
  }

  /**
   * One leave per day, except that a morning and an afternoon half day can
   * share a date - they are two halves, not a clash. Public so HRGenie refuses
   * a clash before the employee confirms.
   */
  async ensureNoOverlap(
    employeeId: number,
    startDate: Date,
    endDate: Date,
    halfDay: LeaveHalf | null = null
  ) {
    const overlapping = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED] },
        startDate: { lte: endDate },
        endDate: { gte: startDate }
      },
      select: { halfDay: true }
    });
    const clash = overlapping.some(
      (other) => !(halfDay && other.halfDay && other.halfDay !== halfDay)
    );

    if (clash) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Leave request overlaps with an existing pending or approved request",
        "LEAVE_REQUEST_OVERLAP"
      );
    }
  }

  private requireEmployee(user: AuthUser) {
    if (!user.employeeId) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Employee profile not found",
        "EMPLOYEE_NOT_FOUND"
      );
    }
    return user.employeeId;
  }
}
