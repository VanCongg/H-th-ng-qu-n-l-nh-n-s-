import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/services/audit.service";
import { ApiError } from "../common/api-error";
import { AuthUser, RequestContext } from "../common/types";
import { CreatePositionDto } from "./dto/create-position.dto";
import { UpdatePositionDto } from "./dto/update-position.dto";

@Injectable()
export class PositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  findAll(search?: string) {
    const where: Prisma.PositionWhereInput = {
      deletedAt: null,
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
      include: { _count: { select: { employees: true } } },
      orderBy: [{ level: "asc" }, { name: "asc" }]
    });
  }

  async findOne(id: number) {
    const position = await this.prisma.position.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { employees: true } } }
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
    const position = await this.prisma.position.create({
      data: {
        code: dto.code,
        name: dto.name,
        level: dto.level ?? 1,
        isActive: dto.isActive ?? true
      }
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
    const position = await this.prisma.position.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        level: dto.level,
        isActive: dto.isActive
      }
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
}
