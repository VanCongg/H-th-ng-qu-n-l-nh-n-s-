export declare function toDateOnly(value: string | Date): Date;
export declare function getDateRange(startDate: Date, endDate: Date): {
    gte: Date;
    lte: Date;
};
export declare function formatDateDdMmYyyy(value: string | Date): string;
export declare function calculateLeaveDays(startDate: Date, endDate: Date): number;
export declare function pagination(page?: number, limit?: number): {
    skip: number;
    take: number;
    page: number;
    limit: number;
};
export declare function omitSensitiveUser<T extends Record<string, unknown>>(user: T): T;
