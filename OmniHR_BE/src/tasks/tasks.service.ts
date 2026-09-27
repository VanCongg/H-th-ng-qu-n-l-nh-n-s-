import { HttpStatus, Injectable } from "@nestjs/common";
import {
  CareerLevel,
  Prisma,
  ProjectStatus,
  TaskAssignmentType,
  TaskPriority,
  TaskStatus
} from "@prisma/client";
import { CAREER_LEVELS } from "../ai-task-suggestions/suggestion-scoring";
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
import { TASK_QUICK_FILTERS, TaskQueryDto, TaskQuickFilter } from "./dto/task-query.dto";
import { TaskRequiredSkillDto } from "./dto/task-required-skill.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { UpdateTaskStatusDto } from "./dto/update-task-status.dto";
import { allowedTaskStatuses, canMoveTaskStatus, completedAtFor } from "./task-status-rules";

/** Not finished yet: what a manager still has to follow up on. */
const OPEN_TASK_STATUSES = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW
];

const CLOSED_TASK_STATUSES: TaskStatus[] = [TaskStatus.DONE, TaskStatus.CANCELLED];

type TeamTaskSortKey = {
  id: number;
  status: TaskStatus;
  dueDate: Date | null;
  createdAt: Date;
  projectId: number | null;
  project: { code: string } | null;
};

/**
 * The team board's order: a project's team tasks stay together so a project is
 * never split across pages, projects with unfinished work come first - the
 * one due soonest leading - and a finished project goes to the back. Inside a
 * project, unfinished before finished, then by due date.
 */
export function orderTeamTasksByProject<T extends TeamTaskSortKey>(roots: T[]): T[] {
  const isOpen = (root: T) => OPEN_TASK_STATUSES.includes(root.status as (typeof OPEN_TASK_STATUSES)[number]);
  const time = (date: Date | null) => (date ? date.getTime() : Number.POSITIVE_INFINITY);
  const projects = new Map<number | null, T[]>();
  roots.forEach((root) => projects.set(root.projectId, [...(projects.get(root.projectId) ?? []), root]));

  const projectRank = (items: T[]) => {
    const open = items.filter(isOpen);
    return {
      open: open.length ? 0 : 1,
      due: Math.min(...(open.length ? open : items).map((item) => time(item.dueDate))),
      code: items[0].project?.code ?? "~"
    };
  };
  const ranked = Array.from(projects.values()).map((items) => ({ items, rank: projectRank(items) }));
  ranked.sort(
    (a, b) => a.rank.open - b.rank.open || a.rank.due - b.rank.due || a.rank.code.localeCompare(b.rank.code)
  );
  return ranked.flatMap(({ items }) =>
    [...items].sort(
      (a, b) =>
        Number(!isOpen(a)) - Number(!isOpen(b)) ||
        time(a.dueDate) - time(b.dueDate) ||
        b.createdAt.getTime() - a.createdAt.getTime()
    )
  );
}

/** "Due soon" reaches this many days past today. */
const DUE_SOON_DAYS = 3;

/**
 * The board's one-tap filters. They look at subtasks only - the units someone
 * is assigned to and works on - so the count on a chip is the number of rows
 * that need a hand, not that plus every team task above them.
 */
export function quickTaskWhere(
  quick: TaskQuickFilter,
  today: Date,
  viewerEmployeeId: number | null
): Prisma.TaskWhereInput {
  const subtask = { parentTaskId: { not: null } };
  switch (quick) {
    case "overdue":
      return { ...subtask, status: { in: OPEN_TASK_STATUSES }, dueDate: { lt: today } };
    case "dueSoon": {
      const until = new Date(today);
      until.setUTCDate(until.getUTCDate() + DUE_SOON_DAYS);
      return { ...subtask, status: { in: OPEN_TASK_STATUSES }, dueDate: { gte: today, lte: until } };
    }
    case "review":
      // Someone else's work waiting for the viewer; their own goes up a level.
      return {
        ...subtask,
        status: TaskStatus.IN_REVIEW,
        ...(viewerEmployeeId ? { assigneeId: { not: viewerEmployeeId } } : {})
      };
    case "unassigned":
      return {
        ...subtask,
        assigneeId: null,
        status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] }
      };
  }
}
const CLOSED_PROJECT_STATUSES: ProjectStatus[] = [ProjectStatus.COMPLETED, ProjectStatus.CANCELLED];

