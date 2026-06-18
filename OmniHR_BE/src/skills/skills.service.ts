import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { pagination } from "../common/utils";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSkillDto } from "./dto/create-skill.dto";
import { SkillQueryDto } from "./dto/skill-query.dto";
import { UpdateSkillDto } from "./dto/update-skill.dto";

const skillInclude = {
  positionSkills: {
    include: { position: true },
    orderBy: [{ position: { code: "asc" } }]
  }
} satisfies Prisma.SkillInclude;

@Injectable()
export class SkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async findAll(query: SkillQueryDto) {
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const where: Prisma.SkillWhereInput = {
      category: query.category,
      isActive: query.isActive,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: "insensitive" } },
              { name: { contains: query.search, mode: "insensitive" } },
              { category: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.skill.findMany({
        where,
        include: skillInclude,
        orderBy: [{ isActive: "desc" }, { code: "asc" }],
        skip,
        take
      }),
      this.prisma.skill.count({ where })
    ]);

    return { items, meta: { total, page, limit } };
  }

  async findOne(id: number) {
    const skill = await this.prisma.skill.findUnique({
      where: { id },
      include: skillInclude
    });
    if (!skill) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Skill not found", "SKILL_NOT_FOUND");
    }
    return skill;
  }

  async create(dto: CreateSkillDto, actor: AuthUser, context?: RequestContext) {
    const positionIds = this.uniqueIds(dto.positionIds);
    await this.ensurePositions(positionIds);
    const skill = await this.prisma.skill.create({
      data: {
        code: dto.code.toUpperCase(),
        name: dto.name,
        category: dto.category,
        description: dto.description,
        isActive: dto.isActive ?? true,
        positionSkills: positionIds.length
          ? {
              create: positionIds.map((positionId) => ({ positionId }))
            }
          : undefined
      },
      include: skillInclude
    });

    await this.audit.log({
      userId: actor.id,
      action: "CREATE_SKILL",
      entityType: "Skill",
      entityId: skill.id,
      newValue: skill,
      context
    });

    return skill;
  }

  async update(
    id: number,
    dto: UpdateSkillDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const oldValue = await this.findOne(id);
    const positionIds = dto.positionIds ? this.uniqueIds(dto.positionIds) : undefined;
    await this.ensurePositions(positionIds);
    const skill = await this.prisma.$transaction(async (tx) => {
      if (positionIds) {
        await tx.positionSkill.deleteMany({ where: { skillId: id } });
      }

      return tx.skill.update({
        where: { id },
        data: {
          code: dto.code?.toUpperCase(),
          name: dto.name,
          category: dto.category,
          description: dto.description,
          isActive: dto.isActive,
          positionSkills: positionIds?.length
            ? {
                create: positionIds.map((positionId) => ({ positionId }))
              }
            : undefined
        },
        include: skillInclude
      });
    });

    await this.audit.log({
      userId: actor.id,
      action: "UPDATE_SKILL",
      entityType: "Skill",
      entityId: id,
      oldValue,
      newValue: skill,
      context
    });

    return skill;
  }

  async remove(id: number, actor: AuthUser, context?: RequestContext) {
    const oldValue = await this.findOne(id);
    const skill = await this.prisma.skill.update({
      where: { id },
      data: { isActive: false }
    });

    await this.audit.log({
      userId: actor.id,
      action: "DELETE_SKILL",
      entityType: "Skill",
      entityId: id,
      oldValue,
      newValue: skill,
      context
    });

    return skill;
  }

  private async ensurePositions(positionIds?: number[]) {
    if (!positionIds?.length) {
      return;
    }

    const positions = await this.prisma.position.findMany({
      where: { id: { in: positionIds }, deletedAt: null },
      select: { id: true }
    });
    if (positions.length !== positionIds.length) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Position not found", "POSITION_NOT_FOUND");
    }
  }

  private uniqueIds(ids?: number[]) {
    return Array.from(new Set(ids ?? []));
  }
}
