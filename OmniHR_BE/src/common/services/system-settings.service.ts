import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

const SYSTEM_SETTINGS_KEY = "default";
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

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

export const defaultSystemSettings: SystemSettings = {
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

@Injectable()
export class SystemSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<SystemSettings> {
    const record = await this.prisma.systemSetting.findUnique({
      where: { key: SYSTEM_SETTINGS_KEY }
    });

    return normalizeSystemSettings(record?.value);
  }

  async updateSettings(settings: Record<string, unknown>): Promise<SystemSettings> {
    const current = await this.getSettings();
    const next = normalizeSystemSettings({ ...current, ...settings });

    await this.prisma.systemSetting.upsert({
      where: { key: SYSTEM_SETTINGS_KEY },
      create: {
        key: SYSTEM_SETTINGS_KEY,
        value: next as unknown as Prisma.InputJsonValue
      },
      update: {
        value: next as unknown as Prisma.InputJsonValue
      }
    });

    return next;
  }
}

function normalizeSystemSettings(value: unknown): SystemSettings {
  const raw = isRecord(value) ? value : {};

  return {
    workWeek: normalizeStringArray(raw.workWeek, defaultSystemSettings.workWeek),
    leaveCalculation: normalizeString(
      raw.leaveCalculation,
      defaultSystemSettings.leaveCalculation
    ),
    phase: normalizeString(raw.phase, defaultSystemSettings.phase),
    companyName: normalizeString(raw.companyName, defaultSystemSettings.companyName),
    companyAddress: normalizeString(
      raw.companyAddress,
      defaultSystemSettings.companyAddress
    ),
    companyLatitude: normalizeCoordinate(raw.companyLatitude, -90, 90),
    companyLongitude: normalizeCoordinate(raw.companyLongitude, -180, 180),
    attendanceRadiusMeters: normalizePositiveInteger(
      raw.attendanceRadiusMeters,
      defaultSystemSettings.attendanceRadiusMeters
    ),
    requireAttendanceLocation:
      typeof raw.requireAttendanceLocation === "boolean"
        ? raw.requireAttendanceLocation
        : defaultSystemSettings.requireAttendanceLocation,
    timezoneOffsetMinutes: normalizeIntegerInRange(
      raw.timezoneOffsetMinutes,
      -720,
      840,
      defaultSystemSettings.timezoneOffsetMinutes
    ),
    attendanceEarlyCheckInMinutes: normalizeIntegerInRange(
      raw.attendanceEarlyCheckInMinutes,
      0,
      240,
      defaultSystemSettings.attendanceEarlyCheckInMinutes
    ),
    morningShiftStart: normalizeTime(
      raw.morningShiftStart,
      defaultSystemSettings.morningShiftStart
    ),
    morningShiftEnd: normalizeTime(
      raw.morningShiftEnd,
      defaultSystemSettings.morningShiftEnd
    ),
    afternoonShiftStart: normalizeTime(
      raw.afternoonShiftStart,
      defaultSystemSettings.afternoonShiftStart
    ),
    afternoonShiftEnd: normalizeTime(
      raw.afternoonShiftEnd,
      defaultSystemSettings.afternoonShiftEnd
    )
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeString(value: unknown, fallback: string) {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const values = value
    .map((item) => item?.toString().trim())
    .filter((item): item is string => Boolean(item));
  return values.length > 0 ? values : fallback;
}

function normalizeCoordinate(value: unknown, min: number, max: number) {
  const numberValue = normalizeNumber(value);
  if (numberValue === null || numberValue < min || numberValue > max) {
    return null;
  }
  return numberValue;
}

function normalizePositiveInteger(value: unknown, fallback: number) {
  const numberValue = normalizeNumber(value);
  if (numberValue === null || numberValue <= 0) {
    return fallback;
  }
  return Math.round(numberValue);
}

function normalizeIntegerInRange(
  value: unknown,
  min: number,
  max: number,
  fallback: number
) {
  const numberValue = normalizeNumber(value);
  if (numberValue === null || numberValue < min || numberValue > max) {
    return fallback;
  }
  return Math.round(numberValue);
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  return null;
}

function normalizeTime(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return TIME_PATTERN.test(trimmed) ? trimmed : fallback;
}
