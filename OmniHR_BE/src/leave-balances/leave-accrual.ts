import { calculateLeaveDays } from "../common/utils";

export const ANNUAL_LEAVE_CODE = "ANNUAL_LEAVE";
export const DEFAULT_ANNUAL_ALLOWANCE = 12;
/** A remaining balance at or below this many days is reported as running low. */
export const LOW_BALANCE_DAYS = 2;

export type LeaveBalanceStatus = "AVAILABLE" | "LOW" | "EXHAUSTED";

export type AnnualLeavePolicy = {
  annualAllowance: number;
  /** One extra day per this many full years of service; 0 turns seniority days off. */
  seniorityEveryYears: number;
  /** Unused days that may roll into the next year; 0 turns carry-over off. */
  carryOverMaxDays: number;
};

export type AnnualLeaveBalance = {
  year: number;
  monthsWorked: number;
  annualAllowance: number;
  seniorityDays: number;
  /** Allowance plus seniority days: the most a full year of work earns. */
  entitlementDays: number;
  accruedDays: number;
  carriedOverDays: number;
  usedDays: number;
  pendingDays: number;
  /** Carried-over plus accrued days, minus approved leave. */
  remainingDays: number;
  /** Remaining days minus leave still waiting for approval. */
  availableDays: number;
  hireDateMissing: boolean;
  status: LeaveBalanceStatus;
};

export type LeaveSpan = { startDate: Date; endDate: Date; totalDays: number };

const MINUTE_MS = 60_000;

/** Today's date in the company timezone, as a UTC date-only value. */
export function companyToday(timezoneOffsetMinutes: number, now = new Date()) {
  const local = new Date(now.getTime() + timezoneOffsetMinutes * MINUTE_MS);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  );
}

/** Adds calendar months, clamping to the last day of shorter months (31 Jan + 1 = 28 Feb). */
function addMonths(date: Date, months: number) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(date.getUTCDate(), lastDay))
  );
}

/**
 * Full months of service inside `year`, counted up to `asOf`. A month counts
 * once its anniversary day is reached, so someone hired on 15 March has one full
 * month on 15 April. Service before the year started is not counted, and an
 * unknown hire date is treated as employed since the start of the year.
 */
export function monthsWorkedInYear(year: number, hireDate: Date | null, asOf: Date) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const limit = Math.min(asOf.getTime(), Date.UTC(year + 1, 0, 1));
  const start = hireDate && hireDate > yearStart ? hireDate : yearStart;
  let months = 0;
  while (months < 12 && addMonths(start, months + 1).getTime() <= limit) {
    months += 1;
  }
  return months;
}

/** Full years of service completed on `at`. */
export function fullYearsOfService(hireDate: Date, at: Date) {
  let years = at.getUTCFullYear() - hireDate.getUTCFullYear();
  if (addMonths(hireDate, years * 12).getTime() > at.getTime()) {
    years -= 1;
  }
  return Math.max(0, years);
}

/** Seniority days for `year`, judged at the end of that year or today, whichever is earlier. */
export function seniorityDays(
  year: number,
  hireDate: Date | null,
  asOf: Date,
  everyYears: number
) {
  if (!hireDate || everyYears <= 0) {
    return 0;
  }
  const at = new Date(Math.min(asOf.getTime(), Date.UTC(year, 11, 31)));
  return Math.floor(fullYearsOfService(hireDate, at) / everyYears);
}

/** Working days of a leave request inside `year`; a request spanning New Year is split. */
export function leaveDaysInYear(leave: LeaveSpan, year: number, workWeek: string[]) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  if (leave.endDate < yearStart || leave.startDate > yearEnd) {
    return 0;
  }
  if (leave.startDate >= yearStart && leave.endDate <= yearEnd) {
    return leave.totalDays;
  }
  return calculateLeaveDays(
    leave.startDate > yearStart ? leave.startDate : yearStart,
    leave.endDate < yearEnd ? leave.endDate : yearEnd,
    workWeek
  );
}

/**
 * Annual leave accrues in proportion to full months worked: with the usual
 * 12-day allowance that is one day per full month, never above the entitlement.
 */
export function annualLeaveBalance(input: {
  year: number;
  hireDate: Date | null;
  asOf: Date;
  policy: AnnualLeavePolicy;
  usedDays: number;
  pendingDays: number;
  carriedOverDays?: number;
}): AnnualLeaveBalance {
  const { year, hireDate, asOf, policy } = input;
  const monthsWorked = monthsWorkedInYear(year, hireDate, asOf);
  const seniority = seniorityDays(year, hireDate, asOf, policy.seniorityEveryYears);
  const entitlementDays = policy.annualAllowance + seniority;
  const accruedDays = roundDays(
    Math.min(entitlementDays, (entitlementDays * monthsWorked) / 12)
  );
  const carriedOverDays = roundDays(input.carriedOverDays ?? 0);
  const usedDays = roundDays(input.usedDays);
  const pendingDays = roundDays(input.pendingDays);
  const remainingDays = roundDays(carriedOverDays + accruedDays - usedDays);
  const availableDays = roundDays(remainingDays - pendingDays);

  return {
    year,
    monthsWorked,
    annualAllowance: policy.annualAllowance,
    seniorityDays: seniority,
    entitlementDays,
    accruedDays,
    carriedOverDays,
    usedDays,
    pendingDays,
    remainingDays,
    availableDays,
    hireDateMissing: hireDate === null,
    status:
      remainingDays <= 0 ? "EXHAUSTED" : remainingDays <= LOW_BALANCE_DAYS ? "LOW" : "AVAILABLE"
  };
}

/**
 * Unused days rolled into `year`, capped at the policy limit each year. The
 * chain starts at the year leave tracking began, so years before the system
 * held any leave data are not treated as fully unused.
 */
export function carriedOverDays(input: {
  year: number;
  trackingStartYear: number;
  hireDate: Date | null;
  asOf: Date;
  policy: AnnualLeavePolicy;
  usedByYear: Map<number, number>;
}) {
  const { policy, hireDate } = input;
  if (policy.carryOverMaxDays <= 0) {
    return 0;
  }
  const firstYear = Math.max(
    input.trackingStartYear,
    hireDate?.getUTCFullYear() ?? input.trackingStartYear
  );
  let carry = 0;
  for (let year = firstYear; year < input.year; year += 1) {
    const { remainingDays } = annualLeaveBalance({
      year,
      hireDate,
      asOf: input.asOf,
      policy,
      usedDays: input.usedByYear.get(year) ?? 0,
      pendingDays: 0,
      carriedOverDays: carry
    });
    carry = Math.min(policy.carryOverMaxDays, Math.max(0, remainingDays));
  }
  return roundDays(carry);
}

function roundDays(value: number) {
  return Math.round(value * 100) / 100;
}
