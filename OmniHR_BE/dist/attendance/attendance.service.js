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
exports.AttendanceService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const api_error_1 = require("../common/api-error");
const audit_service_1 = require("../common/services/audit.service");
const access_control_service_1 = require("../common/services/access-control.service");
const system_settings_service_1 = require("../common/services/system-settings.service");
const utils_1 = require("../common/utils");
const prisma_where_1 = require("../common/prisma-where");
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
};
let AttendanceService = class AttendanceService {
    prisma;
    audit;
    accessControl;
    systemSettings;
    constructor(prisma, audit, accessControl, systemSettings) {
        this.prisma = prisma;
        this.audit = audit;
        this.accessControl = accessControl;
        this.systemSettings = systemSettings;
    }
    async checkIn(user, dto, context) {
        const employeeId = this.requireEmployee(user);
        const settings = await this.systemSettings.getSettings();
        const recordedAt = new Date();
        const workDate = this.workDateFor(recordedAt, settings.timezoneOffsetMinutes);
        const metadata = this.buildCheckInMetadata(recordedAt, dto, settings);
        await this.ensureValidAttendanceAction(employeeId, client_1.AttendanceRecordType.CHECK_IN, workDate, metadata.shift);
        const record = await this.prisma.attendanceRecord.create({
            data: {
                employeeId,
                workDate,
                recordType: client_1.AttendanceRecordType.CHECK_IN,
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
    async checkOut(user, dto, context) {
        const employeeId = this.requireEmployee(user);
        const settings = await this.systemSettings.getSettings();
        const recordedAt = new Date();
        const workDate = this.workDateFor(recordedAt, settings.timezoneOffsetMinutes);
        const latestCheckIn = await this.ensureValidAttendanceAction(employeeId, client_1.AttendanceRecordType.CHECK_OUT, workDate);
        const metadata = this.buildCheckOutMetadata(recordedAt, dto, settings, latestCheckIn);
        const record = await this.prisma.attendanceRecord.create({
            data: {
                employeeId,
                workDate,
                recordType: client_1.AttendanceRecordType.CHECK_OUT,
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
    async findAll(query) {
        return this.paginatedList(this.buildWhere(query), query);
    }
    async findSelf(user, query) {
        const employeeId = this.requireEmployee(user);
        return this.paginatedList({ ...this.buildWhere(query), employeeId }, query);
    }
    async findTeam(user, query) {
        const teamIds = await this.accessControl.teamEmployeeIds(user);
        const scopedIds = query.employeeId
            ? teamIds.includes(query.employeeId)
                ? [query.employeeId]
                : []
            : teamIds;
        return this.paginatedList({
            ...this.buildWhere(query),
            employeeId: { in: scopedIds }
        }, query);
    }
    async findByEmployee(employeeId, user, query) {
        await this.accessControl.ensureCanReadEmployee(user, employeeId);
        return this.paginatedList({ ...this.buildWhere(query), employeeId }, query);
    }
    async adminCreate(dto, actor, context) {
        await this.ensureEmployee(dto.employeeId);
        const settings = await this.systemSettings.getSettings();
        const recordedAt = new Date(dto.recordedAt);
        const manualMetadata = this.buildManualMetadata(recordedAt, dto.recordType, settings);
        const record = await this.prisma.attendanceRecord.create({
            data: {
                employeeId: dto.employeeId,
                workDate: (0, utils_1.toDateOnly)(dto.workDate),
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
        return record;
    }
    async adminUpdate(id, dto, actor, context) {
        const oldValue = await this.findOne(id);
        const settings = await this.systemSettings.getSettings();
        const recordedAt = dto.recordedAt ? new Date(dto.recordedAt) : oldValue.recordedAt;
        const recordType = dto.recordType ?? oldValue.recordType;
        const manualMetadata = this.buildManualMetadata(recordedAt, recordType, settings);
        const record = await this.prisma.attendanceRecord.update({
            where: { id },
            data: {
                workDate: dto.workDate ? (0, utils_1.toDateOnly)(dto.workDate) : undefined,
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
        return record;
    }
    async findOne(id) {
        const record = await this.prisma.attendanceRecord.findUnique({
            where: { id },
            include: attendanceInclude
        });
        if (!record) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Attendance record not found", "ATTENDANCE_INVALID_ACTION");
        }
        return record;
    }
    async paginatedList(where, query) {
        const { skip, take, page, limit } = (0, utils_1.pagination)(query.page, query.limit);
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
    buildWhere(query) {
        return {
            recordType: query.recordType,
            employeeId: query.employeeId,
            employee: (0, prisma_where_1.currentEmployeeWhere)(query.departmentId ? { departmentId: query.departmentId } : undefined),
            workDate: query.fromDate || query.toDate
                ? {
                    gte: query.fromDate ? (0, utils_1.toDateOnly)(query.fromDate) : undefined,
                    lte: query.toDate ? (0, utils_1.toDateOnly)(query.toDate) : undefined
                }
                : undefined
        };
    }
    async ensureValidAttendanceAction(employeeId, recordType, workDate, shift) {
        const latest = await this.prisma.attendanceRecord.findFirst({
            where: {
                employeeId,
                workDate,
                isAdjustment: false
            },
            orderBy: { recordedAt: "desc" }
        });
        if (recordType === client_1.AttendanceRecordType.CHECK_IN) {
            if (latest?.recordType === client_1.AttendanceRecordType.CHECK_IN) {
                throw this.invalidAction("You already checked in and have not checked out.");
            }
            if (shift) {
                const existingShiftCheckIn = await this.prisma.attendanceRecord.findFirst({
                    where: {
                        employeeId,
                        workDate,
                        shift,
                        recordType: client_1.AttendanceRecordType.CHECK_IN,
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
        if (!latest || latest.recordType !== client_1.AttendanceRecordType.CHECK_IN) {
            throw this.invalidAction("You have not checked in today, so you cannot check out. Please contact Admin for attendance adjustment.");
        }
        return latest;
    }
    buildCheckInMetadata(recordedAt, dto, settings) {
        const shift = this.resolveCheckInShift(recordedAt, settings);
        const localMinutes = this.localMinutes(recordedAt, settings.timezoneOffsetMinutes);
        return {
            shift: shift.shift,
            attendanceStatus: localMinutes > shift.start ? client_1.AttendanceStatus.LATE : client_1.AttendanceStatus.ON_TIME,
            ...this.resolveLocation(dto, settings)
        };
    }
    buildCheckOutMetadata(recordedAt, dto, settings, latestCheckIn) {
        const shift = latestCheckIn?.shift ??
            this.resolveShiftForTime(recordedAt, settings)?.shift ??
            null;
        const shiftDefinition = shift
            ? this.shiftDefinitions(settings).find((item) => item.shift === shift)
            : null;
        const localMinutes = this.localMinutes(recordedAt, settings.timezoneOffsetMinutes);
        return {
            shift,
            attendanceStatus: shiftDefinition && localMinutes < shiftDefinition.end
                ? client_1.AttendanceStatus.EARLY_OUT
                : client_1.AttendanceStatus.ON_TIME,
            ...this.resolveLocation(dto, settings)
        };
    }
    buildManualMetadata(recordedAt, recordType, settings) {
        return {
            shift: recordType === client_1.AttendanceRecordType.ADJUSTMENT
                ? null
                : this.resolveShiftForTime(recordedAt, settings)?.shift ?? null,
            attendanceStatus: client_1.AttendanceStatus.MANUAL_ADJUSTMENT
        };
    }
    resolveCheckInShift(recordedAt, settings) {
        const localMinutes = this.localMinutes(recordedAt, settings.timezoneOffsetMinutes);
        const earlyWindow = settings.attendanceEarlyCheckInMinutes;
        const shift = this.shiftDefinitions(settings).find((item) => localMinutes >= item.start - earlyWindow && localMinutes <= item.end);
        if (!shift) {
            throw this.invalidAction("Attendance is outside configured shift hours.");
        }
        return shift;
    }
    resolveShiftForTime(recordedAt, settings) {
        const localMinutes = this.localMinutes(recordedAt, settings.timezoneOffsetMinutes);
        return this.shiftDefinitions(settings).find((item) => localMinutes >= item.start && localMinutes <= item.end);
    }
    shiftDefinitions(settings) {
        return [
            {
                shift: client_1.AttendanceShift.MORNING,
                start: this.parseTime(settings.morningShiftStart),
                end: this.parseTime(settings.morningShiftEnd)
            },
            {
                shift: client_1.AttendanceShift.AFTERNOON,
                start: this.parseTime(settings.afternoonShiftStart),
                end: this.parseTime(settings.afternoonShiftEnd)
            }
        ].map((definition) => {
            if (definition.end > definition.start) {
                return definition;
            }
            return definition.shift === client_1.AttendanceShift.MORNING
                ? {
                    shift: client_1.AttendanceShift.MORNING,
                    start: this.parseTime(system_settings_service_1.defaultSystemSettings.morningShiftStart),
                    end: this.parseTime(system_settings_service_1.defaultSystemSettings.morningShiftEnd)
                }
                : {
                    shift: client_1.AttendanceShift.AFTERNOON,
                    start: this.parseTime(system_settings_service_1.defaultSystemSettings.afternoonShiftStart),
                    end: this.parseTime(system_settings_service_1.defaultSystemSettings.afternoonShiftEnd)
                };
        });
    }
    resolveLocation(dto, settings) {
        const hasLatitude = typeof dto.latitude === "number";
        const hasLongitude = typeof dto.longitude === "number";
        const hasCompanyLocation = settings.companyLatitude !== null && settings.companyLongitude !== null;
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
            ? Math.round(this.distanceMeters(dto.latitude, dto.longitude, settings.companyLatitude, settings.companyLongitude))
            : null;
        if (settings.requireAttendanceLocation &&
            distanceMeters !== null &&
            distanceMeters > settings.attendanceRadiusMeters) {
            throw this.invalidAction("Attendance location is outside company radius.");
        }
        return {
            latitude: dto.latitude,
            longitude: dto.longitude,
            address,
            distanceMeters
        };
    }
    workDateFor(recordedAt, timezoneOffsetMinutes) {
        const local = new Date(recordedAt.getTime() + timezoneOffsetMinutes * 60_000);
        return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
    }
    localMinutes(recordedAt, timezoneOffsetMinutes) {
        const local = new Date(recordedAt.getTime() + timezoneOffsetMinutes * 60_000);
        return local.getUTCHours() * 60 + local.getUTCMinutes();
    }
    parseTime(value) {
        const [hours, minutes] = value.split(":").map(Number);
        return hours * 60 + minutes;
    }
    distanceMeters(latitudeA, longitudeA, latitudeB, longitudeB) {
        const earthRadiusMeters = 6371000;
        const deltaLatitude = this.toRadians(latitudeB - latitudeA);
        const deltaLongitude = this.toRadians(longitudeB - longitudeA);
        const a = Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
            Math.cos(this.toRadians(latitudeA)) *
                Math.cos(this.toRadians(latitudeB)) *
                Math.sin(deltaLongitude / 2) *
                Math.sin(deltaLongitude / 2);
        return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    toRadians(value) {
        return (value * Math.PI) / 180;
    }
    async ensureEmployee(id) {
        const employee = await this.prisma.employee.findFirst({
            where: (0, prisma_where_1.currentEmployeeWhere)({ id }),
            select: { id: true }
        });
        if (!employee) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Employee not found", "EMPLOYEE_NOT_FOUND");
        }
    }
    requireEmployee(user) {
        if (!user.employeeId) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Employee profile not found", "EMPLOYEE_NOT_FOUND");
        }
        return user.employeeId;
    }
    invalidAction(message) {
        return new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, message, "ATTENDANCE_INVALID_ACTION");
    }
};
exports.AttendanceService = AttendanceService;
exports.AttendanceService = AttendanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        access_control_service_1.AccessControlService,
        system_settings_service_1.SystemSettingsService])
], AttendanceService);
//# sourceMappingURL=attendance.service.js.map