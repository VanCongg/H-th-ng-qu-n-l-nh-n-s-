// Hàm tiện ích dùng chung: xử lý ngày, đếm ngày làm việc, phân trang, ẩn trường nhạy cảm của user.

// Cắt bỏ giờ, chỉ giữ ngày (00:00 UTC).
export function toDateOnly(value: string | Date): Date {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Mọi ngày giữa hai mốc (tính cả hai đầu).
export function getDateRange(startDate: Date, endDate: Date) {
  return {
    gte: toDateOnly(startDate),
    lte: toDateOnly(endDate)
  };
}

// Định dạng ngày kiểu dd/mm/yyyy.
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

// Tuần làm việc mặc định: thứ 2 đến thứ 6.
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
// Ví dụ: 29/10 (thứ 5) đến 02/11 (thứ 2), tuần làm việc T2-T6, không ngày lễ
// -> ["2026-10-29", "2026-10-30", "2026-11-02"]. Không tự viết vòng lặp T2-T6 ở nơi khác.
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

// Số ngày nghỉ phép = số ngày làm việc trong khoảng (bỏ cuối tuần và ngày lễ).
export function calculateLeaveDays(
  startDate: Date,
  endDate: Date,
  workWeek: string[] = DEFAULT_WORK_WEEK,
  holidays: ReadonlySet<number> = NO_HOLIDAYS
): number {
  return workdayKeysBetween(startDate, endDate, workWeek, holidays).length;
}

// Chuẩn hóa page/limit (limit tối đa 100) và tính skip/take cho Prisma.
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

// Bỏ passwordHash và refreshTokenHash trước khi trả user về client.
export function omitSensitiveUser<T extends Record<string, unknown>>(user: T) {
  const safeUser = { ...user };
  delete safeUser.passwordHash;
  delete safeUser.refreshTokenHash;
  return safeUser;
}
