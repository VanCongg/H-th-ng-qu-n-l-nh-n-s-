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

const OPEN_TASK_STATUSES: TaskStatus[] = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW];
const CLOSED_PROJECT_STATUSES: ProjectStatus[] = [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED];

/** A date field on update: omitted keeps it, `null` clears it, a string sets it. */
function dateUpdate(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }
  return value ? toDateOnly(value) : null;
}

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
    await this.ensureCodeAvailable(dto.code);

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
    if (dto.code !== undefined && dto.code !== oldValue.code) {
      await this.ensureCodeAvailable(dto.code, id);
    }
    if (dto.status && dto.status !== oldValue.status && CLOSED_PROJECT_STATUSES.includes(dto.status)) {
      await this.ensureNoOpenTasks(id, "Finish or cancel the open tasks before closing the project");
    }
    if (dto.startDate !== undefined || dto.endDate !== undefined) {
      await this.ensureTasksInside(id, nextStartDate, nextEndDate);
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        status: dto.status,
        startDate: dateUpdate(dto.startDate),
        endDate: dateUpdate(dto.endDate)
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
    await this.ensureNoOpenTasks(id, "Project has active tasks");

    const deletedAt = new Date();
    const project = await this.prisma.$transaction(async (tx) => {
      // Only finished or cancelled tasks are left; they go with the project.
      await tx.task.updateMany({ where: { projectId: id, deletedAt: null }, data: { deletedAt } });
      return tx.project.update({
        where: { id },
        data: { status: ProjectStatus.CANCELLED, deletedAt },
        include: projectInclude
      });
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

  /** Codes are unique among live projects; a deleted project's code is free again. */
  private async ensureCodeAvailable(code: string, exceptId?: number) {
    const taken = await this.prisma.project.findFirst({
      where: { code, deletedAt: null, id: exceptId ? { not: exceptId } : undefined },
      select: { id: true }
    });
    if (taken) {
      throw new ApiError(HttpStatus.CONFLICT, "Project code already exists", "PROJECT_CODE_EXISTS");
    }
  }

  private async ensureNoOpenTasks(projectId: number, message: string) {
    const openTasks = await this.prisma.task.count({
      where: { projectId, deletedAt: null, status: { in: OPEN_TASK_STATUSES } }
    });
    if (openTasks > 0) {
      throw new ApiError(HttpStatus.BAD_REQUEST, message, "PROJECT_HAS_OPEN_TASKS");
    }
  }

  /** New project dates must still hold its team-level tasks (subtasks sit inside those). */
  private async ensureTasksInside(
    projectId: number,
    startDate?: string | Date | null,
    endDate?: string | Date | null
  ) {
    if (!startDate && !endDate) {
      return;
    }
    const outside = await this.prisma.task.count({
      where: {
        projectId,
        parentTaskId: null,
        deletedAt: null,
        OR: [
          ...(startDate ? [{ startDate: { lt: toDateOnly(startDate) } }] : []),
          ...(endDate ? [{ dueDate: { gt: toDateOnly(endDate) } }] : [])
        ]
      }
    });
    if (outside > 0) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Some tasks fall outside the new project dates",
        "TASK_DATE_OUTSIDE_PROJECT"
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