export const taskInclude = {
  parentTask: {
    select: {
      id: true,
      title: true,
      status: true,
      startDate: true,
      dueDate: true,
      teamId: true,
      minLevel: true,
      maxLevel: true
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

type TaskWithInclude = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;
type TaskScope = "all" | "team" | "self";
type DateRange = { startDate: Date | string | null; dueDate: Date | string | null };

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
    return this.paginatedList(where, query, user, "all");
  }

  async findTeam(query: TaskQueryDto, user: AuthUser) {
    const where = await this.buildWhere(query, user, "team");
    return this.paginatedList(where, query, user, "team");
  }

  async findSelf(query: TaskQueryDto, user: AuthUser) {
    if (!user.employeeId) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Employee not found", "EMPLOYEE_NOT_FOUND");
    }
    const where = await this.buildWhere(query, user, "self");
    return this.paginatedList(where, query, user, "self");
  }

  /** One task for display, with the statuses the caller may move it to. */
  async getOne(id: number, user: AuthUser) {
    const task = await this.findOne(id, user);
    const [withStatuses] = await this.withAllowedStatuses([task], user);
    return withStatuses;
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
    this.ensureLevelRange(dto.minLevel, dto.maxLevel);
    this.ensureLevelSpecificFields(
      Boolean(scope.parentTaskId),
      dto.technologies,
      dto.requiredSkills,
      dto.actualHours
    );
    await this.ensureRequiredSkills(dto.requiredSkills);
    this.ensureDateRange(dto.startDate, dto.dueDate);
    this.ensureChildDateRange(scope.parentTask, dto.startDate, dto.dueDate);
    this.ensureInsideProject(scope.project, dto.startDate, dto.dueDate);

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
          minLevel: dto.minLevel ?? null,
          maxLevel: dto.maxLevel ?? null,
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
      await this.notifyAssigned(task);
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
    this.ensureLevelRange(
      dto.minLevel !== undefined ? dto.minLevel : oldValue.minLevel,
      dto.maxLevel !== undefined ? dto.maxLevel : oldValue.maxLevel
    );
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
    if (assigneeChanged) {
      this.ensureTaskOpen(oldValue);
    }
    if (dto.assigneeId) {
      await this.ensureAssigneeInTaskTeam(oldValue.teamId, dto.assigneeId);
    }
    await this.ensureRequiredSkills(dto.requiredSkills);
    this.ensureDateRange(nextStartDate, nextDueDate);
    this.ensureChildDateRange(oldValue.parentTask, nextStartDate, nextDueDate);
    this.ensureInsideProject(oldValue.project, nextStartDate, nextDueDate);
    if (!oldValue.parentTaskId) {
      this.ensureChildrenInside(oldValue.childTasks, nextStartDate, nextDueDate);
    }

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
          minLevel: dto.minLevel,
          maxLevel: dto.maxLevel,
          status: dto.status,
          startDate: dto.startDate ? toDateOnly(dto.startDate) : undefined,
          dueDate: dto.dueDate ? toDateOnly(dto.dueDate) : undefined,
          estimatedHours: dto.estimatedHours,
          actualHours: dto.actualHours,
          completedAt: completedAtFor(oldValue.status, dto.status)
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
      await this.notifyAssigned(task);
    }
    if (dto.status !== undefined && dto.status !== oldValue.status) {
      await this.notifyStatusChange(oldValue, task.status, actor);
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
    this.ensureTaskOpen(oldValue);
    if (oldValue.assigneeId === dto.assigneeId) {
      // Already theirs: no new history row, audit entry or notification.
      return oldValue;
    }
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

    await this.notifyAssigned(task);

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
    if (dto.status === oldValue.status) {
      return oldValue;
    }
    const isReviewer = await this.accessControl.canReviewTask(actor, oldValue);
    if (!canMoveTaskStatus(oldValue.status, dto.status, isReviewer)) {
      // Every move the assignee lacks is a reviewer's move, so one sentence fits.
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Only the team lead or department head can make this status change",
        "TASK_STATUS_TRANSITION_DENIED"
      );
    }
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        status: dto.status,
        completedAt: completedAtFor(oldValue.status, dto.status)
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
    await this.notifyStatusChange(oldValue, task.status, actor);

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
    const deletedAt = new Date();
    const task = await this.prisma.$transaction(async (tx) => {
      if (!oldValue.parentTaskId) {
        // The remaining subtasks are finished or cancelled; they go with their
        // parent, keeping their status so the history still reads true.
        await tx.task.updateMany({
          where: { parentTaskId: id, deletedAt: null },
          data: { deletedAt }
        });
      }
      return tx.task.update({
        where: { id },
        data: { status: TaskStatus.CANCELLED, deletedAt },
        include: taskInclude
      });
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

  private async paginatedList(
    where: Prisma.TaskWhereInput,
    query: TaskQueryDto,
    user: AuthUser,
    scope: TaskScope
  ) {
    if (query.groupByRoot) {
      return this.groupedList(where, query, user, scope);
    }
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: taskInclude,
        // A "still open" view leads with the open work: the TaskStatus enum is
        // declared TODO, IN_PROGRESS, IN_REVIEW, DONE, CANCELLED, so ascending
        // puts it first. Otherwise this month's finished tasks fill page one.
        orderBy: [
          ...(query.includeOpen ? [{ status: "asc" as const }] : []),
          { parentTaskId: "asc" },
          { dueDate: "asc" },
          { createdAt: "desc" }
        ],
        skip,
        take
      }),
      this.prisma.task.count({ where })
    ]);

    return {
      items: await this.withAllowedStatuses(items, user),
      meta: { total, page, limit }
    };
  }

  /**
   * One page of team tasks, each with its subtasks. A team task is on the list
   * when it or one of its subtasks matches; `matchedSubtaskIds` says which
   * subtasks did, so a client can show just those while a filter is on.
   *
   * The subtasks come from the caller's scope with no other filter, so a team
   * task never shows a subtask the caller could not list by itself.
   */
  private async groupedList(
    where: Prisma.TaskWhereInput,
    query: TaskQueryDto,
    user: AuthUser,
    scope: TaskScope
  ) {
    const { skip, take, page, limit } = pagination(query.page, query.limit);
    const matched = await this.prisma.task.findMany({
      where,
      select: { id: true, parentTaskId: true }
    });
    const matchedSelf = new Set<number>();
    const matchedChildren = new Map<number, number[]>();
    for (const row of matched) {
      if (row.parentTaskId) {
        matchedChildren.set(row.parentTaskId, [...(matchedChildren.get(row.parentTaskId) ?? []), row.id]);
      } else {
        matchedSelf.add(row.id);
      }
    }
    const rootIds = Array.from(new Set([...matchedSelf, ...matchedChildren.keys()]));

    const rootKeys = await this.prisma.task.findMany({
      where: { id: { in: rootIds.length ? rootIds : [-1] }, deletedAt: null },
      select: {
        id: true,
        status: true,
        dueDate: true,
        createdAt: true,
        projectId: true,
        project: { select: { code: true } }
      }
    });
    const pageIds = orderTeamTasksByProject(rootKeys)
      .slice(skip, skip + take)
      .map((root) => root.id);
    const total = rootKeys.length;

    const scopeWhere = await this.buildWhere(new TaskQueryDto(), user, scope);
    const [roots, children, summary] = await Promise.all([
      this.prisma.task.findMany({
        where: { id: { in: pageIds.length ? pageIds : [-1] } },
        include: { ...taskInclude, childTasks: false }
      }),
      this.prisma.task.findMany({
        where: { AND: [scopeWhere, { parentTaskId: { in: pageIds.length ? pageIds : [-1] } }] },
        select: taskInclude.childTasks.select,
        orderBy: taskInclude.childTasks.orderBy
      }),
      this.quickSummary(query, user, scope)
    ]);

    const childrenWithStatuses = await this.withAllowedStatuses(children, user);
    const byRoot = new Map<number, typeof childrenWithStatuses>();
    for (const child of childrenWithStatuses) {
      const parentId = child.parentTaskId as number;
      byRoot.set(parentId, [...(byRoot.get(parentId) ?? []), child]);
    }
    const rootById = new Map((await this.withAllowedStatuses(roots, user)).map((root) => [root.id, root]));
    const items = pageIds.flatMap((id) => {
      const root = rootById.get(id);
      return root
        ? [
            {
              ...root,
              childTasks: byRoot.get(id) ?? [],
              matchedSelf: matchedSelf.has(id),
              matchedSubtaskIds: matchedChildren.get(id) ?? []
            }
          ]
        : [];
    });

    return { items, meta: { total, page, limit }, summary };
  }

  /**
   * How many subtasks each quick filter would show, under every other filter
   * currently on - the numbers on the board's chips.
   */
  private async quickSummary(query: TaskQueryDto, user: AuthUser, scope: TaskScope) {
    const where = await this.buildWhere({ ...query, quick: undefined } as TaskQueryDto, user, scope);
    const today = toDateOnly(new Date());
    const counts = await Promise.all(
      TASK_QUICK_FILTERS.map((quick) =>
        this.prisma.task.count({
          where: { AND: [where, quickTaskWhere(quick, today, user.employeeId ?? null)] }
        })
      )
    );
    return Object.fromEntries(TASK_QUICK_FILTERS.map((quick, index) => [quick, counts[index]])) as Record<
      TaskQuickFilter,
      number
    >;
  }

  /**
   * Adds `allowedStatuses`: where the caller may move each subtask next, so a
   * client offers only moves the API will accept. Team-level tasks get none;
   * their status follows their subtasks.
   */
  private async withAllowedStatuses<
    T extends Pick<
      TaskWithInclude,
      "parentTaskId" | "status" | "departmentId" | "teamId" | "assigneeId"
    >
  >(items: T[], user: AuthUser) {
    if (!items.length) {
      return [];
    }
    const isAdmin = this.accessControl.isAdmin(user);
    const [departmentIds, teamIds] = isAdmin
      ? [[], []]
      : await Promise.all([
          this.accessControl.headedDepartmentIds(user),
          this.accessControl.managedTeamIds(user)
        ]);
    return items.map((item) => {
      // Mirrors AccessControlService.canReviewTask, own work included.
      const ownWork = item.assigneeId !== null && item.assigneeId === user.employeeId;
      const isReviewer =
        !ownWork &&
        (isAdmin ||
          (item.departmentId !== null && departmentIds.includes(item.departmentId)) ||
          (item.teamId !== null && teamIds.includes(item.teamId)));
      return {
        ...item,
        allowedStatuses: item.parentTaskId ? allowedTaskStatuses(item.status, isReviewer) : []
      };
    });
  }

  private async buildWhere(query: TaskQueryDto, user: AuthUser, scope: TaskScope) {
    const hasDateRange = Boolean(query.fromDate || query.toDate);
    const dueDateRange = hasDateRange
      ? {
          gte: query.fromDate ? toDateOnly(query.fromDate) : undefined,
          lte: query.toDate ? toDateOnly(query.toDate) : undefined
        }
      : undefined;

    const unfiltered: Prisma.TaskWhereInput = {
      deletedAt: null,
      // Rows left behind by a parent or project deleted before deletes cascaded.
      NOT: [
        { project: { deletedAt: { not: null } } },
        { parentTask: { deletedAt: { not: null } } }
      ],
      parentTaskId: query.parentTaskId,
      projectId: query.projectId,
      departmentId: query.departmentId,
      teamId: query.teamId,
      assigneeId: query.assigneeId,
      status: query.status,
      priority: query.priority,
      // A period filter can be widened: `includeUndated` adds tasks with no due
      // date (which belong to no period), `includeOpen` adds unfinished tasks
      // from any period. It goes under AND because OR is taken by `search`.
      ...(hasDateRange && (query.includeUndated || query.includeOpen)
        ? {
            AND: [
              {
                OR: [
                  { dueDate: dueDateRange },
                  ...(query.includeUndated ? [{ dueDate: null }] : []),
                  ...(query.includeOpen
                    ? [{ status: { in: OPEN_TASK_STATUSES } }]
                    : [])
                ]
              }
            ]
          }
        : { dueDate: dueDateRange }),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };
    const base: Prisma.TaskWhereInput = query.quick
      ? {
          AND: [
            unfiltered,
            quickTaskWhere(query.quick, toDateOnly(new Date()), user.employeeId ?? null)
          ]
        }
      : unfiltered;

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
          dueDate: true,
          project: { select: { status: true, startDate: true, endDate: true } }
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
      if (parentTask.project && CLOSED_PROJECT_STATUSES.includes(parentTask.project.status)) {
        throw new ApiError(HttpStatus.BAD_REQUEST, "Project is closed", "PROJECT_CLOSED");
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
        parentTask,
        project: parentTask.project
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
      select: { id: true, departmentId: true, status: true, startDate: true, endDate: true }
    });
    if (!project) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Project not found", "PROJECT_NOT_FOUND");
    }
    if (CLOSED_PROJECT_STATUSES.includes(project.status)) {
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
      parentTask: null,
      project
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
      select: { status: true, actualHours: true, completedAt: true }
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
        // Finished when its last subtask was, not whenever this last ran.
        completedAt: status === TaskStatus.DONE ? this.latestCompletion(nonCancelled) : null
      }
    });
  }

  private latestCompletion(children: { completedAt: Date | null }[]) {
    const times = children
      .map((child) => child.completedAt?.getTime())
      .filter((time): time is number => time !== undefined);
    return times.length ? new Date(Math.max(...times)) : new Date();
  }

  private ensureTaskOpen(task: Pick<TaskWithInclude, "status" | "project">) {
    if (CLOSED_TASK_STATUSES.includes(task.status)) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Task is already closed", "TASK_CLOSED");
    }
    if (task.project && CLOSED_PROJECT_STATUSES.includes(task.project.status)) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Project is closed", "PROJECT_CLOSED");
    }
  }

  /** A task's dates must sit inside its project's, where the project has them. */
  private ensureInsideProject(
    project: { startDate: Date | null; endDate: Date | null } | null | undefined,
    startDate?: string | Date | null,
    dueDate?: string | Date | null
  ) {
    if (!project) {
      return;
    }
    const outside =
      (project.startDate && startDate && toDateOnly(startDate) < toDateOnly(project.startDate)) ||
      (project.endDate && dueDate && toDateOnly(dueDate) > toDateOnly(project.endDate));
    if (outside) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Task dates must fall inside the project dates",
        "TASK_DATE_OUTSIDE_PROJECT"
      );
    }
  }

  /** Narrowing a team-level task must not leave its subtasks outside it. */
  private ensureChildrenInside(
    children: DateRange[],
    startDate?: string | Date | null,
    dueDate?: string | Date | null
  ) {
    const outside = children.some(
      (child) =>
        (startDate && child.startDate && toDateOnly(child.startDate) < toDateOnly(startDate)) ||
        (dueDate && child.dueDate && toDateOnly(child.dueDate) > toDateOnly(dueDate))
    );
    if (outside) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "Some subtasks fall outside the new dates",
        "SUBTASK_DATE_OUTSIDE_PARENT"
      );
    }
  }

  private async notifyAssigned(task: Pick<TaskWithInclude, "id" | "title" | "assignee">) {
    if (!task.assignee?.userId) {
      return;
    }
    await this.notifications.create(
      task.assignee.userId,
      "TASK_ASSIGNED",
      "New task assigned",
      `You were assigned to "${task.title}".`,
      "Task",
      task.id
    );
  }

  /**
   * Tells the other side about a status change: the assignee's move goes to
   * the team lead and whoever assigned the task (the department head when the
   * team has no lead); a reviewer's move goes to the assignee.
   */
  private async notifyStatusChange(before: TaskWithInclude, status: TaskStatus, actor: AuthUser) {
    const recipients = new Set<number>();
    if (before.assignee?.userId) {
      recipients.add(before.assignee.userId);
    }
    const leadUserIds = [
      before.team?.lead?.userId,
      ...(before.team?.members ?? [])
        .filter((member) => member.role === "LEAD")
        .map((member) => member.employee.userId)
    ].filter((userId): userId is number => typeof userId === "number");
    leadUserIds.forEach((userId) => recipients.add(userId));
    if (before.assignedByUserId) {
      recipients.add(before.assignedByUserId);
    }
    if (!leadUserIds.length && before.department?.managerId) {
      const head = await this.prisma.employee.findUnique({
        where: { id: before.department.managerId },
        select: { userId: true }
      });
      if (head?.userId) {
        recipients.add(head.userId);
      }
    }
    recipients.delete(actor.id);
    if (!recipients.size) {
      return;
    }

    const sentBack =
      before.status === TaskStatus.IN_REVIEW &&
      status === TaskStatus.IN_PROGRESS &&
      actor.employeeId !== before.assigneeId;
    let title = "Task returned for rework";
    let message = `"${before.title}" needs changes before it can be accepted.`;
    if (!sentBack) {
      const employee = actor.employeeId
        ? await this.prisma.employee.findUnique({
            where: { id: actor.employeeId },
            select: { fullName: true }
          })
        : null;
      title = "Task status updated";
      message = `"${before.title}" was moved to ${status} by ${employee?.fullName ?? actor.username}.`;
    }
    for (const userId of recipients) {
      await this.notifications.create(userId, "TASK_STATUS_CHANGED", title, message, "Task", before.id);
    }
  }

  /** A level range must run from junior to senior, not the other way round. */
  private ensureLevelRange(
    minLevel: CareerLevel | null | undefined,
    maxLevel: CareerLevel | null | undefined
  ) {
    if (minLevel && maxLevel && CAREER_LEVELS.indexOf(minLevel) > CAREER_LEVELS.indexOf(maxLevel)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        "The lowest suitable level is above the highest",
        "TASK_LEVEL_RANGE_INVALID"
      );
    }
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
