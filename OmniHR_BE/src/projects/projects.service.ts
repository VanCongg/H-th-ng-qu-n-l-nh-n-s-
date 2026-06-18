import { HttpStatus, Injectable } from "@nestjs/common";
import { ProjectStatus, TaskStatus, Prisma } from "@prisma/client";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/services/audit.service";
import { AccessControlService } from "../common/services/access-control.service";
import { AuthUser, RequestContext } from "../common/types";
import { currentEmployeeWhere } from "../common/prisma-where";
import { pagination, toDateOnly } from "../common/utils";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ProjectQueryDto } from "./dto/project-query.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

const projectInclude = {
  department: true,
  team: {
    include: {
      department: true,
      lead: { include: { department: true, position: true } },
      members: {
        where: { isActive: true },
        include: { employee: { include: { department: true, position: true } } }
      }
    }
  },
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
    const managerId = this.defaultProjectManagerId(dto.managerId, actor);
    const scope = await this.resolveProjectScope(dto.departmentId, dto.teamId, managerId);
    await this.ensureCanUseProjectManager(actor, managerId);
    this.ensureDateRange(dto.startDate, dto.endDate);

    const project = await this.prisma.project.create({
      data: {
        departmentId: scope.departmentId,
        teamId: scope.teamId,
        managerId,
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
    const scope = await this.resolveProjectScope(
      dto.departmentId ?? oldValue.departmentId ?? undefined,
      dto.teamId ?? oldValue.teamId ?? undefined,
      dto.managerId ?? oldValue.managerId ?? undefined
    );
    if (dto.managerId !== undefined) {
      await this.ensureCanUseProjectManager(actor, dto.managerId);
    }
    this.ensureDateRange(dto.startDate, dto.endDate);

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        departmentId: dto.departmentId !== undefined || dto.teamId !== undefined ? scope.departmentId : undefined,
        teamId: dto.teamId,
        managerId: dto.managerId,
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
      teamId: query.teamId,
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

    const teamIds = await this.accessControl.teamEmployeeIds(user);
    return {
      AND: [
        base,
        {
          OR: [
            { managerId: user.employeeId ?? -1 },
            { createdByUserId: user.id },
            { team: { leadId: user.employeeId ?? -1 } },
            {
              team: {
                members: {
                  some: { employeeId: user.employeeId ?? -1, isActive: true }
                }
              }
            },
            { tasks: { some: { deletedAt: null, assigneeId: { in: teamIds } } } },
            { tasks: { some: { deletedAt: null, createdByUserId: user.id } } }
          ]
        }
      ]
    };
  }

  private async resolveProjectScope(
    departmentId?: number | null,
    teamId?: number | null,
    managerId?: number | null
  ) {
    let resolvedDepartmentId = departmentId ?? undefined;

    if (teamId) {
      const team = await this.prisma.team.findFirst({
        where: { id: teamId, deletedAt: null, isActive: true },
        include: { members: { where: { isActive: true }, select: { employeeId: true } } }
      });
      if (!team) {
        throw new ApiError(HttpStatus.NOT_FOUND, "Team not found", "TEAM_NOT_FOUND");
      }
      if (resolvedDepartmentId && resolvedDepartmentId !== team.departmentId) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          "Team must belong to selected department",
          "VALIDATION_ERROR"
        );
      }
      resolvedDepartmentId = team.departmentId;

      if (
        managerId &&
        team.leadId !== managerId &&
        !team.members.some((member) => member.employeeId === managerId)
      ) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          "Project manager must belong to selected team",
          "VALIDATION_ERROR"
        );
      }
    }

    await this.ensureReferences(resolvedDepartmentId, managerId);
    return { departmentId: resolvedDepartmentId, teamId: teamId ?? undefined };
  }

  private async ensureReferences(departmentId?: number, managerId?: number | null) {
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

    if (managerId) {
      const manager = await this.prisma.employee.findFirst({
        where: currentEmployeeWhere({ id: managerId }),
        select: { id: true }
      });
      if (!manager) {
        throw new ApiError(
          HttpStatus.NOT_FOUND,
          "Employee not found",
          "EMPLOYEE_NOT_FOUND"
        );
      }
    }
  }

  private ensureDateRange(startDate?: string, endDate?: string) {
    if (startDate && endDate && toDateOnly(startDate) > toDateOnly(endDate)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Start date must be before or equal to end date",
        "VALIDATION_ERROR"
      );
    }
  }

  private defaultProjectManagerId(managerId: number | undefined, actor: AuthUser) {
    if (this.accessControl.isAdmin(actor)) {
      return managerId;
    }

    return managerId ?? actor.employeeId ?? undefined;
  }

  private async ensureCanUseProjectManager(actor: AuthUser, managerId?: number) {
    if (this.accessControl.isAdmin(actor)) {
      return;
    }

    if (!this.accessControl.isManager(actor) || !actor.employeeId || !managerId) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        "Project manager scope denied",
        "PROJECT_MANAGER_SCOPE_DENIED"
      );
    }

    if (managerId === actor.employeeId) {
      return;
    }

    if (await this.accessControl.isSubordinate(actor, managerId)) {
      return;
    }

    throw new ApiError(
      HttpStatus.FORBIDDEN,
      "Project manager is outside manager scope",
      "PROJECT_MANAGER_SCOPE_DENIED"
    );
  }
}
