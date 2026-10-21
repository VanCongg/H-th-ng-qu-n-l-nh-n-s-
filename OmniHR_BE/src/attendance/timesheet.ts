import { AttendanceRecordType, AttendanceShift } from "@prisma/client";
import {
  defaultSystemSettings,
  SystemSettings
} from "../common/services/system-settings.service";

export type ShiftWindow = {
  shift: AttendanceShift;
  /** Minutes after local midnight. */
  start: number;
  end: number;
};

export type TimesheetSettings = Pick<
  SystemSettings,
  | "workWeek"
  | "timezoneOffsetMinutes"
  | "attendanceGraceMinutes"
  | "overtimeMinimumMinutes"
  | "morningShiftStart"
  | "morningShiftEnd"
  | "afternoonShiftStart"
  | "afternoonShiftEnd"
>;

export type TimesheetAttendanceRecord = {
  workDate: Date;
  recordType: AttendanceRecordType;
  recordedAt: Date;
};

export type TimesheetLeave = {
  startDate: Date;
  endDate: Date;
  isPaid: boolean;
  /** A half-day leave covers one shift: half the day. */
  halfDay?: "MORNING" | "AFTERNOON" | null;
};

export type EmployeeTimesheet = {
  standardWorkDays: number;
  /** Public holidays on work-week days: paid, and not part of the standard. */
  holidayDays: number;
  attendanceDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  /**
   * Time worked beyond the shifts, on days where it reached the overtime
   * minimum. Recorded, not approved: pay for it still needs the manager's
   * sign-off, as the Labour Code requires the employee's agreement.
   */
  overtimeMinutes: number;
  missingCheckOuts: number;
  workedMinutes: number;
  shiftMinutesPerDay: number;
};

const DAY_NAME_TO_UTC_INDEX: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6
};

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** First and last calendar day of a month, as UTC date-only values. */
export function monthRange(year: number, month: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 0))
  };
}

/**
 * Shift windows from settings. A window whose end is not after its start is
 * misconfigured and falls back to the default hours for that shift.
 */
export function resolveShiftWindows(
  settings: Pick<
    SystemSettings,
    "morningShiftStart" | "morningShiftEnd" | "afternoonShiftStart" | "afternoonShiftEnd"
  >
): ShiftWindow[] {
  const window = (
    shift: AttendanceShift,
    start: string,
    end: string,
    fallbackStart: string,
    fallbackEnd: string
  ): ShiftWindow => {
    const parsedStart = parseTime(start);
    const parsedEnd = parseTime(end);
    return parsedEnd > parsedStart
      ? { shift, start: parsedStart, end: parsedEnd }
      : { shift, start: parseTime(fallbackStart), end: parseTime(fallbackEnd) };
  };

  return [
    window(
      AttendanceShift.MORNING,
      settings.morningShiftStart,
      settings.morningShiftEnd,
      defaultSystemSettings.morningShiftStart,
      defaultSystemSettings.morningShiftEnd
    ),
    window(
      AttendanceShift.AFTERNOON,
      settings.afternoonShiftStart,
      settings.afternoonShiftEnd,
      defaultSystemSettings.afternoonShiftStart,
      defaultSystemSettings.afternoonShiftEnd
    )
  ];
}

/**
 * Builds one employee's monthly timesheet from raw check-in/out records.
 *
 * - Each shift the employee was present for earns an equal share of a work day.
 * - Late / early minutes are measured against the shift boundaries; deviations
 *   within the grace period are ignored.
 * - Overtime is time worked after the last shift ends on a work day, plus all
 *   time worked on a non-work day. Arriving before the first shift or working
 *   through lunch is not overtime, and a day's extra below
 *   `overtimeMinimumMinutes` is not counted at all.
 * - A check-in without a matching check-out still proves presence for the shift
 *   it falls in, but has no end time, so it adds no early-leave or overtime and
 *   is reported in missingCheckOuts for an admin to adjust.
 * - An approved paid leave covers any part of a work day not already attended;
 *   a half-day leave covers at most half the day.
 * - A holiday on a work-week day is paid and left out of the standard; time
 *   worked on it is overtime, as on a weekend. `holidays` holds UTC-midnight
 *   timestamps (HolidaysService.dateSet).
 */
