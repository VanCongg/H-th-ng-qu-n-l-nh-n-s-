"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemSettingsService = exports.defaultSystemSettings = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const SYSTEM_SETTINGS_KEY = "default";
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
exports.defaultSystemSettings = {
    workWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
    leaveCalculation: "WEEKDAYS_ONLY",
    phase: "PHASE_1",
    companyName: "OmniHR",
    companyAddress: "",
    companyLatitude: null,
    companyLongitude: null,
    attendanceRadiusMeters: 100,
    requireAttendanceLocation: true,
    timezoneOffsetMinutes: 420,
    attendanceEarlyCheckInMinutes: 60,
    morningShiftStart: "08:00",
    morningShiftEnd: "12:00",
    afternoonShiftStart: "13:00",
    afternoonShiftEnd: "17:00"
};
let SystemSettingsService = class SystemSettingsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSettings() {
        const record = await this.prisma.systemSetting.findUnique({
            where: { key: SYSTEM_SETTINGS_KEY }
        });
        return normalizeSystemSettings(record?.value);
    }
    async updateSettings(settings) {
        const current = await this.getSettings();
        const next = normalizeSystemSettings({ ...current, ...settings });
        await this.prisma.systemSetting.upsert({
            where: { key: SYSTEM_SETTINGS_KEY },
            create: {
                key: SYSTEM_SETTINGS_KEY,
                value: next
            },
            update: {
                value: next
            }
        });
        return next;
    }
};
exports.SystemSettingsService = SystemSettingsService;
exports.SystemSettingsService = SystemSettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SystemSettingsService);
function normalizeSystemSettings(value) {
    const raw = isRecord(value) ? value : {};
    return {
        workWeek: normalizeStringArray(raw.workWeek, exports.defaultSystemSettings.workWeek),
        leaveCalculation: normalizeString(raw.leaveCalculation, exports.defaultSystemSettings.leaveCalculation),
        phase: normalizeString(raw.phase, exports.defaultSystemSettings.phase),
        companyName: normalizeString(raw.companyName, exports.defaultSystemSettings.companyName),
        companyAddress: normalizeString(raw.companyAddress, exports.defaultSystemSettings.companyAddress),
        companyLatitude: normalizeCoordinate(raw.companyLatitude, -90, 90),
        companyLongitude: normalizeCoordinate(raw.companyLongitude, -180, 180),
        attendanceRadiusMeters: normalizePositiveInteger(raw.attendanceRadiusMeters, exports.defaultSystemSettings.attendanceRadiusMeters),
        requireAttendanceLocation: typeof raw.requireAttendanceLocation === "boolean"
            ? raw.requireAttendanceLocation
            : exports.defaultSystemSettings.requireAttendanceLocation,
        timezoneOffsetMinutes: normalizeIntegerInRange(raw.timezoneOffsetMinutes, -720, 840, exports.defaultSystemSettings.timezoneOffsetMinutes),
        attendanceEarlyCheckInMinutes: normalizeIntegerInRange(raw.attendanceEarlyCheckInMinutes, 0, 240, exports.defaultSystemSettings.attendanceEarlyCheckInMinutes),
        morningShiftStart: normalizeTime(raw.morningShiftStart, exports.defaultSystemSettings.morningShiftStart),
        morningShiftEnd: normalizeTime(raw.morningShiftEnd, exports.defaultSystemSettings.morningShiftEnd),
        afternoonShiftStart: normalizeTime(raw.afternoonShiftStart, exports.defaultSystemSettings.afternoonShiftStart),
        afternoonShiftEnd: normalizeTime(raw.afternoonShiftEnd, exports.defaultSystemSettings.afternoonShiftEnd)
    };
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function normalizeString(value, fallback) {
    return typeof value === "string" ? value.trim() : fallback;
}
function normalizeStringArray(value, fallback) {
    if (!Array.isArray(value)) {
        return fallback;
    }
    const values = value
        .map((item) => item?.toString().trim())
        .filter((item) => Boolean(item));
    return values.length > 0 ? values : fallback;
}
function normalizeCoordinate(value, min, max) {
    const numberValue = normalizeNumber(value);
    if (numberValue === null || numberValue < min || numberValue > max) {
        return null;
    }
    return numberValue;
}
function normalizePositiveInteger(value, fallback) {
    const numberValue = normalizeNumber(value);
    if (numberValue === null || numberValue <= 0) {
        return fallback;
    }
    return Math.round(numberValue);
}
function normalizeIntegerInRange(value, min, max, fallback) {
    const numberValue = normalizeNumber(value);
    if (numberValue === null || numberValue < min || numberValue > max) {
        return fallback;
    }
    return Math.round(numberValue);
}
function normalizeNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? numberValue : null;
    }
    return null;
}
function normalizeTime(value, fallback) {
    if (typeof value !== "string") {
        return fallback;
    }
    const trimmed = value.trim();
    return TIME_PATTERN.test(trimmed) ? trimmed : fallback;
}
//# sourceMappingURL=system-settings.service.js.map