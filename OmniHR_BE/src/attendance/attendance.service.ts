import { HttpStatus, Injectable } from "@nestjs/common";
import { AttendanceRecordType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/services/audit.service";
import { AccessControlService } from "../common/services/access-control.service";
import { AuthUser, RequestContext } from "../common/types";
import { pagination, toDateOnly } from "../common/utils";
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

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accessControl: AccessControlService
  ) {}

  async checkIn(user: AuthUser, context?: RequestContext) {
    const employeeId = this.requireEmployee(user);
    await this.ensureValidAttendanceAction(employeeId, AttendanceRecordType.CHECK_IN);

    const record = await this.prisma.attendanceRecord.create({
      data: {
        employeeId,
        workDate: toDateOnly(new Date()),
        recordType: AttendanceRecordType.CHECK_IN,
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

  async checkOut(user: AuthUser, context?: RequestContext) {
    const employeeId = this.requireEmployee(user);
    await this.ensureValidAttendanceAction(employeeId, AttendanceRecordType.CHECK_OUT);

    const record = await this.prisma.attendanceRecord.create({
      data: {
        employeeId,
        workDate: toDateOnly(new Date()),
        recordType: AttendanceRecordType.CHECK_OUT,
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
    const record = await this.prisma.attendanceRecord.create({
      data: {
        employeeId: dto.employeeId,
        workDate: toDateOnly(dto.workDate),
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

  async adminUpdate(
    id: number,
    dto: AdminUpdateAttendanceDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const oldValue = await this.findOne(id);
    const record = await this.prisma.attendanceRecord.update({
      where: { id },
      data: {
        workDate: dto.workDate ? toDateOnly(dto.workDate) : undefined,
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
      employee: query.departmentId ? { departmentId: query.departmentId } : undefined,
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
    recordType: AttendanceRecordType
  ) {
    const workDate = toDateOnly(new Date());
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
      return;
    }

    if (!latest || latest.recordType !== AttendanceRecordType.CHECK_IN) {
      throw this.invalidAction(
        "You have not checked in today, so you cannot check out. Please contact Admin for attendance adjustment."
      );
    }
  }

  private async ensureEmployee(id: number) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
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
