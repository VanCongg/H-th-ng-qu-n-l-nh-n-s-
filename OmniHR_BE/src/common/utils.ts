export function toDateOnly(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function getDateRange(startDate: Date, endDate: Date) {
  return {
    gte: toDateOnly(startDate),
    lte: toDateOnly(endDate)
  };
}

export function formatDateDdMmYyyy(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const year = `${date.getUTCFullYear()}`;
  return `${day}${month}${year}`;
}

const DAY_NAME_TO_UTC_INDEX: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6
};

export const DEFAULT_WORK_WEEK = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY"
];

/** No holidays: the default wherever a caller has not loaded them. */
export const NO_HOLIDAYS: ReadonlySet<number> = new Set();

/**
 * The working days between two dates, both inclusive, as YYYY-MM-DD keys: a
 * day of the work week that is not a holiday. `holidays` holds UTC-midnight
 * timestamps (HolidaysService.dateSet). Every count of working days goes
 * through here, so leave length, the monthly standard and a task's window
 * agree on what a working day is.
 */
export function workdayKeysBetween(
  startDate: Date,
  endDate: Date,
  workWeek: string[] = DEFAULT_WORK_WEEK,
  holidays: ReadonlySet<number> = NO_HOLIDAYS
): string[] {
  const workDayIndexes = new Set(
    workWeek
      .map((day) => DAY_NAME_TO_UTC_INDEX[day.toUpperCase()])
      .filter((index): index is number => index !== undefined)
  );

  const keys: string[] = [];
  const current = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  while (current <= end) {
    if (workDayIndexes.has(current.getUTCDay()) && !holidays.has(current.getTime())) {
      keys.push(current.toISOString().slice(0, 10));
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return keys;
}

export function calculateLeaveDays(
  startDate: Date,
  endDate: Date,
  workWeek: string[] = DEFAULT_WORK_WEEK,
  holidays: ReadonlySet<number> = NO_HOLIDAYS
): number {
  return workdayKeysBetween(startDate, endDate, workWeek, holidays).length;
}

export function pagination(page = 1, limit = 20) {
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const normalizedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  return {
    skip: (normalizedPage - 1) * normalizedLimit,
    take: normalizedLimit,
    page: normalizedPage,
    limit: normalizedLimit
  };
}

export function omitSensitiveUser<T extends Record<string, unknown>>(user: T) {
  const safeUser = { ...user };
  delete safeUser.passwordHash;
  delete safeUser.refreshTokenHash;
  return safeUser;
}
