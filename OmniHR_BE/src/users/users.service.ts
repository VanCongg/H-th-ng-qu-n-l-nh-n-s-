import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/services/audit.service";
import { ApiError } from "../common/api-error";
import { AuthUser, RequestContext } from "../common/types";
import { omitSensitiveUser, pagination } from "../common/utils";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { AssignRoleDto } from "./dto/assign-role.dto";
import { ResetUserPasswordDto } from "./dto/reset-user-password.dto";

const userInclude = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      companyEmail: true
    }
  },
  userRoles: {
    include: {
      role: true
    }
  }
} satisfies Prisma.UserInclude;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService
  ) {}

  async findAll(query: PaginationQueryDto) {
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { username: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: userInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      this.prisma.user.count({ where })
    ]);

    return {
      items: items.map((item) => omitSensitiveUser(item as unknown as Record<string, unknown>)),
      meta: { total, page, limit }
    };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: userInclude
    });
    if (!user) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found", "USER_NOT_FOUND");
    }

    return omitSensitiveUser(user as unknown as Record<string, unknown>);
  }

  async create(dto: CreateUserDto, actor: AuthUser, context?: RequestContext) {
    const roleIds = this.uniqueIds(dto.roleIds);
    await this.ensureRoles(roleIds);
    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds());
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash,
        mustChangePassword: dto.mustChangePassword ?? true,
        userRoles: roleIds.length
          ? {
              create: roleIds.map((roleId) => ({
                roleId,
                assignedBy: actor.id
              }))
            }
          : undefined
      },
      include: userInclude
    });

    await this.audit.log({
      userId: actor.id,
      action: "CREATE_USER",
      entityType: "User",
      entityId: user.id,
      newValue: { username: user.username, email: user.email },
      context
    });

    return omitSensitiveUser(user as unknown as Record<string, unknown>);
  }

  async update(
    id: number,
    dto: UpdateUserDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const oldValue = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: userInclude
    });
    if (!oldValue) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found", "USER_NOT_FOUND");
    }

    const roleIds = dto.roleIds ? this.uniqueIds(dto.roleIds) : undefined;
    await this.ensureRoles(roleIds);
    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, this.saltRounds())
      : undefined;

    const user = await this.prisma.$transaction(async (tx) => {
      if (roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (roleIds.length) {
          await tx.userRole.createMany({
            data: roleIds.map((roleId) => ({
              userId: id,
              roleId,
              assignedBy: actor.id
            })),
            skipDuplicates: true
          });
        }
      }

      return tx.user.update({
        where: { id },
        data: {
          username: dto.username,
          email: dto.email,
          passwordHash,
          isActive: dto.isActive,
          mustChangePassword: dto.mustChangePassword,
          refreshTokenHash:
            dto.password || dto.isActive === false ? null : undefined,
          refreshTokenVersion:
            dto.password || dto.isActive === false ? { increment: 1 } : undefined
        },
        include: userInclude
      });
    });

    await this.audit.log({
      userId: actor.id,
      action: "UPDATE_USER",
      entityType: "User",
      entityId: user.id,
      oldValue: omitSensitiveUser(oldValue as unknown as Record<string, unknown>),
      newValue: omitSensitiveUser(user as unknown as Record<string, unknown>),
      context
    });

    return omitSensitiveUser(user as unknown as Record<string, unknown>);
  }

  async softDelete(id: number, actor: AuthUser, context?: RequestContext) {
    const oldValue = await this.prisma.user.findFirst({
      where: { id, deletedAt: null }
    });
    if (!oldValue) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found", "USER_NOT_FOUND");
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
        refreshTokenHash: null,
        refreshTokenVersion: { increment: 1 }
      }
    });

    await this.audit.log({
      userId: actor.id,
      action: "DELETE_USER",
      entityType: "User",
      entityId: id,
      oldValue: omitSensitiveUser(oldValue as unknown as Record<string, unknown>),
      context
    });

    return omitSensitiveUser(user as unknown as Record<string, unknown>);
  }

  async assignRole(
    userId: number,
    dto: AssignRoleDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    await this.ensureUser(userId);
    await this.ensureRole(dto.roleId);

    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: dto.roleId } },
      create: { userId, roleId: dto.roleId, assignedBy: actor.id },
      update: { assignedBy: actor.id }
    });

    await this.audit.log({
      userId: actor.id,
      action: "ASSIGN_ROLE",
      entityType: "User",
      entityId: userId,
      newValue: { roleId: dto.roleId },
      context
    });

    return this.findOne(userId);
  }

  async removeRole(
    userId: number,
    roleId: number,
    actor: AuthUser,
    context?: RequestContext
  ) {
    await this.ensureUser(userId);
    await this.ensureRole(roleId);
    const relation = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
      select: { userId: true }
    });
    if (!relation) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User role not found", "USER_ROLE_NOT_FOUND");
    }

    await this.prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } }
    });

    await this.audit.log({
      userId: actor.id,
      action: "REMOVE_ROLE",
      entityType: "User",
      entityId: userId,
      oldValue: { roleId },
      context
    });

    return this.findOne(userId);
  }

  async resetPassword(
    id: number,
    dto: ResetUserPasswordDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    await this.ensureUser(id);
    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds());
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: dto.mustChangePassword ?? true,
        refreshTokenHash: null,
        refreshTokenVersion: { increment: 1 }
      },
      include: userInclude
    });

    await this.audit.log({
      userId: actor.id,
      action: "RESET_USER_PASSWORD",
      entityType: "User",
      entityId: id,
      context
    });

    return omitSensitiveUser(user as unknown as Record<string, unknown>);
  }

  private async ensureUser(id: number) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true }
    });
    if (!user) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found", "USER_NOT_FOUND");
    }
  }

  private async ensureRole(id: number) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Role not found", "ROLE_NOT_FOUND");
    }
  }

  private async ensureRoles(roleIds?: number[]) {
    if (!roleIds?.length) {
      return;
    }

    const existing = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true }
    });
    if (existing.length !== roleIds.length) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Role not found", "ROLE_NOT_FOUND");
    }
  }

  private uniqueIds(ids?: number[]) {
    return Array.from(new Set(ids ?? []));
  }

  private saltRounds() {
    return Number(this.config.get<string>("BCRYPT_SALT_ROUNDS") ?? 10);
  }
}
