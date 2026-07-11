import { HttpStatus, Injectable } from "@nestjs/common";
import { ProjectStatus, TaskStatus, Prisma } from "@prisma/client";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/services/audit.service";
import { AccessControlService } from "../common/services/access-control.service";
import { AuthUser, RequestContext } from "../common/types";
import { pagination, toDateOnly } from "../common/utils";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ProjectQueryDto } from "./dto/project-query.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

const projectInclude = {
  department: true,
  manager: { include: { department: true, position: true } },
  createdByUser: { select: { id: true, username: true, email: true } },
  _count: { select: { tasks: { where: { deletedAt: null } } } }
} satisfies Prisma.ProjectInclude;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accessControl: AccessControlService
  ) {}

  async findAll(query: ProjectQueryDto, user: AuthUser) {
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const where = await this.buildWhere(query, user);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: projectInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      this.prisma.project.count({ where })
    ]);

    return { items, meta: { total, page, limit } };
  }

  async findOne(id: number, user: AuthUser) {
    await this.accessControl.ensureCanReadProject(user, id);
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: projectInclude
    });
    if (!project) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Project not found", "PROJECT_NOT_FOUND");
    }
    return project;
  }

  async create(dto: CreateProjectDto, actor: AuthUser, context?: RequestContext) {
    const scope = await this.resolveManagedDepartment(actor);
    this.ensureDateRange(dto.startDate, dto.endDate);

    const project = await this.prisma.project.create({
      data: {
        departmentId: scope.departmentId,
        managerId: scope.managerId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        status: dto.status ?? ProjectStatus.ACTIVE,
        startDate: dto.startDate ? toDateOnly(dto.startDate) : undefined,
        endDate: dto.endDate ? toDateOnly(dto.endDate) : undefined,
        createdByUserId: actor.id
      },
      include: projectInclude
    });

    await this.audit.log({
      userId: actor.id,
      action: "CREATE_PROJECT",
      entityType: "Project",
      entityId: project.id,
      newValue: project,
      context
    });

    return project;
  }

  async update(
    id: number,
    dto: UpdateProjectDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const oldValue = await this.findOne(id, actor);
    await this.ensureCanManageProject(actor, oldValue.departmentId);
    const nextStartDate =
      dto.startDate !== undefined ? dto.startDate : oldValue.startDate;
    const nextEndDate =
      dto.endDate !== undefined ? dto.endDate : oldValue.endDate;
    this.ensureDateRange(nextStartDate, nextEndDate);

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        status: dto.status,
        startDate: dto.startDate ? toDateOnly(dto.startDate) : undefined,
        endDate: dto.endDate ? toDateOnly(dto.endDate) : undefined
      },
      include: projectInclude
    });

    await this.audit.log({
      userId: actor.id,
      action: "UPDATE_PROJECT",
      entityType: "Project",
      entityId: id,
      oldValue,
      newValue: project,
      context
    });

    return project;
  }

  async softDelete(id: number, actor: AuthUser, context?: RequestContext) {
    const oldValue = await this.findOne(id, actor);
    await this.ensureCanManageProject(actor, oldValue.departmentId);
    const activeTasks = await this.prisma.task.count({
      where: {
        projectId: id,
        deletedAt: null,
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] }
      }
    });
    if (activeTasks > 0) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Project has active tasks",
        "VALIDATION_ERROR"
      );
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: { status: ProjectStatus.CANCELLED, deletedAt: new Date() },
      include: projectInclude
    });

    await this.audit.log({
      userId: actor.id,
      action: "DELETE_PROJECT",
      entityType: "Project",
      entityId: id,
      oldValue,
      newValue: project,
      context
    });

    return project;
  }

  private async buildWhere(query: ProjectQueryDto, user: AuthUser) {
    const base: Prisma.ProjectWhereInput = {
      deletedAt: null,
      status: query.status,
      departmentId: query.departmentId,
      managerId: query.managerId,
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: "insensitive" } },
              { name: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    if (this.accessControl.isAdmin(user)) {
      return base;
    }

    return {
      AND: [
        base,
        {
          OR: [
            { managerId: user.employeeId ?? -1 },
            { department: { managerId: user.employeeId ?? -1 } },
            { createdByUserId: user.id },
            { tasks: { some: { deletedAt: null, assigneeId: user.employeeId ?? -1 } } },
            { tasks: { some: { deletedAt: null, team: { leadId: user.employeeId ?? -1 } } } },
            {
              tasks: {
                some: {
                  deletedAt: null,
                  team: {
                    members: {
                      some: { employeeId: user.employeeId ?? -1, isActive: true }
                    }
                  }
                }
              }
            },
            { tasks: { some: { deletedAt: null, createdByUserId: user.id } } }
          ]
        }
      ]
    };
  }

  private async resolveManagedDepartment(actor: AuthUser) {
    if (!actor.employeeId) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        "Only a department head can create a project",
        "DEPARTMENT_MANAGER_REQUIRED"
      );
    }

    const department = await this.prisma.department.findFirst({
      where: {
        managerId: actor.employeeId,
        isActive: true,
        deletedAt: null
      },
      select: { id: true, managerId: true }
    });
    if (!department?.managerId) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        "Only a department head can create a project",
        "DEPARTMENT_MANAGER_REQUIRED"
      );
    }

    return { departmentId: department.id, managerId: department.managerId };
  }

  private async ensureCanManageProject(actor: AuthUser, departmentId: number) {
    if (this.accessControl.isAdmin(actor)) {
      return;
    }

    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, managerId: actor.employeeId ?? -1, deletedAt: null },
      select: { id: true }
    });
    if (!department) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        "Only the department head can manage this project",
        "PROJECT_MANAGER_SCOPE_DENIED"
      );
    }
  }

  private ensureDateRange(
    startDate?: string | Date | null,
    endDate?: string | Date | null
  ) {
    if (startDate && endDate && toDateOnly(startDate) > toDateOnly(endDate)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Start date must be before or equal to end date",
        "VALIDATION_ERROR"
      );
    }
  }

}
