import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CareerLevel, EmployeeStatus, Position, Prisma } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/services/audit.service";
import { AccessControlService } from "../common/services/access-control.service";
import { AuthUser, RequestContext } from "../common/types";
import { currentEmployeeWhere } from "../common/prisma-where";
import { isManagerPosition } from "../common/position-role";
import {
  formatDateDdMmYyyy,
  omitSensitiveUser,
  pagination,
  toDateOnly
} from "../common/utils";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { EmployeeQueryDto } from "./dto/employee-query.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { UpdateSelfEmployeeDto } from "./dto/update-self-employee.dto";

const employeeInclude = {
  department: true,
  position: true,
  employeeSkills: {
    include: { skill: true },
    orderBy: [{ skill: { code: "asc" } }]
  },
  user: {
    include: {
      userRoles: { include: { role: true } }
    }
  }
} satisfies Prisma.EmployeeInclude;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly accessControl: AccessControlService
  ) {}

  async findAll(query: EmployeeQueryDto) {
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const where = this.buildWhere(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        include: employeeInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      this.prisma.employee.count({ where })
    ]);

    return {
      items: items.map((item) => this.safeEmployee(item)),
      meta: { total, page, limit }
    };
  }

  async findTeam(user: AuthUser, query: EmployeeQueryDto) {
    const teamIds = await this.accessControl.teamEmployeeIds(user);
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const where: Prisma.EmployeeWhereInput = {
      ...this.buildWhere(query),
      id: { in: teamIds }
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        include: employeeInclude,
        orderBy: { fullName: "asc" },
        skip,
        take
      }),
      this.prisma.employee.count({ where })
    ]);

    return {
      items: items.map((item) => this.safeEmployee(item)),
      meta: { total, page, limit }
    };
  }

  async findOne(id: number, user?: AuthUser) {
    if (user) {
      await this.accessControl.ensureCanReadEmployee(user, id);
    }

    const employee = await this.prisma.employee.findFirst({
      where: currentEmployeeWhere({ id }),
      include: employeeInclude
    });
    if (!employee) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Employee not found",
        "EMPLOYEE_NOT_FOUND"
      );
    }

    return this.safeEmployee(employee);
  }

  async myProfile(user: AuthUser) {
    if (!user.employeeId) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Employee not found",
        "EMPLOYEE_NOT_FOUND"
      );
    }

    return this.findOne(user.employeeId, user);
  }

  async create(
    dto: CreateEmployeeDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const companyEmail = dto.companyEmail.toLowerCase();
    await this.ensureEmailAvailable(companyEmail);
    const references = await this.ensureDepartmentAndPosition(
      dto.departmentId,
      dto.positionId
    );

    const birthDate = toDateOnly(dto.birthDate);
    const defaultPassword = formatDateDdMmYyyy(birthDate);
    const passwordHash = await bcrypt.hash(defaultPassword, this.saltRounds());
    const roles = await this.rolesForPosition(references.position);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: companyEmail,
          email: companyEmail,
          passwordHash,
          mustChangePassword: true,
          userRoles: {
            create: roles.map((role) => ({
              roleId: role.id,
              assignedBy: actor.id
            }))
          }
        }
      });

      const employee = await tx.employee.create({
        data: {
          employeeCode: dto.employeeCode,
          fullName: dto.fullName,
          companyEmail,
          avatarUrl: dto.avatarUrl,
          personalEmail: dto.personalEmail,
          phone: dto.phone,
          birthDate,
          hireDate: dto.hireDate ? toDateOnly(dto.hireDate) : undefined,
          status: dto.status ?? EmployeeStatus.ACTIVE,
          departmentId: dto.departmentId,
          positionId: dto.positionId,
          careerLevel: dto.careerLevel ?? CareerLevel.FRESHER,
          userId: user.id
        },
        include: employeeInclude
      });

      return { employee, user };
    });

    await this.audit.log({
      userId: actor.id,
      action: "CREATE_USER_FOR_EMPLOYEE",
      entityType: "User",
      entityId: result.user.id,
      newValue: { username: result.user.username, email: result.user.email },
      context
    });
    await this.audit.log({
      userId: actor.id,
      action: "CREATE_EMPLOYEE",
      entityType: "Employee",
      entityId: result.employee.id,
      newValue: {
        employeeCode: result.employee.employeeCode,
        fullName: result.employee.fullName,
        companyEmail: result.employee.companyEmail
      },
      context
    });

    return {
      employeeId: result.employee.id,
      userId: result.user.id,
      employeeCode: result.employee.employeeCode,
      fullName: result.employee.fullName,
      companyEmail: result.employee.companyEmail,
      username: result.user.username,
      defaultPassword,
      mustChangePassword: true,
      employee: this.safeEmployee(result.employee)
    };
  }

  async update(
    id: number,
    dto: UpdateEmployeeDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const oldValue = await this.prisma.employee.findFirst({
      where: currentEmployeeWhere({ id }),
      include: employeeInclude
    });
    if (!oldValue) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Employee not found",
        "EMPLOYEE_NOT_FOUND"
      );
    }

    const effectiveDepartmentId =
      dto.departmentId === undefined ? oldValue.departmentId : dto.departmentId;
    const effectivePositionId =
      dto.positionId === undefined ? oldValue.positionId : dto.positionId;
    const references = await this.ensureDepartmentAndPosition(
      effectiveDepartmentId,
      effectivePositionId
    );
    if (dto.companyEmail && dto.companyEmail.toLowerCase() !== oldValue.companyEmail) {
      await this.ensureEmailAvailable(dto.companyEmail.toLowerCase(), id, oldValue.userId);
    }

    const employee = await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: {
          employeeCode: dto.employeeCode,
          fullName: dto.fullName,
          companyEmail: dto.companyEmail?.toLowerCase(),
          avatarUrl: dto.avatarUrl,
          personalEmail: dto.personalEmail,
          phone: dto.phone,
          birthDate: dto.birthDate ? toDateOnly(dto.birthDate) : undefined,
          hireDate: dto.hireDate ? toDateOnly(dto.hireDate) : undefined,
          status: dto.status,
          departmentId: dto.departmentId,
          positionId: dto.positionId,
          careerLevel: dto.careerLevel
        }
      });

      if (dto.companyEmail && oldValue.userId) {
        await tx.user.update({
          where: { id: oldValue.userId },
          data: {
            username: dto.companyEmail.toLowerCase(),
            email: dto.companyEmail.toLowerCase()
          }
        });
      }

      if (dto.positionId !== undefined && oldValue.userId) {
        await this.syncManagerRoleForPosition(
          tx,
          oldValue.userId,
          references.position,
          actor.id
        );
      }

      return tx.employee.findUniqueOrThrow({
        where: { id },
        include: employeeInclude
      });
    });

    await this.audit.log({
      userId: actor.id,
      action: "UPDATE_EMPLOYEE",
      entityType: "Employee",
      entityId: id,
      oldValue: this.safeEmployee(oldValue),
      newValue: this.safeEmployee(employee),
      context
    });

    return this.safeEmployee(employee);
  }

  async updateSelf(
    user: AuthUser,
    dto: UpdateSelfEmployeeDto,
    context?: RequestContext
  ) {
    if (!user.employeeId) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Employee not found",
        "EMPLOYEE_NOT_FOUND"
      );
    }

    const employee = await this.prisma.employee.update({
      where: { id: user.employeeId },
      data: {
        avatarUrl: dto.avatarUrl,
        personalEmail: dto.personalEmail,
        phone: dto.phone
      },
      include: employeeInclude
    });

    await this.audit.log({
      userId: user.id,
      action: "UPDATE_EMPLOYEE_SELF",
      entityType: "Employee",
      entityId: employee.id,
      newValue: { personalEmail: dto.personalEmail, phone: dto.phone },
      context
    });

    return this.safeEmployee(employee);
  }

  async softDelete(id: number, actor: AuthUser, context?: RequestContext) {
    const oldValue = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      include: employeeInclude
    });
    if (!oldValue) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Employee not found",
        "EMPLOYEE_NOT_FOUND"
      );
    }

    const employee = await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.employee.update({
        where: { id },
        data: {
          status: EmployeeStatus.INACTIVE,
          deletedAt: new Date()
        },
        include: employeeInclude
      });

      if (oldValue.userId) {
        await tx.user.update({
          where: { id: oldValue.userId },
          data: {
            isActive: false,
            deletedAt: deleted.deletedAt,
            refreshTokenHash: null,
            refreshTokenVersion: { increment: 1 }
          }
        });
      }

      await tx.employeeManager.updateMany({
        where: {
          isActive: true,
          OR: [{ employeeId: id }, { managerId: id }]
        },
        data: {
          isActive: false,
          endDate: toDateOnly(deleted.deletedAt ?? new Date())
        }
      });

      return deleted;
    });

    await this.audit.log({
      userId: actor.id,
      action: "DELETE_EMPLOYEE",
      entityType: "Employee",
      entityId: id,
      oldValue: this.safeEmployee(oldValue),
      context
    });

    return this.safeEmployee(employee);
  }

  async resetPassword(id: number, actor: AuthUser, context?: RequestContext) {
    const employee = await this.prisma.employee.findFirst({
      where: currentEmployeeWhere({ id }),
      include: { user: true }
    });
    if (!employee || !employee.user) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Employee not found",
        "EMPLOYEE_NOT_FOUND"
      );
    }

    const defaultPassword = formatDateDdMmYyyy(employee.birthDate);
    const passwordHash = await bcrypt.hash(defaultPassword, this.saltRounds());
    await this.prisma.user.update({
      where: { id: employee.user.id },
      data: {
        passwordHash,
        mustChangePassword: true,
        refreshTokenHash: null,
        refreshTokenVersion: { increment: 1 }
      }
    });

    await this.audit.log({
      userId: actor.id,
      action: "RESET_EMPLOYEE_PASSWORD",
      entityType: "Employee",
      entityId: id,
      context
    });

    return {
      employeeId: employee.id,
      userId: employee.user.id,
      username: employee.user.username,
      defaultPassword,
      mustChangePassword: true
    };
  }

  async setUserActive(
    id: number,
    isActive: boolean,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: currentEmployeeWhere({ id }),
      include: { user: true }
    });
    if (!employee?.user) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Employee user not found",
        "USER_NOT_FOUND"
      );
    }

    const user = await this.prisma.user.update({
      where: { id: employee.user.id },
      data: {
        isActive,
        refreshTokenHash: isActive ? undefined : null,
        refreshTokenVersion: isActive ? undefined : { increment: 1 }
      }
    });

    await this.audit.log({
      userId: actor.id,
      action: isActive ? "UNLOCK_EMPLOYEE_USER" : "LOCK_EMPLOYEE_USER",
      entityType: "User",
      entityId: user.id,
      newValue: { isActive },
      context
    });

    return omitSensitiveUser(user as unknown as Record<string, unknown>);
  }

  private buildWhere(query: EmployeeQueryDto): Prisma.EmployeeWhereInput {
    return {
      AND: [
        currentEmployeeWhere(),
        ...(query.search
          ? [
              {
                OR: [
                  { fullName: { contains: query.search, mode: "insensitive" } },
                  { employeeCode: { contains: query.search, mode: "insensitive" } },
                  { companyEmail: { contains: query.search, mode: "insensitive" } }
                ]
              } satisfies Prisma.EmployeeWhereInput
            ]
          : [])
      ],
      departmentId: query.departmentId,
      positionId: query.positionId,
      status: query.status,
      careerLevel: query.careerLevel
    };
  }

  private async ensureEmailAvailable(
    companyEmail: string,
    employeeId?: number,
    userId?: number | null
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        companyEmail,
        id: employeeId ? { not: employeeId } : undefined
      },
      select: { id: true }
    });
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: companyEmail }, { username: companyEmail }],
        id: userId ? { not: userId } : undefined
      },
      select: { id: true }
    });

    if (employee || user) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Company email already exists",
        "VALIDATION_ERROR"
      );
    }
  }

  private async ensureDepartmentAndPosition(
    departmentId?: number | null,
    positionId?: number | null
  ) {
    let position:
      | Pick<Position, "id" | "code" | "name" | "departmentId">
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
    } else if (positionId === null) {
      position = null;
    }

    return { position };
  }

  private async rolesForPosition(position?: Pick<Position, "code" | "name"> | null) {
    const roleNames = isManagerPosition(position)
      ? ["EMPLOYEE", "MANAGER"]
      : ["EMPLOYEE"];
    const roles = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
      select: { id: true, name: true }
    });

    if (roles.length !== roleNames.length) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Role not found", "ROLE_NOT_FOUND");
    }

    return roles;
  }

  private async syncManagerRoleForPosition(
    tx: Prisma.TransactionClient,
    userId: number,
    position: Pick<Position, "code" | "name"> | null | undefined,
    actorId: number
  ) {
    const managerRole = await tx.role.findUnique({
      where: { name: "MANAGER" },
      select: { id: true }
    });
    if (!managerRole) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Role not found", "ROLE_NOT_FOUND");
    }

    if (isManagerPosition(position)) {
      await tx.userRole.upsert({
        where: { userId_roleId: { userId, roleId: managerRole.id } },
        create: { userId, roleId: managerRole.id, assignedBy: actorId },
        update: {}
      });
      return;
    }

    await tx.userRole.deleteMany({
      where: { userId, roleId: managerRole.id }
    });
  }

  private safeEmployee(employee: unknown) {
    const cloned = JSON.parse(JSON.stringify(employee));
    if (cloned.user) {
      cloned.user = omitSensitiveUser(cloned.user);
    }
    return cloned;
  }

  private saltRounds() {
    return Number(this.config.get<string>("BCRYPT_SALT_ROUNDS") ?? 10);
  }
}
