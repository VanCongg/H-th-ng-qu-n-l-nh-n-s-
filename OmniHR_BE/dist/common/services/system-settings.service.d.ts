import { PrismaService } from "../../prisma/prisma.service";
export type SystemSettings = {
    workWeek: string[];
    leaveCalculation: string;
    phase: string;
    companyName: string;
    companyAddress: string;
    companyLatitude: number | null;
    companyLongitude: number | null;
    attendanceRadiusMeters: number;
    requireAttendanceLocation: boolean;
    timezoneOffsetMinutes: number;
    attendanceEarlyCheckInMinutes: number;
    morningShiftStart: string;
    morningShiftEnd: string;
    afternoonShiftStart: string;
    afternoonShiftEnd: string;
};
export declare const defaultSystemSettings: SystemSettings;
export declare class SystemSettingsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getSettings(): Promise<SystemSettings>;
    updateSettings(settings: Record<string, unknown>): Promise<SystemSettings>;
}
