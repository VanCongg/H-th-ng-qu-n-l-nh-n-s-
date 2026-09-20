import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DEFAULT_SCORE_WEIGHTS } from "../../ai-task-suggestions/suggestion-scoring";
import { PrismaService } from "../../prisma/prisma.service";
import { cacheKeys, SYSTEM_SETTINGS_TTL_SECONDS } from "../../redis/cache-keys";
import { CacheService } from "../../redis/cache.service";

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
  /** Late arrival / early leave up to this many minutes is not deducted. */
  attendanceGraceMinutes: number;
  /** One extra annual leave day per this many full years of service (0 = off). */
  seniorityLeaveEveryYears: number;
  /** Unused annual leave days that roll into the next year (0 = off). */
  annualLeaveCarryOverMaxDays: number;
  /**
   * Weights of the AI assignee ranking. They are fitted on past assignments
   * by prisma/tune-weights.ts rather than hand-picked, and need not sum to 1:
   * the scorer renormalises the signals a candidate actually has.
   */
  aiWeightSkill: number;
  aiWeightWorkload: number;
  aiWeightAvailability: number;
  aiWeightHistory: number;
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
  attendanceGraceMinutes: 0,
  seniorityLeaveEveryYears: 5,
  annualLeaveCarryOverMaxDays: 5,
  aiWeightSkill: DEFAULT_SCORE_WEIGHTS.skill,
  aiWeightWorkload: DEFAULT_SCORE_WEIGHTS.workload,
  aiWeightAvailability: DEFAULT_SCORE_WEIGHTS.availability,
  aiWeightHistory: DEFAULT_SCORE_WEIGHTS.history,
  morningShiftStart: "08:00",
  morningShiftEnd: "12:00",
  afternoonShiftStart: "13:00",
  afternoonShiftEnd: "17:00"
};

@Injectable()
export class SystemSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService
  ) {}

  /**
   * Read from Redis first. Two dozen call sites across attendance, leave,
   * attendance, leave and the chatbot hit this on nearly every request, for a row that
   * only the settings screen ever changes.
   */
  async getSettings(): Promise<SystemSettings> {
    return this.cache.wrap(
      cacheKeys.systemSettings(),
      SYSTEM_SETTINGS_TTL_SECONDS,
      async () => {
        const record = await this.prisma.systemSetting.findUnique({
          where: { key: SYSTEM_SETTINGS_KEY }
        });

        return normalizeSystemSettings(record?.value);
      }
    );
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

    await this.cache.del(cacheKeys.systemSettings());

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
    attendanceGraceMinutes: normalizeIntegerInRange(
      raw.attendanceGraceMinutes,
      0,
      120,
      defaultSystemSettings.attendanceGraceMinutes
    ),
    aiWeightSkill: normalizeNumberInRange(
      raw.aiWeightSkill,
      0,
      1,
      defaultSystemSettings.aiWeightSkill
    ),
    aiWeightWorkload: normalizeNumberInRange(
      raw.aiWeightWorkload,
      0,
      1,
      defaultSystemSettings.aiWeightWorkload
    ),
    aiWeightAvailability: normalizeNumberInRange(
      raw.aiWeightAvailability,
      0,
      1,
      defaultSystemSettings.aiWeightAvailability
    ),
    aiWeightHistory: normalizeNumberInRange(
      raw.aiWeightHistory,
      0,
      1,
      defaultSystemSettings.aiWeightHistory
    ),
    seniorityLeaveEveryYears: normalizeIntegerInRange(
      raw.seniorityLeaveEveryYears,
      0,
      10,
      defaultSystemSettings.seniorityLeaveEveryYears
    ),
    annualLeaveCarryOverMaxDays: normalizeIntegerInRange(
      raw.annualLeaveCarryOverMaxDays,
      0,
      30,
      defaultSystemSettings.annualLeaveCarryOverMaxDays
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

function normalizeNumberInRange(
  value: unknown,
  min: number,
  max: number,
  fallback: number
) {
  const numberValue = normalizeNumber(value);
  if (numberValue === null || numberValue < min || numberValue > max) {
    return fallback;
  }
  return numberValue;
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
