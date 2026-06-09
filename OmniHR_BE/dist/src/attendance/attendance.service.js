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
const utils_1 = require("../common/utils");
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
    constructor(prisma, audit, accessControl) {
        this.prisma = prisma;
        this.audit = audit;
        this.accessControl = accessControl;
    }
    async checkIn(user, context) {
        const employeeId = this.requireEmployee(user);
        await this.ensureValidAttendanceAction(employeeId, client_1.AttendanceRecordType.CHECK_IN);
        const record = await this.prisma.attendanceRecord.create({
            data: {
                employeeId,
                workDate: (0, utils_1.toDateOnly)(new Date()),
                recordType: client_1.AttendanceRecordType.CHECK_IN,
                recordedAt: new Date(),
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
    async checkOut(user, context) {
        const employeeId = this.requireEmployee(user);
        await this.ensureValidAttendanceAction(employeeId, client_1.AttendanceRecordType.CHECK_OUT);
        const record = await this.prisma.attendanceRecord.create({
            data: {
                employeeId,
                workDate: (0, utils_1.toDateOnly)(new Date()),
                recordType: client_1.AttendanceRecordType.CHECK_OUT,
                recordedAt: new Date(),
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
        const record = await this.prisma.attendanceRecord.create({
            data: {
                employeeId: dto.employeeId,
                workDate: (0, utils_1.toDateOnly)(dto.workDate),
                recordType: dto.recordType,
                recordedAt: new Date(dto.recordedAt),
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
        const record = await this.prisma.attendanceRecord.update({
            where: { id },
            data: {
                workDate: dto.workDate ? (0, utils_1.toDateOnly)(dto.workDate) : undefined,
                recordType: dto.recordType,
                recordedAt: dto.recordedAt ? new Date(dto.recordedAt) : undefined,
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
            employee: query.departmentId ? { departmentId: query.departmentId } : undefined,
            workDate: query.fromDate || query.toDate
                ? {
                    gte: query.fromDate ? (0, utils_1.toDateOnly)(query.fromDate) : undefined,
                    lte: query.toDate ? (0, utils_1.toDateOnly)(query.toDate) : undefined
                }
                : undefined
        };
    }
    async ensureValidAttendanceAction(employeeId, recordType) {
        const workDate = (0, utils_1.toDateOnly)(new Date());
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
            return;
        }
        if (!latest || latest.recordType !== client_1.AttendanceRecordType.CHECK_IN) {
            throw this.invalidAction("You have not checked in today, so you cannot check out. Please contact Admin for attendance adjustment.");
        }
    }
    async ensureEmployee(id) {
        const employee = await this.prisma.employee.findFirst({
            where: { id, deletedAt: null },
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
        access_control_service_1.AccessControlService])
], AttendanceService);
//# sourceMappingURL=attendance.service.js.map