import { EmployeeTimesheet } from "../attendance/timesheet";

export type PayrollRates = {
  overtimeRatePercent: number;
  insuranceRatePercent: number;
};

export type CompensationInput = {
  baseSalary: number;
  allowance: number;
  /** Salary insurance is paid on; the base salary is used when null. */
  insuranceSalary: number | null;
};

export type PayslipAmounts = {
  baseSalary: number;
  allowance: number;
  insuranceSalary: number;
  grossSalary: number;
  overtimePay: number;
  attendanceDeduction: number;
  insuranceDeduction: number;
  netSalary: number;
};

/**
 * Net pay = base salary prorated by payable days + allowance + overtime pay
 *           - late/early deduction - mandatory insurance.
 *
 * Late/early minutes and overtime are valued at the employee's own per-minute
 * rate (base salary / standard days / shift minutes per day), so no separate
 * penalty tariff has to be configured. Amounts are whole VND.
 */
export function calculatePayslip(
  timesheet: EmployeeTimesheet,
  compensation: CompensationInput,
  rates: PayrollRates
): PayslipAmounts {
  const { baseSalary, allowance } = compensation;
  const insuranceSalary = compensation.insuranceSalary ?? baseSalary;
  const standardDays = timesheet.standardWorkDays;
  const minuteRate =
    standardDays > 0 && timesheet.shiftMinutesPerDay > 0
      ? baseSalary / standardDays / timesheet.shiftMinutesPerDay
      : 0;

  const grossSalary =
    standardDays > 0
      ? Math.round(
          (baseSalary * Math.min(timesheet.payableDays, standardDays)) / standardDays
        )
      : 0;
  const overtimePay = Math.round(
    timesheet.overtimeMinutes * minuteRate * (rates.overtimeRatePercent / 100)
  );
  const attendanceDeduction = Math.round(
    (timesheet.lateMinutes + timesheet.earlyLeaveMinutes) * minuteRate
  );
  const insuranceDeduction = Math.round(
    insuranceSalary * (rates.insuranceRatePercent / 100)
  );
  const netSalary = Math.max(
    0,
    grossSalary + allowance + overtimePay - attendanceDeduction - insuranceDeduction
  );

  return {
    baseSalary,
    allowance,
    insuranceSalary,
    grossSalary,
    overtimePay,
    attendanceDeduction,
    insuranceDeduction,
    netSalary
  };
}
