import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { CareerLevel, EmployeeStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/services/audit.service";
import { ApiError } from "../common/api-error";
import { AuthUser, RequestContext } from "../common/types";
import { omitSensitiveUser, pagination, toDateOnly } from "../common/utils";
import { currentUserWhere } from "../common/prisma-where";
import { isManagerPosition, type PositionRoleShape } from "../common/position-role";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { AssignRoleDto } from "./dto/assign-role.dto";
import { ResetUserPasswordDto } from "./dto/reset-user-password.dto";
import {
  CreateUserEmployeeProfileDto,
  UpdateUserEmployeeProfileDto
} from "./dto/user-employee-profile.dto";

const userInclude = {
  employee: {
    include: {
      department: true,
      position: true,
      employeeSkills: {
        include: { skill: true },
        orderBy: [{ skill: { code: "asc" } }]
      }
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
      ...currentUserWhere(),
      ...(query.search
        ? {
            OR: [
              { username: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              {
                employee: {
                  is: {
                    OR: [
                      { fullName: { contains: query.search, mode: "insensitive" } },
                      { employeeCode: { contains: query.search, mode: "insensitive" } },
                      { companyEmail: { contains: query.search, mode: "insensitive" } },
                      {
                        department: {
                          is: {
                            OR: [
                              { code: { contains: query.search, mode: "insensitive" } },
                              { name: { contains: query.search, mode: "insensitive" } }
                            ]
                          }
                        }
                      },
                      {
                        position: {
                          is: {
                            OR: [
                              { code: { contains: query.search, mode: "insensitive" } },
                              { name: { contains: query.search, mode: "insensitive" } }
                            ]
                          }
                        }
                      }
                    ]
                  }
                }
              }
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
      where: currentUserWhere({ id }),
      include: userInclude
    });
    if (!user) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found", "USER_NOT_FOUND");
    }

    return omitSensitiveUser(user as unknown as Record<string, unknown>);
  }

  async create(dto: CreateUserDto, actor: AuthUser, context?: RequestContext) {
    const roleIds = this.uniqueIds(dto.roleIds);
    const email = dto.email.toLowerCase();
    await this.ensureRoles(roleIds);
    const requiresEmployeeProfile = await this.requiresEmployeeProfile(roleIds);
    await this.ensureEmployeeProfileForCreate(
      dto.employeeProfile,
      email,
      roleIds,
      requiresEmployeeProfile
    );
    const passwordHash = await bcrypt.hash(dto.password, this.saltRounds());

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          username: dto.username,
          email,
          passwordHash,
          isActive: dto.isActive ?? true,
          mustChangePassword: dto.mustChangePassword ?? true,
          userRoles: roleIds.length
            ? {
                create: roleIds.map((roleId) => ({
                  roleId,
                  assignedBy: actor.id
                }))
              }
            : undefined
        }
      });

      if (dto.employeeProfile && requiresEmployeeProfile) {
        await tx.employee.create({
          data: this.employeeProfileCreateData(
            dto.employeeProfile,
            email,
            createdUser.id
          )
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: createdUser.id },
        include: userInclude
      });
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
      where: currentUserWhere({ id }),
      include: userInclude
    });
    if (!oldValue) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found", "USER_NOT_FOUND");
    }

    const roleIds = dto.roleIds ? this.uniqueIds(dto.roleIds) : undefined;
    const effectiveRoleIds =
      roleIds ?? oldValue.userRoles.map((userRole) => userRole.roleId);
    const email = dto.email?.toLowerCase();
    await this.ensureRoles(roleIds);
    const requiresEmployeeProfile =
      await this.requiresEmployeeProfile(effectiveRoleIds);
    await this.ensureEmployeeProfileForUpdate(
      dto.employeeProfile,
      oldValue.employee,
      oldValue.employee ? email : email ?? oldValue.email,
      effectiveRoleIds,
      requiresEmployeeProfile
    );
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

      await tx.user.update({
        where: { id },
        data: {
          username: dto.username,
          email,
          passwordHash,
          isActive: dto.isActive,
          mustChangePassword: dto.mustChangePassword,
          refreshTokenHash:
            dto.password || dto.isActive === false ? null : undefined,
          refreshTokenVersion:
            dto.password || dto.isActive === false ? { increment: 1 } : undefined
        }
      });

      if (oldValue.employee && email) {
        await tx.employee.update({
          where: { id: oldValue.employee.id },
          data: { companyEmail: email }
        });
      }

      if (dto.employeeProfile && (oldValue.employee || requiresEmployeeProfile)) {
        if (oldValue.employee) {
          await tx.employee.update({
            where: { id: oldValue.employee.id },
            data: this.employeeProfileUpdateData(dto.employeeProfile)
          });
        } else {
          const profile = this.requireCompleteEmployeeProfile(dto.employeeProfile);
          await tx.employee.create({
            data: this.employeeProfileCreateData(
              profile,
              email ?? oldValue.email,
              id
            )
          });
        }
      }

      return tx.user.findUniqueOrThrow({
        where: { id },
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
      where: currentUserWhere({ id }),
      include: { employee: true }
    });
    if (!oldValue) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User not found", "USER_NOT_FOUND");
    }

    const deletedAt = new Date();
    const user = await this.prisma.$transaction(async (tx) => {
      const deletedUser = await tx.user.update({
        where: { id },
        data: {
          isActive: false,
          deletedAt,
          refreshTokenHash: null,
          refreshTokenVersion: { increment: 1 }
        }
      });

      if (oldValue.employee && !oldValue.employee.deletedAt) {
        await tx.employee.update({
          where: { id: oldValue.employee.id },
          data: {
            status: EmployeeStatus.INACTIVE,
            deletedAt
          }
        });
        await tx.employeeManager.updateMany({
          where: {
            isActive: true,
            OR: [
              { employeeId: oldValue.employee.id },
              { managerId: oldValue.employee.id }
            ]
          },
          data: {
            isActive: false,
            endDate: toDateOnly(deletedAt)
          }
        });
      }

      return deletedUser;
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
    const role = await this.ensureRole(roleId);
    const relation = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
      select: { userId: true }
    });
    if (!relation) {
      throw new ApiError(HttpStatus.NOT_FOUND, "User role not found", "USER_ROLE_NOT_FOUND");
    }
    if (role.name === "MANAGER") {
      const user = await this.prisma.user.findFirst({
        where: currentUserWhere({ id: userId }),
        select: {
          employee: {
            select: {
              position: { select: { code: true, name: true } }
            }
          }
        }
      });
      await this.ensureManagerRoleCanBeRemoved(user?.employee?.position);
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

  private async ensureEmployeeProfileForCreate(
    profile: CreateUserEmployeeProfileDto | undefined,
    companyEmail: string,
    roleIds: number[],
    requiresEmployeeProfile: boolean
  ) {
    if (!requiresEmployeeProfile) {
      return;
    }

    if (!profile) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Employee profile is required",
        "VALIDATION_ERROR"
      );
    }

    const references = await this.ensureDepartmentAndPosition(
      profile.departmentId,
      profile.positionId
    );
    await this.ensureManagerPositionRole(references.position, roleIds);
    await this.ensureEmployeeCodeAvailable(profile.employeeCode);
    await this.ensureEmployeeEmailAvailable(companyEmail);
  }

  private async ensureEmployeeProfileForUpdate(
    profile: UpdateUserEmployeeProfileDto | undefined,
    employee: {
      id: number;
      employeeCode: string;
      companyEmail: string;
      departmentId?: number | null;
      positionId?: number | null;
      position?: PositionRoleShape | null;
    } | null,
    companyEmail: string | undefined,
    roleIds: number[],
    requiresEmployeeProfile: boolean
  ) {
    if (!requiresEmployeeProfile && !employee) {
      return;
    }

    if (
      companyEmail &&
      (employee || profile) &&
      employee?.companyEmail !== companyEmail
    ) {
      await this.ensureEmployeeEmailAvailable(companyEmail, employee?.id);
    }

    let effectivePosition = employee?.position;
    if (!profile) {
      if (requiresEmployeeProfile && !employee) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          "Employee profile is required",
          "VALIDATION_ERROR"
        );
      }
      await this.ensureManagerPositionRole(effectivePosition, roleIds);
      return;
    }

    const effectiveDepartmentId =
      profile.departmentId === undefined
        ? employee?.departmentId
        : profile.departmentId;
    const effectivePositionId =
      profile.positionId === undefined ? employee?.positionId : profile.positionId;
    const references = await this.ensureDepartmentAndPosition(
      effectiveDepartmentId,
      effectivePositionId
    );
    if (profile.positionId !== undefined) {
      effectivePosition = references.position;
    }
    await this.ensureManagerPositionRole(effectivePosition, roleIds);

    if (employee) {
      if (profile.employeeCode && profile.employeeCode !== employee.employeeCode) {
        await this.ensureEmployeeCodeAvailable(profile.employeeCode, employee.id);
      }
      return;
    }

    const completeProfile = this.requireCompleteEmployeeProfile(profile);
    await this.ensureEmployeeCodeAvailable(completeProfile.employeeCode);
    await this.ensureEmployeeEmailAvailable(companyEmail ?? "");
  }

  private requireCompleteEmployeeProfile(
    profile: UpdateUserEmployeeProfileDto
  ): CreateUserEmployeeProfileDto {
    if (
      !profile.employeeCode ||
      !profile.fullName ||
      !profile.birthDate ||
      !profile.departmentId ||
      !profile.positionId
    ) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Employee profile requires employee code, full name, birth date, department, and position",
        "VALIDATION_ERROR"
      );
    }

    return {
      employeeCode: profile.employeeCode,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      birthDate: profile.birthDate,
      hireDate: profile.hireDate,
      status: profile.status,
      departmentId: profile.departmentId,
      positionId: profile.positionId
    };
  }

  private employeeProfileCreateData(
    profile: CreateUserEmployeeProfileDto,
    companyEmail: string,
    userId: number
  ): Prisma.EmployeeUncheckedCreateInput {
    return {
      employeeCode: profile.employeeCode,
      fullName: profile.fullName,
      companyEmail,
      avatarUrl: profile.avatarUrl,
      birthDate: toDateOnly(profile.birthDate),
      hireDate: profile.hireDate ? toDateOnly(profile.hireDate) : undefined,
      status: profile.status ?? EmployeeStatus.ACTIVE,
      departmentId: profile.departmentId,
      positionId: profile.positionId,
      careerLevel: profile.careerLevel ?? CareerLevel.FRESHER,
      userId
    };
  }

  private employeeProfileUpdateData(
    profile: UpdateUserEmployeeProfileDto
  ): Prisma.EmployeeUncheckedUpdateInput {
    return {
      employeeCode: profile.employeeCode,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      birthDate: profile.birthDate ? toDateOnly(profile.birthDate) : undefined,
      hireDate: profile.hireDate ? toDateOnly(profile.hireDate) : undefined,
      status: profile.status,
      departmentId: profile.departmentId,
      positionId: profile.positionId,
      careerLevel: profile.careerLevel
    };
  }

  private async ensureDepartmentAndPosition(
    departmentId?: number | null,
    positionId?: number | null
  ) {
    let position:
      | (PositionRoleShape & { id: number; departmentId: number | null })
      | null
      | undefined;

    if (departmentId) {
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

    if (positionId) {
      position = await this.prisma.position.findFirst({
        where: { id: positionId, deletedAt: null },
        select: { id: true, code: true, name: true, departmentId: true }
      });
      if (!position) {
        throw new ApiError(
          HttpStatus.NOT_FOUND,
          "Position not found",
          "POSITION_NOT_FOUND"
        );
      }
      if (!departmentId) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          "Department is required when selecting a position",
          "VALIDATION_ERROR"
        );
      }
      if (position.departmentId && position.departmentId !== departmentId) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          "Position does not belong to selected department",
          "VALIDATION_ERROR"
        );
      }
    }

    return { position };
  }

  private async ensureManagerPositionRole(
    position: PositionRoleShape | null | undefined,
    roleIds: number[]
  ) {
    if (!isManagerPosition(position)) {
      return;
    }

    const managerRole = await this.prisma.role.findUnique({
      where: { name: "MANAGER" },
      select: { id: true }
    });
    if (!managerRole) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Role not found", "ROLE_NOT_FOUND");
    }

    if (!roleIds.includes(managerRole.id)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Manager position requires MANAGER role",
        "VALIDATION_ERROR"
      );
    }
  }

  private ensureManagerRoleCanBeRemoved(
    position: PositionRoleShape | null | undefined
  ) {
    if (!isManagerPosition(position)) {
      return;
    }

    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      "Manager position requires MANAGER role",
      "VALIDATION_ERROR"
    );
  }

  private async ensureEmployeeCodeAvailable(employeeCode: string, employeeId?: number) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        employeeCode,
        id: employeeId ? { not: employeeId } : undefined
      },
      select: { id: true }
    });
    if (employee) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Employee code already exists",
        "VALIDATION_ERROR"
      );
    }
  }

  private async ensureEmployeeEmailAvailable(companyEmail: string, employeeId?: number) {
    if (!companyEmail) {
      return;
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        companyEmail,
        id: employeeId ? { not: employeeId } : undefined
      },
      select: { id: true }
    });
    if (employee) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Company email already exists",
        "VALIDATION_ERROR"
      );
    }
  }

  private async ensureUser(id: number) {
    const user = await this.prisma.user.findFirst({
      where: currentUserWhere({ id }),
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
    return role;
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

  private async requiresEmployeeProfile(roleIds: number[]) {
    if (!roleIds.length) {
      return true;
    }

    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { name: true }
    });

    return roles.some((role) => role.name !== "ADMIN");
  }

  private uniqueIds(ids?: number[]) {
    return Array.from(new Set(ids ?? []));
  }

  private saltRounds() {
    return Number(this.config.get<string>("BCRYPT_SALT_ROUNDS") ?? 10);
  }
}
