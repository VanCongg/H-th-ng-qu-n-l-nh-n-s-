import { HttpStatus, Injectable } from "@nestjs/common";
import {
  Prisma,
  ProjectStatus,
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
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { AssignTaskDto } from "./dto/assign-task.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { TaskQueryDto } from "./dto/task-query.dto";
import { TaskRequiredSkillDto } from "./dto/task-required-skill.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { UpdateTaskStatusDto } from "./dto/update-task-status.dto";

export const taskInclude = {
  parentTask: {
    select: {
      id: true,
      title: true,
      status: true,
      startDate: true,
      dueDate: true,
      teamId: true
    }
  },
  childTasks: {
    where: { deletedAt: null },
    select: {
      id: true,
      parentTaskId: true,
      projectId: true,
      departmentId: true,
      teamId: true,
      title: true,
      description: true,
      technologies: true,
      status: true,
      priority: true,
      assigneeId: true,
      createdByUserId: true,
      assignedByUserId: true,
      startDate: true,
      dueDate: true,
      estimatedHours: true,
      actualHours: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      assignee: { include: { department: true, position: true } },
      requiredSkills: { include: { skill: true } },
      _count: { select: { assignments: true, aiTaskSuggestions: true, childTasks: true } }
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }]
  },
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
  _count: { select: { assignments: true, aiTaskSuggestions: true, childTasks: true } }
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accessControl: AccessControlService,
    private readonly notifications: NotificationsService
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
    const scope = await this.resolveCreateTaskScope(dto, actor);
    this.ensureLevelSpecificFields(
      Boolean(scope.parentTaskId),
      dto.technologies,
      dto.requiredSkills,
      dto.actualHours
    );
    await this.ensureRequiredSkills(dto.requiredSkills);
    this.ensureDateRange(dto.startDate, dto.dueDate);
    this.ensureChildDateRange(scope.parentTask, dto.startDate, dto.dueDate);

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          parentTaskId: scope.parentTaskId,
          projectId: scope.projectId,
          departmentId: scope.departmentId,
          teamId: scope.teamId,
          title: dto.title,
          description: dto.description,
          technologies: scope.parentTaskId
            ? []
            : this.normalizeTechnologies(dto.technologies),
          priority: dto.priority ?? TaskPriority.MEDIUM,
          status: scope.parentTaskId ? (dto.status ?? TaskStatus.TODO) : TaskStatus.TODO,
          assigneeId: dto.assigneeId,
          createdByUserId: actor.id,
          assignedByUserId: dto.assigneeId ? actor.id : undefined,
          startDate: dto.startDate ? toDateOnly(dto.startDate) : undefined,
          dueDate: dto.dueDate ? toDateOnly(dto.dueDate) : undefined,
          estimatedHours: dto.estimatedHours,
          actualHours: scope.parentTaskId ? dto.actualHours : undefined,
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

    if (task.parentTaskId) {
      await this.syncParentStatus(task.parentTaskId);
    }

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
    const nextStartDate =
      dto.startDate !== undefined ? dto.startDate : oldValue.startDate;
    const nextDueDate = dto.dueDate !== undefined ? dto.dueDate : oldValue.dueDate;
    const assigneeChanged =
      dto.assigneeId !== undefined && dto.assigneeId !== oldValue.assigneeId;
    this.ensureLevelSpecificFields(
      Boolean(oldValue.parentTaskId),
      dto.technologies,
      dto.requiredSkills,
      dto.actualHours
    );
    if (!oldValue.parentTaskId && dto.assigneeId !== undefined) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "A team-level task cannot be assigned to an employee",
        "ROOT_TASK_CANNOT_BE_ASSIGNED"
      );
    }
    if (
      !oldValue.parentTaskId &&
      dto.status !== undefined &&
      dto.status !== oldValue.status
    ) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Team-level task status is calculated from its subtasks",
        "ROOT_TASK_STATUS_IS_DERIVED"
      );
    }
    if (dto.assigneeId) {
      await this.ensureAssigneeInTaskTeam(oldValue.teamId, dto.assigneeId);
    }
    await this.ensureRequiredSkills(dto.requiredSkills);
    this.ensureDateRange(nextStartDate, nextDueDate);
    this.ensureChildDateRange(oldValue.parentTask, nextStartDate, nextDueDate);

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

      const updated = await tx.task.update({
        where: { id },
        data: {
          assigneeId: dto.assigneeId,
          assignedByUserId: dto.assigneeId ? actor.id : undefined,
          title: dto.title,
          description: dto.description,
          technologies:
            dto.technologies !== undefined
              ? this.normalizeTechnologies(dto.technologies)
              : undefined,
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

      if (assigneeChanged && dto.assigneeId) {
        await tx.taskAssignment.create({
          data: {
            taskId: id,
            assigneeId: dto.assigneeId,
            assignedByUserId: actor.id,
            assignmentType: oldValue.assigneeId
              ? TaskAssignmentType.REASSIGNED
              : TaskAssignmentType.MANUAL,
            note: "Assigned during task update"
          }
        });
      }

      return updated;
    });

    if (task.parentTaskId) {
      await this.syncParentStatus(task.parentTaskId);
    }

    await this.audit.log({
      userId: actor.id,
      action: "UPDATE_TASK",
      entityType: "Task",
      entityId: id,
      oldValue,
      newValue: task,
      context
    });
    if (assigneeChanged && dto.assigneeId) {
      await this.audit.log({
        userId: actor.id,
        action: oldValue.assigneeId ? "REASSIGN_TASK" : "ASSIGN_TASK",
        entityType: "Task",
        entityId: id,
        oldValue: { assigneeId: oldValue.assigneeId },
        newValue: {
          assigneeId: dto.assigneeId,
          assignmentType: oldValue.assigneeId
            ? TaskAssignmentType.REASSIGNED
            : TaskAssignmentType.MANUAL
        },
        context
      });
    }

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

    if (task.assignee?.userId) {
      await this.notifications.create(
        task.assignee.userId,
        "TASK_ASSIGNED",
        "New task assigned",
        `You were assigned to "${task.title}".`,
        "Task",
        task.id
      );
    }

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
    if (!oldValue.parentTaskId) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Team-level task status is calculated from its subtasks",
        "ROOT_TASK_STATUS_IS_DERIVED"
      );
    }
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

    await this.syncParentStatus(oldValue.parentTaskId);

    return task;
  }

  async softDelete(id: number, actor: AuthUser, context?: RequestContext) {
    const oldValue = await this.findOne(id, actor);
    await this.accessControl.ensureCanUpdateTask(actor, id);
    if (!oldValue.parentTaskId) {
      const activeChildren = await this.prisma.task.count({
        where: {
          parentTaskId: id,
          deletedAt: null,
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] }
        }
      });
      if (activeChildren) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          "Team-level task has active subtasks",
          "TASK_HAS_ACTIVE_SUBTASKS"
        );
      }
    }
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

    if (oldValue.parentTaskId) {
      await this.syncParentStatus(oldValue.parentTaskId);
    }

    return task;
  }

  private async paginatedList(where: Prisma.TaskWhereInput, query: TaskQueryDto) {
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: [{ parentTaskId: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
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
      parentTaskId: query.parentTaskId,
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
              { teamId: { in: managedTeamIds.length ? managedTeamIds : [-1] } },
              { project: { department: { managerId: user.employeeId ?? -1 } } }
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
            { project: { department: { managerId: user.employeeId ?? -1 } } },
            { teamId: { in: managedTeamIds } }
          ]
        }
      ]
    };
  }

  private async resolveCreateTaskScope(dto: CreateTaskDto, actor: AuthUser) {
    if (dto.parentTaskId) {
      const parentTask = await this.prisma.task.findFirst({
        where: { id: dto.parentTaskId, deletedAt: null },
        select: {
          id: true,
          parentTaskId: true,
          projectId: true,
          departmentId: true,
          teamId: true,
          status: true,
          startDate: true,
          dueDate: true
        }
      });
      if (!parentTask) {
        throw new ApiError(HttpStatus.NOT_FOUND, "Parent task not found", "PARENT_TASK_NOT_FOUND");
      }
      if (parentTask.parentTaskId) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          "Only two task levels are supported",
          "TASK_HIERARCHY_DEPTH_EXCEEDED"
        );
      }
      if (
        parentTask.status === TaskStatus.DONE ||
        parentTask.status === TaskStatus.CANCELLED ||
        !parentTask.projectId ||
        !parentTask.departmentId ||
        !parentTask.teamId
      ) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          "Parent task is closed or has an invalid scope",
          "PARENT_TASK_NOT_AVAILABLE"
        );
      }
      if (dto.projectId && dto.projectId !== parentTask.projectId) {
        throw new ApiError(HttpStatus.BAD_REQUEST, "Subtask project must match its parent", "VALIDATION_ERROR");
      }
      if (dto.teamId && dto.teamId !== parentTask.teamId) {
        throw new ApiError(HttpStatus.BAD_REQUEST, "Subtask team must match its parent", "VALIDATION_ERROR");
      }
      await this.ensureCanCreateSubtask(actor, parentTask.departmentId, parentTask.teamId);
      if (dto.assigneeId) {
        await this.ensureAssigneeInTaskTeam(parentTask.teamId, dto.assigneeId);
      }
      return {
        parentTaskId: parentTask.id,
        projectId: parentTask.projectId,
        departmentId: parentTask.departmentId,
        teamId: parentTask.teamId,
        parentTask
      };
    }

    if (!dto.projectId || !dto.teamId) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "A team-level task requires a project and a team",
        "ROOT_TASK_SCOPE_REQUIRED"
      );
    }
    if (dto.assigneeId) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "A team-level task cannot be assigned to an employee",
        "ROOT_TASK_CANNOT_BE_ASSIGNED"
      );
    }

    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, deletedAt: null },
      select: { id: true, departmentId: true, status: true }
    });
    if (!project) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Project not found", "PROJECT_NOT_FOUND");
    }
    if (project.status === ProjectStatus.COMPLETED || project.status === ProjectStatus.CANCELLED) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Project is closed", "PROJECT_CLOSED");
    }

    const team = await this.prisma.team.findFirst({
      where: { id: dto.teamId, deletedAt: null, isActive: true },
      select: { id: true, departmentId: true }
    });
    if (!team) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Team not found", "TEAM_NOT_FOUND");
    }
    if (team.departmentId !== project.departmentId) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Task team must belong to the project department",
        "VALIDATION_ERROR"
      );
    }
    if (
      !this.accessControl.isAdmin(actor) &&
      !(await this.accessControl.isDepartmentHead(actor, project.departmentId))
    ) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        "Only the department head can assign a team-level task",
        "DEPARTMENT_MANAGER_REQUIRED"
      );
    }

    return {
      parentTaskId: undefined,
      projectId: project.id,
      departmentId: project.departmentId,
      teamId: team.id,
      parentTask: null
    };
  }

  private async ensureCanCreateSubtask(
    actor: AuthUser,
    departmentId: number,
    teamId: number
  ) {
    if (
      this.accessControl.isAdmin(actor) ||
      (await this.accessControl.isDepartmentHead(actor, departmentId)) ||
      (await this.accessControl.isTeamLead(actor, teamId))
    ) {
      return;
    }
    throw new ApiError(
      HttpStatus.FORBIDDEN,
      "Only the department head or team lead can create a subtask",
      "TASK_ASSIGNMENT_DENIED"
    );
  }

  private ensureChildDateRange(
    parentTask: { startDate: Date | null; dueDate: Date | null } | null,
    startDate?: string | Date | null,
    dueDate?: string | Date | null
  ) {
    if (!parentTask) {
      return;
    }
    if (
      parentTask.startDate &&
      startDate &&
      toDateOnly(startDate) < toDateOnly(parentTask.startDate)
    ) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Subtask start date cannot be before its parent task",
        "SUBTASK_DATE_OUTSIDE_PARENT"
      );
    }
    if (
      parentTask.dueDate &&
      dueDate &&
      toDateOnly(dueDate) > toDateOnly(parentTask.dueDate)
    ) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Subtask due date cannot be after its parent task",
        "SUBTASK_DATE_OUTSIDE_PARENT"
      );
    }
  }

  private async syncParentStatus(parentTaskId: number) {
    const children = await this.prisma.task.findMany({
      where: { parentTaskId, deletedAt: null },
      select: { status: true, actualHours: true }
    });
    const nonCancelled = children.filter((child) => child.status !== TaskStatus.CANCELLED);
    let status: TaskStatus;
    if (!nonCancelled.length) {
      status = TaskStatus.TODO;
    } else if (nonCancelled.every((child) => child.status === TaskStatus.DONE)) {
      status = TaskStatus.DONE;
    } else if (
      nonCancelled.some((child) =>
        child.status === TaskStatus.IN_PROGRESS ||
        child.status === TaskStatus.IN_REVIEW ||
        child.status === TaskStatus.DONE
      )
    ) {
      status = TaskStatus.IN_PROGRESS;
    } else {
      status = TaskStatus.TODO;
    }

    await this.prisma.task.update({
      where: { id: parentTaskId },
      data: {
        status,
        actualHours: children.reduce(
          (total, child) => total + Number(child.actualHours ?? 0),
          0
        ),
        completedAt: status === TaskStatus.DONE ? new Date() : null
      }
    });
  }

  private ensureLevelSpecificFields(
    isSubtask: boolean,
    technologies?: string[],
    requiredSkills?: TaskRequiredSkillDto[],
    actualHours?: number
  ) {
    if (isSubtask && technologies?.some((technology) => technology.trim())) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Technologies are defined on the team-level task",
        "SUBTASK_TECHNOLOGIES_NOT_ALLOWED"
      );
    }
    if (!isSubtask && requiredSkills?.length) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Required skills are only defined on subtasks",
        "ROOT_TASK_SKILLS_NOT_ALLOWED"
      );
    }
    if (!isSubtask && actualHours !== undefined) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Team-level actual hours are calculated from subtasks",
        "ROOT_TASK_ACTUAL_HOURS_IS_DERIVED"
      );
    }
  }

  private normalizeTechnologies(technologies?: string[]) {
    const values = (technologies ?? []).map((technology) => technology.trim()).filter(Boolean);
    return values.filter(
      (technology, index) =>
        values.findIndex(
          (candidate) => candidate.toLocaleLowerCase() === technology.toLocaleLowerCase()
        ) === index
    );
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

  private ensureDateRange(
    startDate?: string | Date | null,
    dueDate?: string | Date | null
  ) {
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
        importance: item.importance
      }))
    };
  }

  private requiredSkillsData(taskId: number, requiredSkills: TaskRequiredSkillDto[]) {
    return requiredSkills.map((item) => ({
      taskId,
      skillId: item.skillId,
      requiredProficiency: item.requiredProficiency,
      importance: item.importance
    }));
  }
}
