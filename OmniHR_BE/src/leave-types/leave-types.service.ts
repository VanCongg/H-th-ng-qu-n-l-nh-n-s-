import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/services/audit.service";
import { ApiError } from "../common/api-error";
import { AuthUser, RequestContext } from "../common/types";
import { CreateLeaveTypeDto } from "./dto/create-leave-type.dto";
import { UpdateLeaveTypeDto } from "./dto/update-leave-type.dto";

@Injectable()
export class LeaveTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  findAll() {
    return this.prisma.leaveType.findMany({
      orderBy: { code: "asc" }
    });
  }

  async findOne(id: number) {
    const leaveType = await this.prisma.leaveType.findUnique({ where: { id } });
    if (!leaveType) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Leave type not found",
        "LEAVE_TYPE_NOT_FOUND"
      );
    }
    return leaveType;
  }

  async create(dto: CreateLeaveTypeDto, actor: AuthUser, context?: RequestContext) {
    const leaveType = await this.prisma.leaveType.create({
      data: {
        code: dto.code,
        name: dto.name,
        annualAllowance: dto.annualAllowance,
        isPaid: dto.isPaid ?? true,
        isActive: dto.isActive ?? true
      }
    });

    await this.audit.log({
      userId: actor.id,
      action: "CREATE_LEAVE_TYPE",
      entityType: "LeaveType",
      entityId: leaveType.id,
      newValue: leaveType,
      context
    });

    return leaveType;
  }

  async update(
    id: number,
    dto: UpdateLeaveTypeDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const oldValue = await this.findOne(id);
    const leaveType = await this.prisma.leaveType.update({
      where: { id },
      data: dto
    });

    await this.audit.log({
      userId: actor.id,
      action: "UPDATE_LEAVE_TYPE",
      entityType: "LeaveType",
      entityId: id,
      oldValue,
      newValue: leaveType,
      context
    });

    return leaveType;
  }

  async remove(id: number, actor: AuthUser, context?: RequestContext) {
    const oldValue = await this.findOne(id);
    const leaveType = await this.prisma.leaveType.update({
      where: { id },
      data: { isActive: false }
    });

    await this.audit.log({
      userId: actor.id,
      action: "DELETE_LEAVE_TYPE",
      entityType: "LeaveType",
      entityId: id,
      oldValue,
      newValue: leaveType,
      context
    });

    return leaveType;
  }
}
