import { HttpStatus, Injectable } from "@nestjs/common";
import {
  Prisma,
  TaskAssignmentType,
  TaskPriority,
  TaskStatus
} from "@prisma/client";
import { ApiError } from "../common/api-error";
import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { AuthUser, RequestContext } from "../common/types";
import { currentEmployeeWhere } from "../common/prisma-where";
import { pagination, toDateOnly } from "../common/utils";
import { PrismaService } from "../prisma/prisma.service";
import { AssignTaskDto } from "./dto/assign-task.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { TaskQueryDto } from "./dto/task-query.dto";
import { TaskRequiredSkillDto } from "./dto/task-required-skill.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { UpdateTaskStatusDto } from "./dto/update-task-status.dto";

export const taskInclude = {
  project: true,
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
  assignee: { include: { department: true, position: true } },
  createdByUser: { select: { id: true, username: true, email: true } },
  assignedByUser: { select: { id: true, username: true, email: true } },
  requiredSkills: { include: { skill: true } },
  _count: { select: { assignments: true, aiTaskSuggestions: true } }
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accessControl: AccessControlService
  ) {}

  async findAll(query: TaskQueryDto, user: AuthUser) {
    const where = await this.buildWhere(query, user, "all");
    return this.paginatedList(where, query);
  }

  async findTeam(query: TaskQueryDto, user: AuthUser) {
    const where = await this.buildWhere(query, user, "team");
    return this.paginatedList(where, query);
  }

  async findSelf(query: TaskQueryDto, user: AuthUser) {
    if (!user.employeeId) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Employee not found", "EMPLOYEE_NOT_FOUND");
    }
    const where = await this.buildWhere(query, user, "self");
    return this.paginatedList(where, query);
  }

  async findOne(id: number, user: AuthUser) {
    await this.accessControl.ensureCanReadTask(user, id);
    const task = await this.prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: taskInclude
    });
    if (!task) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Task not found", "TASK_NOT_FOUND");
    }
    return task;
  }

  async create(dto: CreateTaskDto, actor: AuthUser, context?: RequestContext) {
    const scope = await this.resolveTaskScope(
      dto.projectId,
      dto.departmentId,
      dto.teamId,
      dto.assigneeId
    );
    await this.ensureRequiredSkills(dto.requiredSkills);
    this.ensureDateRange(dto.startDate, dto.dueDate);
    if (dto.assigneeId) {
      await this.accessControl.ensureCanAssignToEmployee(actor, dto.assigneeId);
    }
    if (dto.projectId) {
      await this.accessControl.ensureCanReadProject(actor, dto.projectId);
    }

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          projectId: dto.projectId,
          departmentId: scope.departmentId,
          teamId: scope.teamId,
          title: dto.title,
          description: dto.description,
          priority: dto.priority ?? TaskPriority.MEDIUM,
          status: dto.status ?? TaskStatus.TODO,
          assigneeId: dto.assigneeId,
          createdByUserId: actor.id,
          assignedByUserId: dto.assigneeId ? actor.id : undefined,
          startDate: dto.startDate ? toDateOnly(dto.startDate) : undefined,
          dueDate: dto.dueDate ? toDateOnly(dto.dueDate) : undefined,
          estimatedHours: dto.estimatedHours,
          actualHours: dto.actualHours,
          completedAt: dto.status === TaskStatus.DONE ? new Date() : undefined,
          requiredSkills: this.requiredSkillsCreate(dto.requiredSkills)
        },
        include: taskInclude
      });

      if (dto.assigneeId) {
        await tx.taskAssignment.create({
          data: {
            taskId: created.id,
            assigneeId: dto.assigneeId,
            assignedByUserId: actor.id,
            assignmentType: TaskAssignmentType.MANUAL,
            note: "Assigned during task creation"
          }
        });
      }

      return created;
    });

    await this.audit.log({
      userId: actor.id,
      action: "CREATE_TASK",
      entityType: "Task",
      entityId: task.id,
      newValue: task,
      context
    });
    if (dto.assigneeId) {
      await this.audit.log({
        userId: actor.id,
        action: "ASSIGN_TASK",
        entityType: "Task",
        entityId: task.id,
        newValue: { assigneeId: dto.assigneeId, assignmentType: "MANUAL" },
        context
      });
    }

    return task;
  }

  async update(
    id: number,
    dto: UpdateTaskDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const oldValue = await this.findOne(id, actor);
    await this.accessControl.ensureCanUpdateTask(actor, id);
    const scope = await this.resolveTaskScope(
      dto.projectId ?? oldValue.projectId ?? undefined,
      dto.departmentId ?? oldValue.departmentId ?? undefined,
      dto.teamId ?? oldValue.teamId ?? undefined,
      dto.assigneeId ?? oldValue.assigneeId ?? undefined
    );
    if (dto.assigneeId) {
      await this.accessControl.ensureCanAssignToEmployee(actor, dto.assigneeId);
    }
    await this.ensureRequiredSkills(dto.requiredSkills);
    this.ensureDateRange(dto.startDate, dto.dueDate);

    const task = await this.prisma.$transaction(async (tx) => {
      if (dto.requiredSkills) {
        await tx.taskRequiredSkill.deleteMany({ where: { taskId: id } });
        if (dto.requiredSkills.length) {
          await tx.taskRequiredSkill.createMany({
            data: this.requiredSkillsData(id, dto.requiredSkills),
            skipDuplicates: true
          });
        }
      }

      return tx.task.update({
        where: { id },
        data: {
          projectId: dto.projectId,
          departmentId:
            dto.departmentId !== undefined || dto.teamId !== undefined || dto.projectId !== undefined
              ? scope.departmentId
              : undefined,
          teamId: dto.teamId !== undefined || dto.projectId !== undefined ? scope.teamId : undefined,
          assigneeId: dto.assigneeId,
          assignedByUserId: dto.assigneeId ? actor.id : undefined,
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          status: dto.status,
          startDate: dto.startDate ? toDateOnly(dto.startDate) : undefined,
          dueDate: dto.dueDate ? toDateOnly(dto.dueDate) : undefined,
          estimatedHours: dto.estimatedHours,
          actualHours: dto.actualHours,
          completedAt: dto.status === TaskStatus.DONE ? new Date() : undefined
        },
        include: taskInclude
      });
    });

    await this.audit.log({
      userId: actor.id,
      action: "UPDATE_TASK",
      entityType: "Task",
      entityId: id,
      oldValue,
      newValue: task,
      context
    });

    return task;
  }

  async assign(
    id: number,
    dto: AssignTaskDto,
    actor: AuthUser,
    context?: RequestContext,
    assignmentType = TaskAssignmentType.MANUAL
  ) {
    const oldValue = await this.findOne(id, actor);
    await this.accessControl.ensureCanAssignTask(actor, id, dto.assigneeId);
    await this.ensureAssigneeInTaskTeam(oldValue.teamId, dto.assigneeId);
    const task = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: {
          assigneeId: dto.assigneeId,
          assignedByUserId: actor.id
        },
        include: taskInclude
      });

      await tx.taskAssignment.create({
        data: {
          taskId: id,
          assigneeId: dto.assigneeId,
          assignedByUserId: actor.id,
          assignmentType:
            oldValue.assigneeId && oldValue.assigneeId !== dto.assigneeId
              ? TaskAssignmentType.REASSIGNED
              : assignmentType,
          note: dto.note
        }
      });

      return updated;
    });

    await this.audit.log({
      userId: actor.id,
      action: oldValue.assigneeId ? "REASSIGN_TASK" : "ASSIGN_TASK",
      entityType: "Task",
      entityId: id,
      oldValue: { assigneeId: oldValue.assigneeId },
      newValue: { assigneeId: dto.assigneeId, assignmentType },
      context
    });

    return task;
  }

  async updateStatus(
    id: number,
    dto: UpdateTaskStatusDto,
    actor: AuthUser,
    context?: RequestContext
  ) {
    const oldValue = await this.findOne(id, actor);
    await this.accessControl.ensureCanUpdateTaskStatus(actor, id);
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        status: dto.status,
        completedAt: dto.status === TaskStatus.DONE ? new Date() : null
      },
      include: taskInclude
    });

    await this.audit.log({
      userId: actor.id,
      action: "UPDATE_TASK_STATUS",
      entityType: "Task",
      entityId: id,
      oldValue: { status: oldValue.status },
      newValue: { status: task.status, note: dto.note },
      context
    });

    return task;
  }

  async softDelete(id: number, actor: AuthUser, context?: RequestContext) {
    const oldValue = await this.findOne(id, actor);
    await this.accessControl.ensureCanUpdateTask(actor, id);
    const task = await this.prisma.task.update({
      where: { id },
      data: { status: TaskStatus.CANCELLED, deletedAt: new Date() },
      include: taskInclude
    });

    await this.audit.log({
      userId: actor.id,
      action: "DELETE_TASK",
      entityType: "Task",
      entityId: id,
      oldValue,
      newValue: task,
      context
    });

    return task;
  }

  private async paginatedList(where: Prisma.TaskWhereInput, query: TaskQueryDto) {
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        skip,
        take
      }),
      this.prisma.task.count({ where })
    ]);

    return { items, meta: { total, page, limit } };
  }

  private async buildWhere(query: TaskQueryDto, user: AuthUser, scope: "all" | "team" | "self") {
    const base: Prisma.TaskWhereInput = {
      deletedAt: null,
      projectId: query.projectId,
      departmentId: query.departmentId,
      teamId: query.teamId,
      assigneeId: query.assigneeId,
      status: query.status,
      priority: query.priority,
      dueDate:
        query.fromDate || query.toDate
          ? {
              gte: query.fromDate ? toDateOnly(query.fromDate) : undefined,
              lte: query.toDate ? toDateOnly(query.toDate) : undefined
            }
          : undefined,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    if (scope === "self") {
      return { AND: [base, { assigneeId: user.employeeId ?? -1 }] };
    }

    if (this.accessControl.isAdmin(user) && scope === "all") {
      return base;
    }

    if (scope === "team" && !user.employeeId) {
      return { AND: [base, { id: -1 }] };
    }

    const teamIds = await this.accessControl.teamEmployeeIds(user);
    const managedTeamIds = await this.accessControl.managedTeamIds(user);
    if (scope === "team") {
      return {
        AND: [
          base,
          {
            OR: [
              { assigneeId: { in: teamIds.length ? teamIds : [-1] } },
              { teamId: { in: managedTeamIds.length ? managedTeamIds : [-1] } }
            ]
          }
        ]
      };
    }

    return {
      AND: [
        base,
        {
          OR: [
            { assigneeId: { in: teamIds } },
            { createdByUserId: user.id },
            { project: { managerId: user.employeeId ?? -1 } },
            { teamId: { in: managedTeamIds } }
          ]
        }
      ]
    };
  }

  private async resolveTaskScope(
    projectId?: number | null,
    departmentId?: number | null,
    teamId?: number | null,
    assigneeId?: number | null
  ) {
    let resolvedDepartmentId = departmentId ?? undefined;
    let resolvedTeamId = teamId ?? undefined;

    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, deletedAt: null },
        select: { id: true, departmentId: true, teamId: true }
      });
      if (!project) {
        throw new ApiError(HttpStatus.NOT_FOUND, "Project not found", "PROJECT_NOT_FOUND");
      }
      if (project.departmentId) {
        if (resolvedDepartmentId && resolvedDepartmentId !== project.departmentId) {
          throw new ApiError(
            HttpStatus.BAD_REQUEST,
            "Task department must match selected project",
            "VALIDATION_ERROR"
          );
        }
        resolvedDepartmentId = project.departmentId;
      }
      if (project.teamId) {
        if (resolvedTeamId && resolvedTeamId !== project.teamId) {
          throw new ApiError(
            HttpStatus.BAD_REQUEST,
            "Task team must match selected project",
            "VALIDATION_ERROR"
          );
        }
        resolvedTeamId = project.teamId;
      }
    }

    if (resolvedTeamId) {
      const team = await this.prisma.team.findFirst({
        where: { id: resolvedTeamId, deletedAt: null, isActive: true },
        select: { id: true, departmentId: true }
      });
      if (!team) {
        throw new ApiError(HttpStatus.NOT_FOUND, "Team not found", "TEAM_NOT_FOUND");
      }
      if (resolvedDepartmentId && resolvedDepartmentId !== team.departmentId) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          "Task team must belong to selected department",
          "VALIDATION_ERROR"
        );
      }
      resolvedDepartmentId = team.departmentId;
    }

    if (resolvedDepartmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: resolvedDepartmentId, deletedAt: null },
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

    if (assigneeId && resolvedTeamId) {
      await this.ensureAssigneeInTaskTeam(resolvedTeamId, assigneeId);
    }

    return { departmentId: resolvedDepartmentId, teamId: resolvedTeamId };
  }

  private async ensureAssigneeInTaskTeam(teamId: number | null | undefined, assigneeId: number) {
    if (!teamId) {
      return;
    }

    const membership = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        employeeId: assigneeId,
        isActive: true,
        employee: currentEmployeeWhere({ status: "ACTIVE" })
      },
      select: { id: true }
    });
    if (!membership) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Task assignee must belong to selected team",
        "VALIDATION_ERROR"
      );
    }
  }

  private async ensureRequiredSkills(requiredSkills?: TaskRequiredSkillDto[]) {
    if (!requiredSkills?.length) {
      return;
    }

    const skillIds = Array.from(new Set(requiredSkills.map((item) => item.skillId)));
    if (skillIds.length !== requiredSkills.length) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Task required skills must be unique",
        "TASK_REQUIRED_SKILL_INVALID"
      );
    }

    const skills = await this.prisma.skill.findMany({
      where: { id: { in: skillIds }, isActive: true },
      select: { id: true }
    });
    if (skills.length !== skillIds.length) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Skill not found", "SKILL_NOT_FOUND");
    }
  }

  private ensureDateRange(startDate?: string, dueDate?: string) {
    if (startDate && dueDate && toDateOnly(startDate) > toDateOnly(dueDate)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Start date must be before or equal to due date",
        "VALIDATION_ERROR"
      );
    }
  }

  private requiredSkillsCreate(requiredSkills?: TaskRequiredSkillDto[]) {
    if (!requiredSkills?.length) {
      return undefined;
    }

    return {
      create: requiredSkills.map((item) => ({
        skillId: item.skillId,
        requiredProficiency: item.requiredProficiency,
        weight: item.weight ?? 1,
        isRequired: item.isRequired ?? true
      }))
    };
  }

  private requiredSkillsData(taskId: number, requiredSkills: TaskRequiredSkillDto[]) {
    return requiredSkills.map((item) => ({
      taskId,
      skillId: item.skillId,
      requiredProficiency: item.requiredProficiency,
      weight: item.weight ?? 1,
      isRequired: item.isRequired ?? true
    }));
  }
}
