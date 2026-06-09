import { HttpStatus, Injectable } from "@nestjs/common";
import { LeaveRequestStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/services/audit.service";
import { AccessControlService } from "../common/services/access-control.service";
import { AuthUser, RequestContext } from "../common/types";
import { calculateLeaveDays, pagination, toDateOnly } from "../common/utils";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { LeaveRequestQueryDto } from "./dto/leave-request-query.dto";
import { RejectLeaveRequestDto } from "./dto/reject-leave-request.dto";

const leaveInclude = {
  employee: {
    include: {
      department: true,
      position: true
    }
  },
  leaveType: true,
  approver: {
    select: { id: true, username: true, email: true }
  }
} satisfies Prisma.LeaveRequestInclude;

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accessControl: AccessControlService
  ) {}

  async create(
    dto: CreateLeaveRequestDto,
    user: AuthUser,
    context?: RequestContext
  ) {
    const employeeId = this.requireEmployee(user);
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { id: dto.leaveTypeId, isActive: true }
    });
    if (!leaveType) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Leave type not found",
        "LEAVE_TYPE_NOT_FOUND"
      );
    }

    const startDate = toDateOnly(dto.startDate);
    const endDate = toDateOnly(dto.endDate);
    if (startDate > endDate) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Start date must be before or equal to end date",
        "VALIDATION_ERROR"
      );
    }

    const totalDays = calculateLeaveDays(startDate, endDate);
    if (totalDays <= 0) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Leave range has no valid working days",
        "LEAVE_REQUEST_INVALID_DAYS"
      );
    }

    await this.ensureNoOverlap(employeeId, startDate, endDate);

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate,
        endDate,
        totalDays,
        reason: dto.reason,
        status: LeaveRequestStatus.PENDING
      },
      include: leaveInclude
    });

    await this.audit.log({
      userId: user.id,
      action: "CREATE_LEAVE_REQUEST",
      entityType: "LeaveRequest",
      entityId: leaveRequest.id,
      newValue: leaveRequest,
      context
    });

    return leaveRequest;
  }

  async findAll(query: LeaveRequestQueryDto) {
    return this.paginatedList(this.buildWhere(query), query);
  }

  async findSelf(user: AuthUser, query: LeaveRequestQueryDto) {
    const employeeId = this.requireEmployee(user);
    return this.paginatedList({ ...this.buildWhere(query), employeeId }, query);
  }

  async findTeam(user: AuthUser, query: LeaveRequestQueryDto) {
    const teamIds = await this.accessControl.teamEmployeeIds(user);
    const scopedIds = query.employeeId
      ? teamIds.includes(query.employeeId)
        ? [query.employeeId]
        : []
      : teamIds;

    return this.paginatedList(
      { ...this.buildWhere(query), employeeId: { in: scopedIds } },
      query
    );
  }

  async findOne(id: number, user: AuthUser) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: leaveInclude
    });
    if (!leaveRequest) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Leave request not found",
        "LEAVE_REQUEST_NOT_FOUND"
      );
    }

    await this.accessControl.ensureCanReadEmployee(user, leaveRequest.employeeId);
    return leaveRequest;
  }

  async approve(id: number, user: AuthUser, context?: RequestContext) {
    const leaveRequest = await this.findPendingForDecision(id, user);
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveRequestStatus.APPROVED,
        approverUserId: user.id,
        approvedAt: new Date()
      },
      include: leaveInclude
    });

    await this.audit.log({
      userId: user.id,
      action: "APPROVE_LEAVE_REQUEST",
      entityType: "LeaveRequest",
      entityId: id,
      oldValue: leaveRequest,
      newValue: updated,
      context
    });

    return updated;
  }

  async reject(
    id: number,
    dto: RejectLeaveRequestDto,
    user: AuthUser,
    context?: RequestContext
  ) {
    const leaveRequest = await this.findPendingForDecision(id, user);
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveRequestStatus.REJECTED,
        approverUserId: user.id,
        approvedAt: new Date(),
        rejectionReason: dto.rejectionReason
      },
      include: leaveInclude
    });

    await this.audit.log({
      userId: user.id,
      action: "REJECT_LEAVE_REQUEST",
      entityType: "LeaveRequest",
      entityId: id,
      oldValue: leaveRequest,
      newValue: updated,
      context
    });

    return updated;
  }

  async cancel(id: number, user: AuthUser, context?: RequestContext) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: leaveInclude
    });
    if (!leaveRequest) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Leave request not found",
        "LEAVE_REQUEST_NOT_FOUND"
      );
    }

    if (!this.accessControl.isAdmin(user) && leaveRequest.employeeId !== user.employeeId) {
      throw new ApiError(HttpStatus.FORBIDDEN, "Forbidden", "FORBIDDEN");
    }

    if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Only pending leave request can be cancelled",
        "LEAVE_REQUEST_INVALID_STATUS"
      );
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveRequestStatus.CANCELLED,
        canceledAt: new Date()
      },
      include: leaveInclude
    });

    await this.audit.log({
      userId: user.id,
      action: "CANCEL_LEAVE_REQUEST",
      entityType: "LeaveRequest",
      entityId: id,
      oldValue: leaveRequest,
      newValue: updated,
      context
    });

    return updated;
  }

  private async findPendingForDecision(id: number, user: AuthUser) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: leaveInclude
    });
    if (!leaveRequest) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Leave request not found",
        "LEAVE_REQUEST_NOT_FOUND"
      );
    }

    if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Only pending leave request can be processed",
        "LEAVE_REQUEST_INVALID_STATUS"
      );
    }

    await this.accessControl.ensureCanManageLeave(user, leaveRequest.employeeId);
    return leaveRequest;
  }

  private async paginatedList(
    where: Prisma.LeaveRequestWhereInput,
    query: LeaveRequestQueryDto
  ) {
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.leaveRequest.findMany({
        where,
        include: leaveInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      this.prisma.leaveRequest.count({ where })
    ]);

    return { items, meta: { total, page, limit } };
  }

  private buildWhere(query: LeaveRequestQueryDto): Prisma.LeaveRequestWhereInput {
    return {
      status: query.status,
      employeeId: query.employeeId,
      leaveTypeId: query.leaveTypeId,
      employee: query.departmentId ? { departmentId: query.departmentId } : undefined,
      startDate: query.fromDate ? { gte: toDateOnly(query.fromDate) } : undefined,
      endDate: query.toDate ? { lte: toDateOnly(query.toDate) } : undefined
    };
  }

  private async ensureNoOverlap(
    employeeId: number,
    startDate: Date,
    endDate: Date
  ) {
    const overlap = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED] },
        startDate: { lte: endDate },
        endDate: { gte: startDate }
      },
      select: { id: true }
    });

    if (overlap) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Leave request overlaps with an existing pending or approved request",
        "LEAVE_REQUEST_OVERLAP"
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
}
