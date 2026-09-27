import { HttpStatus, Injectable } from "@nestjs/common";
import { EmployeeStatus, LeaveRequestStatus, LeaveType, Prisma } from "@prisma/client";
import { ApiError } from "../common/api-error";
import { employeeSearchWhere } from "../common/prisma-where";
import { HolidaysService } from "../common/services/holidays.service";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { AuthUser } from "../common/types";
import { pagination } from "../common/utils";
import { PrismaService } from "../prisma/prisma.service";
import { LeaveBalanceQueryDto } from "./dto/leave-balance-query.dto";
import {
  ANNUAL_LEAVE_CODE,
  AnnualLeavePolicy,
  annualLeaveBalance,
  carriedOverDays,
  companyToday,
  DEFAULT_ANNUAL_ALLOWANCE,
  leaveDaysBetween,
  leaveDaysInYear
} from "./leave-accrual";

const balanceEmployeeSelect = {
  id: true,
  employeeCode: true,
  fullName: true,
  companyEmail: true,
  hireDate: true,
  department: { select: { id: true, code: true, name: true } },
  position: { select: { id: true, code: true, name: true } }
} satisfies Prisma.EmployeeSelect;

type AnnualLeaveRecord = {
  status: LeaveRequestStatus;
  startDate: Date;
  endDate: Date;
  totalDays: number;
};

type BalanceContext = {
  asOf: Date;
  year: number;
  /** Leave after this day is ignored in `year`: the end of the chosen month, or the year's end. */
  leaveCutoff: Date;
  annualType: LeaveType | null;
  workWeek: string[];
  /** Holidays from tracking start to the end of `year`: splitting a leave recounts its days. */
  holidays: ReadonlySet<number>;
  trackingStartYear: number;
  policy: AnnualLeavePolicy;
};

