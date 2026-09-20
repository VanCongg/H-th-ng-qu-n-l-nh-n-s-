import { AttendanceRecordType } from "@prisma/client";
import {
  computeTimesheet,
  TimesheetAttendanceRecord,
  TimesheetLeave,
  TimesheetSettings
} from "./timesheet";

const settings: TimesheetSettings = {
  workWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  timezoneOffsetMinutes: 420,
  attendanceGraceMinutes: 0,
  morningShiftStart: "08:00",
  morningShiftEnd: "12:00",
  afternoonShiftStart: "13:00",
  afternoonShiftEnd: "17:00"
};

/** A record at a local (UTC+7) wall-clock time on a September 2026 day. */
function record(
  day: number,
  time: string,
  recordType: AttendanceRecordType
): TimesheetAttendanceRecord {
  const [hours, minutes] = time.split(":").map(Number);
  return {
    workDate: new Date(Date.UTC(2026, 8, day)),
    recordType,
    recordedAt: new Date(Date.UTC(2026, 8, day, hours, minutes) - 420 * 60_000)
  };
}

const IN = AttendanceRecordType.CHECK_IN;
const OUT = AttendanceRecordType.CHECK_OUT;

function september(
  records: TimesheetAttendanceRecord[],
  leaves: TimesheetLeave[] = [],
  overrides: Partial<TimesheetSettings> = {}
) {
  return computeTimesheet(2026, 9, records, leaves, { ...settings, ...overrides });
}

describe("computeTimesheet", () => {
  it("counts the working days of the month as the standard", () => {
    const result = september([]);

    // September 2026 has 30 days, 8 of them on weekends.
    expect(result.standardWorkDays).toBe(22);
    expect(result.attendanceDays).toBe(0);
    expect(result.shiftMinutesPerDay).toBe(480);
  });

  it("credits a full on-time day with no deviations", () => {
    const result = september([
      record(1, "08:00", IN),
      record(1, "12:00", OUT),
      record(1, "13:00", IN),
      record(1, "17:00", OUT)
    ]);

    expect(result.attendanceDays).toBe(1);
    expect(result.lateMinutes).toBe(0);
    expect(result.earlyLeaveMinutes).toBe(0);
    expect(result.overtimeMinutes).toBe(0);
    expect(result.workedMinutes).toBe(480);
  });

  it("treats a single interval across lunch as both shifts, late only for the first", () => {
    const result = september([record(1, "08:10", IN), record(1, "17:00", OUT)]);

    expect(result.attendanceDays).toBe(1);
    expect(result.lateMinutes).toBe(10);
    expect(result.earlyLeaveMinutes).toBe(0);
  });

  it("ignores lateness and early leave within the grace period", () => {
    const result = september(
      [record(1, "08:10", IN), record(1, "16:50", OUT)],
      [],
      { attendanceGraceMinutes: 15 }
    );

    expect(result.lateMinutes).toBe(0);
    expect(result.earlyLeaveMinutes).toBe(0);
  });

  it("measures early leave against the shift end", () => {
    const result = september([record(1, "08:00", IN), record(1, "16:30", OUT)]);

    expect(result.earlyLeaveMinutes).toBe(30);
  });

  it("counts time after the last shift as overtime but not early arrival", () => {
    const result = september([record(1, "07:30", IN), record(1, "19:00", OUT)]);

    expect(result.overtimeMinutes).toBe(120);
    expect(result.lateMinutes).toBe(0);
  });

  it("records a check-in outside every shift as overtime without day credit", () => {
    const result = september([record(1, "20:00", IN), record(1, "22:00", OUT)]);

    expect(result.overtimeMinutes).toBe(120);
    expect(result.attendanceDays).toBe(0);
  });

  it("counts all weekend work as overtime without day credit", () => {
    const result = september([record(5, "09:00", IN), record(5, "11:00", OUT)]);

    expect(result.overtimeMinutes).toBe(120);
    expect(result.attendanceDays).toBe(0);
  });

  it("gives shift presence for a missing check-out but no early leave or overtime", () => {
    const result = september([record(1, "07:55", IN)]);

    expect(result.missingCheckOuts).toBe(1);
    expect(result.attendanceDays).toBe(0.5);
    expect(result.lateMinutes).toBe(0);
    expect(result.earlyLeaveMinutes).toBe(0);
    expect(result.overtimeMinutes).toBe(0);
  });

  it("credits paid leave, reports unpaid leave, and clips leave to the month", () => {
    const result = september(
      [],
      [
        // Aug 31 (Mon) - Sep 1 (Tue): only Sep 1 is inside the month.
        { startDate: new Date(Date.UTC(2026, 7, 31)), endDate: new Date(Date.UTC(2026, 8, 1)), isPaid: true },
        // Wed - Fri, spanning no weekend.
        { startDate: new Date(Date.UTC(2026, 8, 2)), endDate: new Date(Date.UTC(2026, 8, 3)), isPaid: true },
        { startDate: new Date(Date.UTC(2026, 8, 4)), endDate: new Date(Date.UTC(2026, 8, 4)), isPaid: false }
      ]
    );

    expect(result.paidLeaveDays).toBe(3);
    expect(result.unpaidLeaveDays).toBe(1);
  });

  it("does not double count a day that is both attended and on paid leave", () => {
    const result = september(
      [record(1, "08:00", IN), record(1, "12:00", OUT)],
      [{ startDate: new Date(Date.UTC(2026, 8, 1)), endDate: new Date(Date.UTC(2026, 8, 1)), isPaid: true }]
    );

    expect(result.attendanceDays).toBe(0.5);
    expect(result.paidLeaveDays).toBe(0.5);
  });
});
