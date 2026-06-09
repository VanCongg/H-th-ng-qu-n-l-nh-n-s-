"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDateOnly = toDateOnly;
exports.getDateRange = getDateRange;
exports.formatDateDdMmYyyy = formatDateDdMmYyyy;
exports.calculateLeaveDays = calculateLeaveDays;
exports.pagination = pagination;
exports.omitSensitiveUser = omitSensitiveUser;
function toDateOnly(value) {
    const date = value instanceof Date ? value : new Date(value);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
function getDateRange(startDate, endDate) {
    return {
        gte: toDateOnly(startDate),
        lte: toDateOnly(endDate)
    };
}
function formatDateDdMmYyyy(value) {
    const date = value instanceof Date ? value : new Date(value);
    const day = `${date.getUTCDate()}`.padStart(2, "0");
    const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
    const year = `${date.getUTCFullYear()}`;
    return `${day}${month}${year}`;
}
function calculateLeaveDays(startDate, endDate) {
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
function pagination(page = 1, limit = 20) {
    const normalizedPage = Math.max(Number(page) || 1, 1);
    const normalizedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
    return {
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit,
        page: normalizedPage,
        limit: normalizedLimit
    };
}
function omitSensitiveUser(user) {
    const safeUser = { ...user };
    delete safeUser.passwordHash;
    delete safeUser.refreshTokenHash;
    return safeUser;
}
//# sourceMappingURL=utils.js.map