@Injectable()
export class LeaveBalancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettings: SystemSettingsService,
    private readonly holidays: HolidaysService
  ) {}

  /** Annual leave balances of active employees, filtered, sorted and paginated. */
  async list(query: LeaveBalanceQueryDto) {
    const context = await this.context(query.year, query.month);
    const employees = await this.prisma.employee.findMany({
      where: {
        AND: [
          employeeSearchWhere(query.search, query.departmentId),
          { status: EmployeeStatus.ACTIVE }
        ]
      },
      select: balanceEmployeeSelect,
      orderBy: { employeeCode: "asc" }
    });
    const leaves = await this.annualLeaves(
      context,
      employees.map((employee) => employee.id)
    );

    const rows = employees.map((employee) => ({
      employee,
      ...this.balanceFor(context, employee.hireDate, leaves.get(employee.id) ?? [])
    }));
    const filtered = query.balance
      ? rows.filter((row) => row.status === query.balance)
      : rows;
    if (query.sortBy === "remainingAsc" || query.sortBy === "remainingDesc") {
      const direction = query.sortBy === "remainingAsc" ? 1 : -1;
      filtered.sort(
        (a, b) =>
          (a.remainingDays - b.remainingDays) * direction ||
          a.employee.employeeCode.localeCompare(b.employee.employeeCode)
      );
    }

    const { skip, take, page, limit } = pagination(query.page, query.limit);
    return {
      items: filtered.slice(skip, skip + take),
      meta: { total: filtered.length, page, limit },
      summary: {
        year: context.year,
        month: query.month ?? null,
        asOf: context.asOf,
        annualAllowance: context.policy.annualAllowance,
        seniorityEveryYears: context.policy.seniorityEveryYears,
        carryOverMaxDays: context.policy.carryOverMaxDays,
        annualLeaveTypeConfigured: Boolean(context.annualType?.isActive),
        totalEmployees: rows.length,
        lowCount: rows.filter((row) => row.status === "LOW").length,
        exhaustedCount: rows.filter((row) => row.status === "EXHAUSTED").length,
        missingHireDateCount: rows.filter((row) => row.hireDateMissing).length
      }
    };
  }

  /** The signed-in employee's own annual leave balance. */
  async forSelf(user: AuthUser, requestedYear?: number) {
    const employeeId = user.employeeId;
    if (!employeeId) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Employee profile not found",
        "EMPLOYEE_NOT_FOUND"
      );
    }
    const context = await this.context(requestedYear);
    const [employee, leaves] = await Promise.all([
      this.prisma.employee.findUnique({
        where: { id: employeeId },
        select: { hireDate: true }
      }),
      this.annualLeaves(context, [employeeId])
    ]);
    const hireDate = employee?.hireDate ?? null;

    return {
      leaveTypeId: context.annualType?.id ?? null,
      asOf: context.asOf,
      hireDate,
      ...this.balanceFor(context, hireDate, leaves.get(employeeId) ?? [])
    };
  }

  /**
   * One employee's annual leave in `year`, accrued up to `asOf`. `asOf` may be
   * ahead of today, so leave booked now for August counts the days earned by
   * August. `remainingDays` is what approved leave has left; `availableDays`
   * also sets aside the requests still waiting for a decision. Null when the
   * company has no annual leave type.
   */
  async annualBalanceOn(employeeId: number, year: number, asOf: Date) {
    const context = await this.context(year);
    if (!context.annualType) {
      return null;
    }
    const [employee, leaves] = await Promise.all([
      this.prisma.employee.findUnique({
        where: { id: employeeId },
        select: { hireDate: true }
      }),
      this.annualLeaves(context, [employeeId])
    ]);
    return this.balanceFor(
      { ...context, asOf: asOf > context.asOf ? asOf : context.asOf },
      employee?.hireDate ?? null,
      leaves.get(employeeId) ?? []
    );
  }

  private balanceFor(
    context: BalanceContext,
    hireDate: Date | null,
    leaves: AnnualLeaveRecord[]
  ) {
    const { year, asOf, policy, workWeek, holidays, leaveCutoff } = context;
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const usedByYear = new Map<number, number>();
    let pendingDays = 0;
    for (const leave of leaves) {
      if (leave.status === LeaveRequestStatus.PENDING) {
        pendingDays += leaveDaysBetween(leave, yearStart, leaveCutoff, workWeek, holidays);
        continue;
      }
      for (
        let leaveYear = leave.startDate.getUTCFullYear();
        leaveYear <= leave.endDate.getUTCFullYear();
        leaveYear += 1
      ) {
        const days =
          leaveYear === year
            ? leaveDaysBetween(leave, yearStart, leaveCutoff, workWeek, holidays)
            : leaveDaysInYear(leave, leaveYear, workWeek, holidays);
        usedByYear.set(leaveYear, (usedByYear.get(leaveYear) ?? 0) + days);
      }
    }

    return annualLeaveBalance({
      year,
      hireDate,
      asOf,
      policy,
      usedDays: usedByYear.get(year) ?? 0,
      pendingDays,
      carriedOverDays: carriedOverDays({
        year,
        trackingStartYear: context.trackingStartYear,
        hireDate,
        asOf,
        policy,
        usedByYear
      })
    });
  }

  /**
   * With a month, the balance is taken at the end of that month: accrual stops
   * there (or today, if sooner) and leave after it is not counted yet.
   */
  private async context(requestedYear?: number, month?: number): Promise<BalanceContext> {
    const settings = await this.systemSettings.getSettings();
    const today = companyToday(settings.timezoneOffsetMinutes);
    const year = requestedYear ?? today.getUTCFullYear();
    const leaveCutoff = new Date(Date.UTC(year, month ?? 12, 0));
    const asOf = month && leaveCutoff < today ? leaveCutoff : today;
    const annualType = await this.prisma.leaveType.findUnique({
      where: { code: ANNUAL_LEAVE_CODE }
    });
    // Carry-over only starts from the first year the system holds annual leave data.
    const firstLeave = annualType
      ? await this.prisma.leaveRequest.aggregate({
          where: { leaveTypeId: annualType.id },
          _min: { startDate: true }
        })
      : null;
    const trackingStartYear =
      firstLeave?._min.startDate?.getUTCFullYear() ?? today.getUTCFullYear();

    return {
      asOf,
      year,
      leaveCutoff,
      annualType,
      workWeek: settings.workWeek,
      holidays: await this.holidays.dateSet(
        new Date(Date.UTC(Math.min(trackingStartYear, year), 0, 1)),
        new Date(Date.UTC(year, 11, 31))
      ),
      trackingStartYear,
      policy: {
        annualAllowance: annualType?.annualAllowance ?? DEFAULT_ANNUAL_ALLOWANCE,
        seniorityEveryYears: settings.seniorityLeaveEveryYears,
        carryOverMaxDays: settings.annualLeaveCarryOverMaxDays
      }
    };
  }

  /** Approved and pending annual leave per employee, from tracking start to the end of the year. */
  private async annualLeaves(context: BalanceContext, employeeIds: number[]) {
    const byEmployee = new Map<number, AnnualLeaveRecord[]>();
    if (!context.annualType || !employeeIds.length) {
      return byEmployee;
    }

    const leaves = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        leaveTypeId: context.annualType.id,
        status: { in: [LeaveRequestStatus.APPROVED, LeaveRequestStatus.PENDING] },
        startDate: { lte: new Date(Date.UTC(context.year, 11, 31)) },
        endDate: {
          gte: new Date(Date.UTC(Math.min(context.trackingStartYear, context.year), 0, 1))
        }
      },
      select: {
        employeeId: true,
        status: true,
        startDate: true,
        endDate: true,
        totalDays: true
      }
    });
    for (const { employeeId, ...leave } of leaves) {
      const list = byEmployee.get(employeeId) ?? [];
      list.push(leave);
      byEmployee.set(employeeId, list);
    }
    return byEmployee;
  }
}
