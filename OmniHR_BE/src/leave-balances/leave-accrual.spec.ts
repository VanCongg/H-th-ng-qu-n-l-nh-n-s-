import {
  AnnualLeavePolicy,
  annualLeaveBalance,
  carriedOverDays,
  companyToday,
  fullYearsOfService,
  leaveDaysInYear,
  monthsWorkedInYear
} from "./leave-accrual";

function date(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

const basePolicy: AnnualLeavePolicy = {
  annualAllowance: 12,
  seniorityEveryYears: 0,
  carryOverMaxDays: 0
};
const WORK_WEEK = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];

function balance(
  overrides: {
    usedDays?: number;
    pendingDays?: number;
    carriedOverDays?: number;
    hireDate?: Date | null;
    policy?: Partial<AnnualLeavePolicy>;
  } = {}
) {
  return annualLeaveBalance({
    year: 2026,
    hireDate: overrides.hireDate === undefined ? date("2020-05-01") : overrides.hireDate,
    asOf: date("2026-09-13"),
    policy: { ...basePolicy, ...overrides.policy },
    usedDays: overrides.usedDays ?? 0,
    pendingDays: overrides.pendingDays ?? 0,
    carriedOverDays: overrides.carriedOverDays
  });
}

describe("monthsWorkedInYear", () => {
  it("counts only the completed months of the current year for long-standing staff", () => {
    expect(monthsWorkedInYear(2026, date("2020-05-01"), date("2026-09-13"))).toBe(8);
  });

  it("grants a month on the anniversary of the hire date", () => {
    expect(monthsWorkedInYear(2026, date("2026-03-15"), date("2026-09-14"))).toBe(5);
    expect(monthsWorkedInYear(2026, date("2026-03-15"), date("2026-09-15"))).toBe(6);
  });

  it("clamps anniversaries to the end of shorter months", () => {
    expect(monthsWorkedInYear(2026, date("2026-01-31"), date("2026-02-28"))).toBe(1);
  });

  it("counts a finished year in full, from the hire date when hired during it", () => {
    expect(monthsWorkedInYear(2025, date("2020-05-01"), date("2026-09-13"))).toBe(12);
    expect(monthsWorkedInYear(2025, date("2025-03-15"), date("2026-09-13"))).toBe(9);
  });

  it("returns zero for a future year or a hire date after today", () => {
    expect(monthsWorkedInYear(2027, date("2020-05-01"), date("2026-09-13"))).toBe(0);
    expect(monthsWorkedInYear(2026, date("2026-10-01"), date("2026-09-13"))).toBe(0);
  });

  it("treats an unknown hire date as employed since the start of the year", () => {
    expect(monthsWorkedInYear(2026, null, date("2026-09-13"))).toBe(8);
  });
});

describe("annualLeaveBalance", () => {
  it("accrues one day per full month with a 12-day allowance", () => {
    expect(balance().accruedDays).toBe(8);
  });

  it("prorates a larger allowance without exceeding it", () => {
    expect(balance({ policy: { annualAllowance: 18 } }).accruedDays).toBe(12);
  });

  it("subtracts approved leave from remaining and pending leave from available", () => {
    const result = balance({ usedDays: 3, pendingDays: 2 });

    expect(result.remainingDays).toBe(5);
    expect(result.availableDays).toBe(3);
    expect(result.status).toBe("AVAILABLE");
  });

  it("flags a low and an exhausted balance", () => {
    expect(balance({ usedDays: 6 }).status).toBe("LOW");
    expect(balance({ usedDays: 8 }).status).toBe("EXHAUSTED");
  });

  it("adds seniority days to the entitlement and accrues them monthly", () => {
    // Hired 2020-05-01: six full years by September 2026, so one extra day.
    const result = balance({ policy: { seniorityEveryYears: 5 } });

    expect(result.seniorityDays).toBe(1);
    expect(result.entitlementDays).toBe(13);
    expect(result.accruedDays).toBe(8.67);
  });

  it("adds carried-over days to what remains", () => {
    const result = balance({ carriedOverDays: 5, usedDays: 2 });

    expect(result.carriedOverDays).toBe(5);
    expect(result.remainingDays).toBe(11);
  });

  it("flags a missing hire date and gives it no seniority", () => {
    const result = balance({ hireDate: null, policy: { seniorityEveryYears: 5 } });

    expect(result.hireDateMissing).toBe(true);
    expect(result.seniorityDays).toBe(0);
    expect(result.accruedDays).toBe(8);
  });
});

describe("fullYearsOfService", () => {
  it("completes a year on the anniversary day", () => {
    expect(fullYearsOfService(date("2021-09-14"), date("2026-09-13"))).toBe(4);
    expect(fullYearsOfService(date("2021-09-14"), date("2026-09-14"))).toBe(5);
  });
});

describe("leaveDaysInYear", () => {
  const spanning = { startDate: date("2026-12-30"), endDate: date("2027-01-04"), totalDays: 4 };

  it("uses the stored day count for leave inside the year", () => {
    expect(
      leaveDaysInYear({ startDate: date("2026-03-02"), endDate: date("2026-03-04"), totalDays: 3 }, 2026, WORK_WEEK)
    ).toBe(3);
  });

  it("splits leave across New Year by working days", () => {
    // 30-31 Dec 2026 are Wed-Thu; 1 Jan 2027 is a Friday and 4 Jan a Monday.
    expect(leaveDaysInYear(spanning, 2026, WORK_WEEK)).toBe(2);
    expect(leaveDaysInYear(spanning, 2027, WORK_WEEK)).toBe(2);
    expect(leaveDaysInYear(spanning, 2025, WORK_WEEK)).toBe(0);
  });
});

describe("carriedOverDays", () => {
  const input = {
    year: 2026,
    hireDate: date("2020-05-01"),
    asOf: date("2026-09-13"),
    policy: { ...basePolicy, carryOverMaxDays: 5 }
  };

  it("rolls unused days into the next year up to the limit", () => {
    expect(
      carriedOverDays({ ...input, trackingStartYear: 2025, usedByYear: new Map([[2025, 4]]) })
    ).toBe(5);
    expect(
      carriedOverDays({ ...input, trackingStartYear: 2025, usedByYear: new Map([[2025, 10]]) })
    ).toBe(2);
  });

  it("carries days only one year at a time through the chain", () => {
    // 2024 fully used leaves nothing to carry; 2025 then earns 12 and uses 10.
    const usedByYear = new Map([
      [2024, 12],
      [2025, 10]
    ]);
    expect(carriedOverDays({ ...input, trackingStartYear: 2024, usedByYear })).toBe(2);
  });

  it("carries nothing before leave tracking started or when turned off", () => {
    expect(carriedOverDays({ ...input, trackingStartYear: 2026, usedByYear: new Map() })).toBe(0);
    expect(
      carriedOverDays({
        ...input,
        policy: basePolicy,
        trackingStartYear: 2025,
        usedByYear: new Map()
      })
    ).toBe(0);
  });
});

describe("companyToday", () => {
  it("rolls over to the next day in the company timezone", () => {
    expect(companyToday(420, new Date("2026-09-13T20:00:00Z"))).toEqual(date("2026-09-14"));
  });
});
