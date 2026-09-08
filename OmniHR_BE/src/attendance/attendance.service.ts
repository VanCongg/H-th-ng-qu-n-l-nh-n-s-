import { HttpStatus, Injectable } from "@nestjs/common";
import {
  AttendanceRecord,
  AttendanceRecordType,
  AttendanceShift,
  AttendanceStatus,
  Prisma
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/services/audit.service";
import { AccessControlService } from "../common/services/access-control.service";
import {
  defaultSystemSettings,
  SystemSettings,
  SystemSettingsService
} from "../common/services/system-settings.service";
import { AuthUser, RequestContext } from "../common/types";
import { pagination, toDateOnly } from "../common/utils";
import { currentEmployeeWhere } from "../common/prisma-where";
import { NotificationsService } from "../notifications/notifications.service";
import { AttendanceActionDto } from "./dto/attendance-action.dto";
import { AttendanceQueryDto } from "./dto/attendance-query.dto";
import {
  AdminCreateAttendanceDto,
  AdminUpdateAttendanceDto
} from "./dto/admin-attendance.dto";

const attendanceInclude = {
  employee: {
    include: {
      department: true,
      position: true
    }
  },
  createdByUser: {
    select: { id: true, username: true, email: true }
  },
  updatedByUser: {
    select: { id: true, username: true, email: true }
  }
} satisfies Prisma.AttendanceRecordInclude;

type ShiftDefinition = {
  shift: AttendanceShift;
  start: number;
  end: number;
};

type AttendanceMetadata = {
  shift: AttendanceShift | null;
  attendanceStatus: AttendanceStatus;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  distanceMeters: number | null;
};

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accessControl: AccessControlService,
    private readonly systemSettings: SystemSettingsService,
    private readonly notifications: NotificationsService
  ) {}

  async getLocationPolicy() {
    const settings = await this.systemSettings.getSettings();
    return {
      companyLatitude: settings.companyLatitude,
      companyLongitude: settings.companyLongitude,
      attendanceRadiusMeters: settings.attendanceRadiusMeters,
      requireAttendanceLocation: settings.requireAttendanceLocation
    };
  }

  async checkIn(
    user: AuthUser,
    dto: AttendanceActionDto,
    context?: RequestContext
  ) {
    const employeeId = this.requireEmployee(user);
    const settings = await this.systemSettings.getSettings();
    const recordedAt = new Date();
    const workDate = this.workDateFor(recordedAt, settings.timezoneOffsetMinutes);
    const metadata = this.buildCheckInMetadata(recordedAt, dto, settings);
    await this.ensureValidAttendanceAction(
      employeeId,
      AttendanceRecordType.CHECK_IN,
      workDate,
      metadata.shift
    );

    const record = await this.prisma.attendanceRecord.create({
      data: {
        employeeId,
        workDate,
        recordType: AttendanceRecordType.CHECK_IN,
        recordedAt,
        shift: metadata.shift,
        attendanceStatus: metadata.attendanceStatus,
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        address: metadata.address,
        distanceMeters: metadata.distanceMeters,
        source: "MOBILE",
        createdByUserId: user.id
      },
      include: attendanceInclude
    });

    await this.audit.log({
      userId: user.id,
      action: "CHECK_IN",
      entityType: "AttendanceRecord",
      entityId: record.id,
      newValue: record,
      context
    });

    return record;
  }

  async checkOut(
    user: AuthUser,
    dto: AttendanceActionDto,
    context?: RequestContext
  ) {
    const employeeId = this.requireEmployee(user);
    const settings = await this.systemSettings.getSettings();
    const recordedAt = new Date();
    const workDate = this.workDateFor(recordedAt, settings.timezoneOffsetMinutes);
    const latestCheckIn = await this.ensureValidAttendanceAction(
      employeeId,
      AttendanceRecordType.CHECK_OUT,
      workDate
    );
    const metadata = this.buildCheckOutMetadata(
      recordedAt,
      dto,
      settings,
      latestCheckIn
    );

    const record = await this.prisma.attendanceRecord.create({
      data: {
        employeeId,
        workDate,
        recordType: AttendanceRecordType.CHECK_OUT,
        recordedAt,
        shift: metadata.shift,
        attendanceStatus: metadata.attendanceStatus,
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        address: metadata.address,
        distanceMeters: metadata.distanceMeters,
        source: "MOBILE",
        createdByUserId: user.id
      },
      include: attendanceInclude
    });

    await this.audit.log({
      userId: user.id,
      action: "CHECK_OUT",
      entityType: "AttendanceRecord",
      entityId: record.id,
      newValue: record,
      context
    });

    return record;
  }

  async findAll(query: AttendanceQueryDto) {
    return this.paginatedList(this.buildWhere(query), query);
  }

  async findSelf(user: AuthUser, query: AttendanceQueryDto) {
    const employeeId = this.requireEmployee(user);
    return this.paginatedList({ ...this.buildWhere(query), employeeId }, query);
  }

  async findTeam(user: AuthUser, query: AttendanceQueryDto) {
    const teamIds = await this.accessControl.teamEmployeeIds(user);
    const scopedIds = query.employeeId
      ? teamIds.includes(query.employeeId)
        ? [query.employeeId]
        : []
      : teamIds;
    return this.paginatedList(
      {
        ...this.buildWhere(query),
        employeeId: { in: scopedIds }
      },
      query
    );
  }

  async findByEmployee(employeeId: number, user: AuthUser, query: AttendanceQueryDto) {
    await this.accessControl.ensureCanReadEmployee(user, employeeId);
    return this.paginatedList({ ...this.buildWhere(query), employeeId }, query);
  }

  async adminCreate(
    dto: AdminCreateAttendanceDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    await this.ensureEmployee(dto.employeeId);
    const settings = await this.systemSettings.getSettings();
    const recordedAt = new Date(dto.recordedAt);
    const manualMetadata = this.buildManualMetadata(
      recordedAt,
      dto.recordType,
      settings
    );
    const record = await this.prisma.attendanceRecord.create({
      data: {
        employeeId: dto.employeeId,
        workDate: toDateOnly(dto.workDate),
        recordType: dto.recordType,
        recordedAt,
        shift: manualMetadata.shift,
        attendanceStatus: manualMetadata.attendanceStatus,
        source: "ADMIN",
        note: dto.note,
        isAdjustment: true,
        createdByUserId: actor.id
      },
      include: attendanceInclude
    });

    await this.audit.log({
      userId: actor.id,
      action: "ATTENDANCE_ADMIN_CREATE",
      entityType: "AttendanceRecord",
      entityId: record.id,
      newValue: record,
      context
    });

    if (record.employee.userId) {
      await this.notifications.create(
        record.employee.userId,
        "ATTENDANCE_ADJUSTED",
        "Attendance record adjusted",
        `An attendance record for ${record.workDate.toDateString()} was created by an admin.`,
        "AttendanceRecord",
        record.id
      );
    }

    return record;
  }

  async adminUpdate(
    id: number,
    dto: AdminUpdateAttendanceDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const oldValue = await this.findOne(id);
    const settings = await this.systemSettings.getSettings();
    const recordedAt = dto.recordedAt ? new Date(dto.recordedAt) : oldValue.recordedAt;
    const recordType = dto.recordType ?? oldValue.recordType;
    const manualMetadata = this.buildManualMetadata(
      recordedAt,
      recordType,
      settings
    );
    const record = await this.prisma.attendanceRecord.update({
      where: { id },
      data: {
        workDate: dto.workDate ? toDateOnly(dto.workDate) : undefined,
        recordType,
        recordedAt,
        shift: manualMetadata.shift,
        attendanceStatus: manualMetadata.attendanceStatus,
        note: dto.note,
        isAdjustment: true,
        source: "ADMIN",
        updatedByUserId: actor.id
      },
      include: attendanceInclude
    });

    await this.audit.log({
      userId: actor.id,
      action: "ATTENDANCE_ADMIN_UPDATE",
      entityType: "AttendanceRecord",
      entityId: id,
      oldValue,
      newValue: record,
      context
    });

    if (record.employee.userId) {
      await this.notifications.create(
        record.employee.userId,
        "ATTENDANCE_ADJUSTED",
        "Attendance record adjusted",
        `An attendance record for ${record.workDate.toDateString()} was updated by an admin.`,
        "AttendanceRecord",
        record.id
      );
    }

    return record;
  }

  async findOne(id: number) {
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id },
      include: attendanceInclude
    });
    if (!record) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Attendance record not found",
        "ATTENDANCE_INVALID_ACTION"
      );
    }
    return record;
  }

  private async paginatedList(
    where: Prisma.AttendanceRecordWhereInput,
    query: AttendanceQueryDto
  ) {
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.attendanceRecord.findMany({
        where,
        include: attendanceInclude,
        orderBy: [{ workDate: "desc" }, { recordedAt: "desc" }],
        skip,
        take
      }),
      this.prisma.attendanceRecord.count({ where })
    ]);

    return { items, meta: { total, page, limit } };
  }

  private buildWhere(query: AttendanceQueryDto): Prisma.AttendanceRecordWhereInput {
    return {
      recordType: query.recordType,
      employeeId: query.employeeId,
      employee: currentEmployeeWhere(
        query.departmentId ? { departmentId: query.departmentId } : undefined
      ),
      workDate:
        query.fromDate || query.toDate
          ? {
              gte: query.fromDate ? toDateOnly(query.fromDate) : undefined,
              lte: query.toDate ? toDateOnly(query.toDate) : undefined
            }
          : undefined
    };
  }

  private async ensureValidAttendanceAction(
    employeeId: number,
    recordType: AttendanceRecordType,
    workDate: Date,
    shift?: AttendanceShift | null
  ) {
    const latest = await this.prisma.attendanceRecord.findFirst({
      where: {
        employeeId,
        workDate,
        isAdjustment: false
      },
      orderBy: { recordedAt: "desc" }
    });

    if (recordType === AttendanceRecordType.CHECK_IN) {
      if (latest?.recordType === AttendanceRecordType.CHECK_IN) {
        throw this.invalidAction("You already checked in and have not checked out.");
      }
      if (shift) {
        const existingShiftCheckIn = await this.prisma.attendanceRecord.findFirst({
          where: {
            employeeId,
            workDate,
            shift,
            recordType: AttendanceRecordType.CHECK_IN,
            isAdjustment: false
          },
          select: { id: true }
        });
        if (existingShiftCheckIn) {
          throw this.invalidAction("You already checked in for this shift.");
        }
      }
      return;
    }

    if (!latest || latest.recordType !== AttendanceRecordType.CHECK_IN) {
      throw this.invalidAction(
        "You have not checked in today, so you cannot check out. Please contact Admin for attendance adjustment."
      );
    }
    return latest;
  }

  private buildCheckInMetadata(
    recordedAt: Date,
    dto: AttendanceActionDto,
    settings: SystemSettings
  ): AttendanceMetadata {
    const shift = this.resolveCheckInShift(recordedAt, settings);
    const localMinutes = this.localMinutes(recordedAt, settings.timezoneOffsetMinutes);
    return {
      shift: shift.shift,
      attendanceStatus:
        localMinutes > shift.start ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME,
      ...this.resolveLocation(dto, settings)
    };
  }

  private buildCheckOutMetadata(
    recordedAt: Date,
    dto: AttendanceActionDto,
    settings: SystemSettings,
    latestCheckIn?: AttendanceRecord | null
  ): AttendanceMetadata {
    const shift =
      latestCheckIn?.shift ??
      this.resolveShiftForTime(recordedAt, settings)?.shift ??
      null;
    const shiftDefinition = shift
      ? this.shiftDefinitions(settings).find((item) => item.shift === shift)
      : null;
    const localMinutes = this.localMinutes(recordedAt, settings.timezoneOffsetMinutes);

    return {
      shift,
      attendanceStatus:
        shiftDefinition && localMinutes < shiftDefinition.end
          ? AttendanceStatus.EARLY_OUT
          : AttendanceStatus.ON_TIME,
      ...this.resolveLocation(dto, settings)
    };
  }

  private buildManualMetadata(
    recordedAt: Date,
    recordType: AttendanceRecordType,
    settings: SystemSettings
  ) {
    return {
      shift:
        recordType === AttendanceRecordType.ADJUSTMENT
          ? null
          : this.resolveShiftForTime(recordedAt, settings)?.shift ?? null,
      attendanceStatus: AttendanceStatus.MANUAL_ADJUSTMENT
    };
  }

  private resolveCheckInShift(recordedAt: Date, settings: SystemSettings) {
    const localMinutes = this.localMinutes(recordedAt, settings.timezoneOffsetMinutes);
    const earlyWindow = settings.attendanceEarlyCheckInMinutes;
    const shift = this.shiftDefinitions(settings).find(
      (item) =>
        localMinutes >= item.start - earlyWindow && localMinutes <= item.end
    );

    if (!shift) {
      throw this.invalidAction("Attendance is outside configured shift hours.");
    }

    return shift;
  }

  private resolveShiftForTime(recordedAt: Date, settings: SystemSettings) {
    const localMinutes = this.localMinutes(recordedAt, settings.timezoneOffsetMinutes);
    return this.shiftDefinitions(settings).find(
      (item) => localMinutes >= item.start && localMinutes <= item.end
    );
  }

  private shiftDefinitions(settings: SystemSettings): ShiftDefinition[] {
    return [
      {
        shift: AttendanceShift.MORNING,
        start: this.parseTime(settings.morningShiftStart),
        end: this.parseTime(settings.morningShiftEnd)
      },
      {
        shift: AttendanceShift.AFTERNOON,
        start: this.parseTime(settings.afternoonShiftStart),
        end: this.parseTime(settings.afternoonShiftEnd)
      }
    ].map((definition) => {
      if (definition.end > definition.start) {
        return definition;
      }

      return definition.shift === AttendanceShift.MORNING
        ? {
            shift: AttendanceShift.MORNING,
            start: this.parseTime(defaultSystemSettings.morningShiftStart),
            end: this.parseTime(defaultSystemSettings.morningShiftEnd)
          }
        : {
            shift: AttendanceShift.AFTERNOON,
            start: this.parseTime(defaultSystemSettings.afternoonShiftStart),
            end: this.parseTime(defaultSystemSettings.afternoonShiftEnd)
          };
    });
  }

  private resolveLocation(
    dto: AttendanceActionDto,
    settings: SystemSettings
  ): Omit<AttendanceMetadata, "shift" | "attendanceStatus"> {
    const hasLatitude = typeof dto.latitude === "number";
    const hasLongitude = typeof dto.longitude === "number";
    const hasCompanyLocation =
      settings.companyLatitude !== null && settings.companyLongitude !== null;

    if (settings.requireAttendanceLocation && (!hasLatitude || !hasLongitude)) {
      throw this.invalidAction("Attendance location is required.");
    }

    if (settings.requireAttendanceLocation && !hasCompanyLocation) {
      throw this.invalidAction("Company attendance location is not configured.");
    }

    const address = dto.address?.trim() || null;
    if (!hasLatitude || !hasLongitude) {
      return {
        latitude: null,
        longitude: null,
        address,
        distanceMeters: null
      };
    }

    const distanceMeters = hasCompanyLocation
      ? Math.round(
          this.distanceMeters(
            dto.latitude!,
            dto.longitude!,
            settings.companyLatitude!,
            settings.companyLongitude!
          )
        )
      : null;

    if (
      settings.requireAttendanceLocation &&
      distanceMeters !== null &&
      distanceMeters > settings.attendanceRadiusMeters
    ) {
      throw this.invalidAction("Attendance location is outside company radius.");
    }

    return {
      latitude: dto.latitude!,
      longitude: dto.longitude!,
      address,
      distanceMeters
    };
  }

  private workDateFor(recordedAt: Date, timezoneOffsetMinutes: number) {
    const local = new Date(recordedAt.getTime() + timezoneOffsetMinutes * 60_000);
    return new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
    );
  }

  private localMinutes(recordedAt: Date, timezoneOffsetMinutes: number) {
    const local = new Date(recordedAt.getTime() + timezoneOffsetMinutes * 60_000);
    return local.getUTCHours() * 60 + local.getUTCMinutes();
  }

  private parseTime(value: string) {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  }

  private distanceMeters(
    latitudeA: number,
    longitudeA: number,
    latitudeB: number,
    longitudeB: number
  ) {
    const earthRadiusMeters = 6371000;
    const deltaLatitude = this.toRadians(latitudeB - latitudeA);
    const deltaLongitude = this.toRadians(longitudeB - longitudeA);
    const a =
      Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
      Math.cos(this.toRadians(latitudeA)) *
        Math.cos(this.toRadians(latitudeB)) *
        Math.sin(deltaLongitude / 2) *
        Math.sin(deltaLongitude / 2);
    return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRadians(value: number) {
    return (value * Math.PI) / 180;
  }

  private async ensureEmployee(id: number) {
    const employee = await this.prisma.employee.findFirst({
      where: currentEmployeeWhere({ id }),
      select: { id: true }
    });
    if (!employee) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Employee not found",
        "EMPLOYEE_NOT_FOUND"
      );
    }
  }

  private requireEmployee(user: AuthUser) {
    if (!user.employeeId) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Employee profile not found",
        "EMPLOYEE_NOT_FOUND"
      );
    }
    return user.employeeId;
  }

  private invalidAction(message: string) {
    return new ApiError(
      HttpStatus.BAD_REQUEST,
      message,
      "ATTENDANCE_INVALID_ACTION"
    );
  }
}
