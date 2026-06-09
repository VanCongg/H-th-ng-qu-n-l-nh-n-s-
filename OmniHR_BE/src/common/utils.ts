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

export function calculateLeaveDays(startDate: Date, endDate: Date): number {
  let total = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6) {
      total += 1;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return total;
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
