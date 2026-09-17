import { EmployeeTimesheet } from "../attendance/timesheet";
import { calculatePayslip } from "./payroll-calculator";

function timesheet(overrides: Partial<EmployeeTimesheet> = {}): EmployeeTimesheet {
  return {
    standardWorkDays: 22,
    attendanceDays: 22,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    payableDays: 22,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 0,
    missingCheckOuts: 0,
    workedMinutes: 0,
    shiftMinutesPerDay: 480,
    ...overrides
  };
}

const rates = { overtimeRatePercent: 150, insuranceRatePercent: 10.5 };

describe("calculatePayslip", () => {
  it("prorates salary and applies overtime, deductions, and insurance", () => {
    // Daily rate 1,000,000; per-minute rate 2,083.33.
    const result = calculatePayslip(
      timesheet({ payableDays: 20, lateMinutes: 20, earlyLeaveMinutes: 10, overtimeMinutes: 60 }),
      { baseSalary: 22_000_000, allowance: 1_000_000, insuranceSalary: null },
      rates
    );

    expect(result.grossSalary).toBe(20_000_000);
    expect(result.attendanceDeduction).toBe(62_500);
    expect(result.overtimePay).toBe(187_500);
    expect(result.insuranceSalary).toBe(22_000_000);
    expect(result.insuranceDeduction).toBe(2_310_000);
    expect(result.netSalary).toBe(18_815_000);
  });

  it("uses the insurance salary when one is set", () => {
    const result = calculatePayslip(
      timesheet(),
      { baseSalary: 22_000_000, allowance: 0, insuranceSalary: 5_000_000 },
      rates
    );

    expect(result.insuranceDeduction).toBe(525_000);
  });

  it("never pays more than the base salary for payable days", () => {
    const result = calculatePayslip(
      timesheet({ payableDays: 25 }),
      { baseSalary: 22_000_000, allowance: 0, insuranceSalary: 0 },
      rates
    );

    expect(result.grossSalary).toBe(22_000_000);
  });

  it("returns zero rather than NaN when the month has no working days", () => {
    const result = calculatePayslip(
      timesheet({ standardWorkDays: 0, payableDays: 0, overtimeMinutes: 120 }),
      { baseSalary: 22_000_000, allowance: 0, insuranceSalary: 0 },
      rates
    );

    expect(result.grossSalary).toBe(0);
    expect(result.overtimePay).toBe(0);
    expect(result.netSalary).toBe(0);
  });

  it("does not produce a negative net salary", () => {
    const result = calculatePayslip(
      timesheet({ payableDays: 0 }),
      { baseSalary: 22_000_000, allowance: 0, insuranceSalary: null },
      rates
    );

    expect(result.netSalary).toBe(0);
  });
});