export function computeTimesheet(
  year: number,
  month: number,
  records: TimesheetAttendanceRecord[],
  leaves: TimesheetLeave[],
  settings: TimesheetSettings,
  holidays: ReadonlySet<number> = new Set()
): EmployeeTimesheet {
  const { start, end } = monthRange(year, month);
  const windows = resolveShiftWindows(settings);
  const shiftShare = 1 / windows.length;
  const lastShiftEnd = Math.max(...windows.map((window) => window.end));
  const grace = settings.attendanceGraceMinutes;
  const workDays = new Set(
    settings.workWeek
      .map((day) => DAY_NAME_TO_UTC_INDEX[day.toUpperCase()])
      .filter((index): index is number => index !== undefined)
  );

  const recordsByDay = new Map<number, TimesheetAttendanceRecord[]>();
  for (const record of records) {
    if (record.recordType === AttendanceRecordType.ADJUSTMENT) {
      continue;
    }
    const day = record.workDate.getTime();
    if (day < start.getTime() || day > end.getTime()) {
      continue;
    }
    const list = recordsByDay.get(day) ?? [];
    list.push(record);
    recordsByDay.set(day, list);
  }

  const timesheet: EmployeeTimesheet = {
    standardWorkDays: 0,
    holidayDays: 0,
    attendanceDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 0,
    missingCheckOuts: 0,
    workedMinutes: 0,
    shiftMinutesPerDay: windows.reduce(
      (sum, window) => sum + (window.end - window.start),
      0
    )
  };

  for (let day = start.getTime(); day <= end.getTime(); day += DAY_MS) {
    const isHoliday = holidays.has(day);
    const isWorkDay = workDays.has(new Date(day).getUTCDay()) && !isHoliday;
    if (isHoliday && workDays.has(new Date(day).getUTCDay())) {
      timesheet.holidayDays += 1;
    }
    const dayRecords = (recordsByDay.get(day) ?? []).sort(
      (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()
    );
    const { intervals, openCheckIns } = pairRecords(
      dayRecords,
      day,
      settings.timezoneOffsetMinutes
    );
    timesheet.missingCheckOuts += openCheckIns.length;
    timesheet.workedMinutes += intervals.reduce(
      (sum, [from, to]) => sum + (to - from),
      0
    );

    if (!isWorkDay) {
      timesheet.overtimeMinutes += countedOvertime(
        intervals.reduce((sum, [from, to]) => sum + (to - from), 0),
        settings.overtimeMinimumMinutes
      );
      continue;
    }

    timesheet.standardWorkDays += 1;
    let attendedShare = 0;

    windows.forEach((window, index) => {
      const previousEnd = index === 0 ? -Infinity : windows[index - 1].end;
      const overlapping = intervals.filter(
        ([from, to]) => from < window.end && to > window.start
      );
      const openInWindow = openCheckIns.filter(
        (minute) => minute > previousEnd && minute < window.end
      );
      if (!overlapping.length && !openInWindow.length) {
        return;
      }

      attendedShare += shiftShare;
      const firstArrival = Math.min(
        ...overlapping.map(([from]) => from),
        ...openInWindow
      );
      const late = firstArrival - window.start;
      if (late > grace) {
        timesheet.lateMinutes += late;
      }
      if (overlapping.length) {
        const early = window.end - Math.max(...overlapping.map(([, to]) => to));
        if (early > grace) {
          timesheet.earlyLeaveMinutes += early;
        }
      }
    });

    timesheet.overtimeMinutes += countedOvertime(
      intervals.reduce(
        (sum, [from, to]) => sum + Math.max(0, to - Math.max(from, lastShiftEnd)),
        0
      ),
      settings.overtimeMinimumMinutes
    );

    const attendedDay = Math.min(1, attendedShare);
    timesheet.attendanceDays += attendedDay;
    const covering = leaves.filter(
      (leave) =>
        leave.startDate.getTime() <= day && leave.endDate.getTime() >= day
    );
    // How much of the day the leave covers: all of it, or one shift.
    const coverage = (leave: TimesheetLeave) => (leave.halfDay ? 0.5 : 1);
    const paidCover = Math.max(0, ...covering.filter((leave) => leave.isPaid).map(coverage));
    const unpaidCover = Math.max(0, ...covering.filter((leave) => !leave.isPaid).map(coverage));
    const notWorked = 1 - attendedDay;
    const paid = Math.min(paidCover, notWorked);
    timesheet.paidLeaveDays += paid;
    // Like paid leave: the part of the day actually worked is not unpaid.
    timesheet.unpaidLeaveDays += Math.min(unpaidCover, notWorked - paid);
  }

  return timesheet;
}

/**
 * Pairs each check-in with the next check-out on the same work day. Times are
 * minutes after local midnight of the work date.
 */
function pairRecords(
  records: TimesheetAttendanceRecord[],
  workDay: number,
  timezoneOffsetMinutes: number
) {
  const intervals: Array<[number, number]> = [];
  const openCheckIns: number[] = [];
  let open: number | null = null;

  for (const record of records) {
    const minute = Math.round(
      (record.recordedAt.getTime() + timezoneOffsetMinutes * MINUTE_MS - workDay) /
        MINUTE_MS
    );
    if (record.recordType === AttendanceRecordType.CHECK_IN) {
      if (open !== null) {
        openCheckIns.push(open);
      }
      open = minute;
    } else if (open !== null) {
      if (minute > open) {
        intervals.push([open, minute]);
      }
      open = null;
    }
  }
  if (open !== null) {
    openCheckIns.push(open);
  }

  return { intervals, openCheckIns };
}

/** A day's extra time, or none when it stays under the minimum. */
function countedOvertime(minutes: number, minimum = 0) {
  return minutes >= minimum ? minutes : 0;
}

function parseTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
