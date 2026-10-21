import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/services/audit.service";
import { ApiError } from "../common/api-error";
import { AuthUser, RequestContext } from "../common/types";
import { currentEmployeeWhere } from "../common/prisma-where";
import { CreatePositionDto } from "./dto/create-position.dto";
import { UpdatePositionDto } from "./dto/update-position.dto";

@Injectable()
export class PositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  findAll(search?: string, departmentId?: number) {
    const where: Prisma.PositionWhereInput = {
      deletedAt: null,
      departmentId,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    return this.prisma.position.findMany({
      where,
      include: {
        department: true,
        _count: { select: { employees: { where: currentEmployeeWhere() } } }
      },
      orderBy: [{ department: { name: "asc" } }, { name: "asc" }]
    });
  }

  async findOne(id: number) {
    const position = await this.prisma.position.findFirst({
      where: { id, deletedAt: null },
      include: {
        department: true,
        _count: { select: { employees: { where: currentEmployeeWhere() } } }
      }
    });
    if (!position) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Position not found",
        "POSITION_NOT_FOUND"
      );
    }
    return position;
  }

  async create(dto: CreatePositionDto, actor: AuthUser, context?: RequestContext) {
    await this.ensureDepartment(dto.departmentId);
    const position = await this.prisma.position.create({
      data: {
        code: dto.code,
        name: dto.name,
        departmentId: dto.departmentId,
        isActive: dto.isActive ?? true
      },
      include: { department: true }
    });

    await this.audit.log({
      userId: actor.id,
      action: "CREATE_POSITION",
      entityType: "Position",
      entityId: position.id,
      newValue: position,
      context
    });

    return position;
  }

  async update(
    id: number,
    dto: UpdatePositionDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const oldValue = await this.findOne(id);
    await this.ensureDepartment(dto.departmentId);
    const position = await this.prisma.position.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        departmentId: dto.departmentId,
        isActive: dto.isActive
      },
      include: { department: true }
    });

    await this.audit.log({
      userId: actor.id,
      action: "UPDATE_POSITION",
      entityType: "Position",
      entityId: id,
      oldValue,
      newValue: position,
      context
    });

    return position;
  }

  async softDelete(id: number, actor: AuthUser, context?: RequestContext) {
    const oldValue = await this.findOne(id);
    const position = await this.prisma.position.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() }
    });

    await this.audit.log({
      userId: actor.id,
      action: "DELETE_POSITION",
      entityType: "Position",
      entityId: id,
      oldValue,
      context
    });

    return position;
  }

  private async ensureDepartment(departmentId?: number | null) {
    if (!departmentId) {
      return;
    }

    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, deletedAt: null },
      select: { id: true }
    });
    if (!department) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Department not found",
        "DEPARTMENT_NOT_FOUND"
      );
    }
  }
}
