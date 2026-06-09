import { HttpStatus, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { AssignPermissionDto } from "./dto/assign-permission.dto";

const roleInclude = {
  rolePermissions: {
    include: { permission: true }
  },
  _count: {
    select: { userRoles: true }
  }
};

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  findAll() {
    return this.prisma.role.findMany({
      include: roleInclude,
      orderBy: { name: "asc" }
    });
  }

  async findOne(id: number) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: roleInclude
    });
    if (!role) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Role not found", "ROLE_NOT_FOUND");
    }
    return role;
  }

  async create(dto: CreateRoleDto, actor: AuthUser, context?: RequestContext) {
    this.ensureAllowedRoleName(dto.name);
    const permissionIds = this.uniqueIds(dto.permissionIds);
    await this.ensurePermissions(permissionIds);
    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        rolePermissions: permissionIds.length
          ? {
              create: permissionIds.map((permissionId) => ({ permissionId }))
            }
          : undefined
      },
      include: roleInclude
    });

    await this.audit.log({
      userId: actor.id,
      action: "CREATE_ROLE",
      entityType: "Role",
      entityId: role.id,
      newValue: role,
      context
    });

    return role;
  }

  async update(
    id: number,
    dto: UpdateRoleDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    if (dto.name) {
      this.ensureAllowedRoleName(dto.name);
    }
    const permissionIds = dto.permissionIds ? this.uniqueIds(dto.permissionIds) : undefined;
    await this.ensurePermissions(permissionIds);

    const oldValue = await this.findOne(id);
    const role = await this.prisma.$transaction(async (tx) => {
      if (permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (permissionIds.length) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({
              roleId: id,
              permissionId
            })),
            skipDuplicates: true
          });
        }
      }

      return tx.role.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description
        },
        include: roleInclude
      });
    });

    await this.audit.log({
      userId: actor.id,
      action: "UPDATE_ROLE",
      entityType: "Role",
      entityId: id,
      oldValue,
      newValue: role,
      context
    });

    return role;
  }

  async remove(id: number, actor: AuthUser, context?: RequestContext) {
    const role = await this.findOne(id);
    if (role.isSystem) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "System role cannot be deleted",
        "VALIDATION_ERROR"
      );
    }

    await this.prisma.role.delete({ where: { id } });
    await this.audit.log({
      userId: actor.id,
      action: "DELETE_ROLE",
      entityType: "Role",
      entityId: id,
      oldValue: role,
      context
    });

    return role;
  }

  async assignPermission(
    roleId: number,
    dto: AssignPermissionDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    await this.findOne(roleId);
    const permission = await this.prisma.permission.findUnique({
      where: { id: dto.permissionId }
    });
    if (!permission) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Permission not found",
        "PERMISSION_NOT_FOUND"
      );
    }

    await this.prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId, permissionId: dto.permissionId }
      },
      create: { roleId, permissionId: dto.permissionId },
      update: {}
    });

    await this.audit.log({
      userId: actor.id,
      action: "ASSIGN_PERMISSION",
      entityType: "Role",
      entityId: roleId,
      newValue: { permissionId: dto.permissionId },
      context
    });

    return this.findOne(roleId);
  }

  async removePermission(
    roleId: number,
    permissionId: number,
    actor: AuthUser,
    context?: RequestContext
  ) {
    await this.findOne(roleId);
    const relation = await this.prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId, permissionId } },
      select: { roleId: true }
    });
    if (!relation) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Role permission not found",
        "ROLE_PERMISSION_NOT_FOUND"
      );
    }

    await this.prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId, permissionId } }
    });

    await this.audit.log({
      userId: actor.id,
      action: "REMOVE_PERMISSION",
      entityType: "Role",
      entityId: roleId,
      oldValue: { permissionId },
      context
    });

    return this.findOne(roleId);
  }

  private ensureAllowedRoleName(name: string) {
    if (name.trim().toUpperCase() === "HR_MANAGER") {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "HR_MANAGER role is not supported in phase 1",
        "VALIDATION_ERROR"
      );
    }
  }

  private async ensurePermissions(permissionIds?: number[]) {
    if (!permissionIds?.length) {
      return;
    }

    const existing = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
      select: { id: true }
    });
    if (existing.length !== permissionIds.length) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Permission not found",
        "PERMISSION_NOT_FOUND"
      );
    }
  }

  private uniqueIds(ids?: number[]) {
    return Array.from(new Set(ids ?? []));
  }
}
