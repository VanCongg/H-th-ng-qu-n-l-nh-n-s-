import { HttpStatus, Injectable } from "@nestjs/common";
import { ManagerType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { currentEmployeeWhere } from "../common/prisma-where";
import { toDateOnly } from "../common/utils";
import { AssignManagerDto } from "./dto/assign-manager.dto";
import { EndManagerDto } from "./dto/end-manager.dto";

const includeEmployees = {
  employee: { include: { department: true, position: true } },
  manager: { include: { department: true, position: true } }
};

@Injectable()
export class EmployeeManagersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  findAll() {
    return this.prisma.employeeManager.findMany({
      where: {
        employee: currentEmployeeWhere(),
        manager: currentEmployeeWhere()
      },
      include: includeEmployees,
      orderBy: { createdAt: "desc" }
    });
  }

  async findByEmployee(employeeId: number) {
    await this.ensureEmployee(employeeId);
    return this.prisma.employeeManager.findMany({
      where: {
        employeeId,
        employee: currentEmployeeWhere(),
        manager: currentEmployeeWhere()
      },
      include: includeEmployees,
      orderBy: { createdAt: "desc" }
    });
  }

  async findSubordinates(managerId: number) {
    await this.ensureEmployee(managerId);
    const today = toDateOnly(new Date());
    return this.prisma.employeeManager.findMany({
      where: {
        managerId,
        isActive: true,
        employee: currentEmployeeWhere(),
        manager: currentEmployeeWhere(),
        OR: [{ endDate: null }, { endDate: { gte: today } }]
      },
      include: includeEmployees,
      orderBy: { createdAt: "desc" }
    });
  }

  async assign(dto: AssignManagerDto, actor: AuthUser, context?: RequestContext) {
    if (dto.employeeId === dto.managerId) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Employee cannot manage themselves",
        "VALIDATION_ERROR"
      );
    }

    await this.ensureEmployee(dto.employeeId);
    await this.ensureEmployee(dto.managerId);
    const managerType = dto.managerType ?? ManagerType.DIRECT;
    await this.ensureNoActiveRelation(dto.employeeId, dto.managerId, managerType);
    if (managerType === ManagerType.DIRECT) {
      await this.ensureNoActiveDirectManager(dto.employeeId);
    }

    const relation = await this.prisma.employeeManager.create({
      data: {
        employeeId: dto.employeeId,
        managerId: dto.managerId,
        managerType,
        startDate: dto.startDate ? toDateOnly(dto.startDate) : toDateOnly(new Date()),
        isActive: true
      },
      include: includeEmployees
    });

    await this.audit.log({
      userId: actor.id,
      action: "ASSIGN_MANAGER",
      entityType: "EmployeeManager",
      entityId: relation.id,
      newValue: relation,
      context
    });

    return relation;
  }

  async end(id: number, dto: EndManagerDto, actor: AuthUser, context?: RequestContext) {
    const oldValue = await this.findOne(id);
    if (!oldValue.isActive) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Manager relationship is already inactive",
        "MANAGER_RELATION_INACTIVE"
      );
    }

    const endDate = dto.endDate ? toDateOnly(dto.endDate) : toDateOnly(new Date());
    if (endDate < toDateOnly(oldValue.startDate)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "End date cannot be before start date",
        "VALIDATION_ERROR"
      );
    }

    const relation = await this.prisma.employeeManager.update({
      where: { id },
      data: {
        isActive: false,
        endDate
      },
      include: includeEmployees
    });

    await this.audit.log({
      userId: actor.id,
      action: "REMOVE_MANAGER",
      entityType: "EmployeeManager",
      entityId: id,
      oldValue,
      newValue: relation,
      context
    });

    return relation;
  }

  async findOne(id: number) {
    const relation = await this.prisma.employeeManager.findUnique({
      where: { id },
      include: includeEmployees
    });
    if (!relation) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Manager relationship not found",
        "VALIDATION_ERROR"
      );
    }
    return relation;
  }

  private activeRelationWhere(employeeId: number) {
    const today = toDateOnly(new Date());
    return {
      employeeId,
      isActive: true,
      manager: currentEmployeeWhere(),
      OR: [{ endDate: null }, { endDate: { gte: today } }]
    };
  }

  private async ensureNoActiveRelation(
    employeeId: number,
    managerId: number,
    managerType: ManagerType
  ) {
    const existing = await this.prisma.employeeManager.findFirst({
      where: {
        ...this.activeRelationWhere(employeeId),
        managerId,
        managerType
      },
      select: { id: true }
    });

    if (existing) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Manager relationship already exists",
        "MANAGER_RELATION_EXISTS"
      );
    }
  }

  private async ensureNoActiveDirectManager(employeeId: number) {
    const existing = await this.prisma.employeeManager.findFirst({
      where: {
        ...this.activeRelationWhere(employeeId),
        managerType: ManagerType.DIRECT
      },
      select: { id: true }
    });

    if (existing) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Employee already has an active direct manager",
        "DIRECT_MANAGER_EXISTS"
      );
    }
  }

  private async ensureEmployee(id: number) {
    const employee = await this.prisma.employee.findFirst({
      where: currentEmployeeWhere({ id }),
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
}
