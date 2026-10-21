import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/services/audit.service";
import { ApiError } from "../common/api-error";
import { AuthUser, RequestContext } from "../common/types";
import { currentEmployeeWhere } from "../common/prisma-where";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";

type DepartmentTreeNode = Prisma.DepartmentGetPayload<{}> & {
  children: DepartmentTreeNode[];
};

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  findAll(search?: string) {
    const where: Prisma.DepartmentWhereInput = {
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

    return this.prisma.department.findMany({
      where,
      include: {
        parent: true,
        manager: { include: { department: true, position: true } },
        _count: {
          select: {
            employees: { where: currentEmployeeWhere() },
            teams: { where: { deletedAt: null } }
          }
        }
      },
      orderBy: { name: "asc" }
    });
  }

  async tree() {
    const departments = await this.prisma.department.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" }
    });

    const byId = new Map<number, DepartmentTreeNode>();
    const roots: DepartmentTreeNode[] = [];
    for (const department of departments) {
      byId.set(department.id, { ...department, children: [] });
    }
    for (const department of byId.values()) {
      if (department.parentId && byId.has(department.parentId)) {
        byId.get(department.parentId)?.children.push(department);
      } else {
        roots.push(department);
      }
    }

    return roots;
  }

  async findOne(id: number) {
    const department = await this.prisma.department.findFirst({
      where: { id, deletedAt: null },
      include: {
        parent: true,
        children: true,
        manager: { include: { department: true, position: true } },
        _count: {
          select: {
            employees: { where: currentEmployeeWhere() },
            teams: { where: { deletedAt: null } }
          }
        }
      }
    });
    if (!department) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Department not found",
        "DEPARTMENT_NOT_FOUND"
      );
    }
    return department;
  }

  async create(
    dto: CreateDepartmentDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    if (dto.parentId) {
      await this.ensureParent(dto.parentId);
    }
    if (dto.managerId) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Assign a department manager after employees belong to this department",
        "VALIDATION_ERROR"
      );
    }

    const department = await this.prisma.department.create({
      data: {
        code: dto.code,
        name: dto.name,
        parentId: dto.parentId,
        managerId: dto.managerId,
        isActive: dto.isActive ?? true
      }
    });

    await this.audit.log({
      userId: actor.id,
      action: "CREATE_DEPARTMENT",
      entityType: "Department",
      entityId: department.id,
      newValue: department,
      context
    });

    return department;
  }

  async update(
    id: number,
    dto: UpdateDepartmentDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const oldValue = await this.findOne(id);
    if (dto.parentId === id) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Department cannot be its own parent",
        "VALIDATION_ERROR"
      );
    }
    if (dto.parentId) {
      await this.ensureParent(dto.parentId);
      await this.ensureNoParentCycle(id, dto.parentId);
    }
    if (dto.managerId) {
      await this.ensureManagerInDepartment(dto.managerId, id);
    }

    const department = await this.prisma.department.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        parentId: dto.parentId,
        managerId: dto.managerId,
        isActive: dto.isActive
      }
    });

    await this.audit.log({
      userId: actor.id,
      action: "UPDATE_DEPARTMENT",
      entityType: "Department",
      entityId: id,
      oldValue,
      newValue: department,
      context
    });

    return department;
  }

  async softDelete(id: number, actor: AuthUser, context?: RequestContext) {
    const oldValue = await this.findOne(id);
    const department = await this.prisma.department.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() }
    });

    await this.audit.log({
      userId: actor.id,
      action: "DELETE_DEPARTMENT",
      entityType: "Department",
      entityId: id,
      oldValue,
      context
    });

    return department;
  }

  private async ensureParent(id: number) {
    const parent = await this.prisma.department.findFirst({
      where: { id, deletedAt: null },
      select: { id: true }
    });
    if (!parent) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Department not found",
        "DEPARTMENT_NOT_FOUND"
      );
    }
  }

  private async ensureNoParentCycle(departmentId: number, parentId: number) {
    const visited = new Set<number>();
    let currentId: number | null = parentId;

    while (currentId) {
      if (currentId === departmentId) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          "Department parent cannot be one of its descendants",
          "VALIDATION_ERROR"
        );
      }

      if (visited.has(currentId)) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          "Department hierarchy contains a cycle",
          "VALIDATION_ERROR"
        );
      }
      visited.add(currentId);

      const current = await this.prisma.department.findFirst({
        where: { id: currentId, deletedAt: null },
        select: { parentId: true }
      });
      currentId = current?.parentId ?? null;
    }
  }

  private async ensureManagerInDepartment(managerId: number, departmentId: number) {
    const manager = await this.prisma.employee.findFirst({
      where: currentEmployeeWhere({
        id: managerId,
        departmentId
      }),
      select: { id: true }
    });
    if (!manager) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Department manager must belong to this department",
        "VALIDATION_ERROR"
      );
    }
  }
}
