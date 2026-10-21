import { TaskAssignmentType } from "@prisma/client";
import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { TasksService, orderTeamTasksByProject, quickTaskWhere } from "./tasks.service";

describe("TasksService", () => {
  function createService() {
    const tx = {
      task: {
        update: jest.fn(),
        updateMany: jest.fn()
      },
      taskAssignment: {
        create: jest.fn()
      },
      taskRequiredSkill: {
        deleteMany: jest.fn(),
        createMany: jest.fn()
      }
    };
    const prisma = {
      task: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{ status: "TODO" }]),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0)
      },
      employee: {
        findUnique: jest.fn().mockResolvedValue({ fullName: "Nguyen Van A", userId: 50 })
      },
      $transaction: jest.fn((callback: (transaction: any) => Promise<unknown>) =>
        callback(tx)
      )
    };
    const audit = {
      log: jest.fn()
    };
    const accessControl = {
      ensureCanReadTask: jest.fn(),
      ensureCanUpdateTask: jest.fn(),
      ensureCanAssignToEmployee: jest.fn(),
      ensureCanUpdateTaskStatus: jest.fn(),
      ensureCanAssignTask: jest.fn(),
      canReviewTask: jest.fn().mockResolvedValue(false),
      isAdmin: jest.fn(() => false),
      headedDepartmentIds: jest.fn().mockResolvedValue([]),
      managedTeamIds: jest.fn().mockResolvedValue([])
    };
    const notifications = {
      create: jest.fn()
    };

    return {
      service: new TasksService(
        prisma as unknown as PrismaService,
        audit as unknown as AuditService,
        accessControl as unknown as AccessControlService,
        notifications as unknown as NotificationsService
      ),
      prisma,
      tx,
      audit,
      accessControl,
      notifications
    };
  }

  const actor = {
    id: 1,
    username: "manager",
    email: "manager@example.com",
    roles: ["MANAGER"],
    permissions: ["TASK_UPDATE"],
    employeeId: 10,
    mustChangePassword: false
  };

  const task = {
    id: 100,
    parentTaskId: 90,
    parentTask: null,
    projectId: null,
    departmentId: null,
    teamId: null,
    assigneeId: 20,
    startDate: new Date("2026-06-01T00:00:00.000Z"),
    dueDate: new Date("2026-06-20T00:00:00.000Z"),
    status: "TODO"
  };

  it("records assignment history when task update changes assignee", async () => {
    const { service, prisma, tx, audit } = createService();
    const updatedTask = { ...task, assigneeId: 30 };

    prisma.task.findFirst.mockResolvedValue(task);
    tx.task.update.mockResolvedValue(updatedTask);

    await expect(
      service.update(100, { assigneeId: 30 }, actor)
    ).resolves.toBe(updatedTask);

    expect(tx.taskAssignment.create).toHaveBeenCalledWith({
      data: {
        taskId: 100,
        assigneeId: 30,
        assignedByUserId: 1,
        assignmentType: TaskAssignmentType.REASSIGNED,
        note: "Assigned during task update"
      }
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "REASSIGN_TASK",
        entityType: "Task",
        entityId: 100,
        newValue: {
          assigneeId: 30,
          assignmentType: TaskAssignmentType.REASSIGNED
        }
      })
    );
  });

  describe("findSelf date filtering", () => {
    function createListService() {
      const created = createService();
      // paginatedList batches findMany + count; both are already called by the
      // time $transaction receives them, so the args are readable off the mocks.
      created.prisma.task.findMany = jest.fn().mockResolvedValue([]);
      (created.prisma.task as Record<string, unknown>).count = jest
        .fn()
        .mockResolvedValue(0);
      created.prisma.$transaction = jest
        .fn()
        .mockResolvedValue([[], 0]) as never;
      return created;
    }

    function whereOf(prisma: { task: { findMany: jest.Mock } }) {
      return prisma.task.findMany.mock.calls[0][0].where;
    }

    it("drops undated tasks from a period by default", async () => {
      const { service, prisma } = createListService();

      await service.findSelf(
        { fromDate: "2026-09-01", toDate: "2026-09-30" },
        actor
      );

      const where = whereOf(prisma as never);
      expect(where.AND[0].dueDate).toEqual({
        gte: new Date("2026-09-01T00:00:00.000Z"),
        lte: new Date("2026-09-30T00:00:00.000Z")
      });
      expect(where.AND[0].AND).toBeUndefined();
    });

    it("keeps undated tasks when includeUndated is set", async () => {
      const { service, prisma } = createListService();

      await service.findSelf(
        { fromDate: "2026-09-01", toDate: "2026-09-30", includeUndated: true },
        actor
      );

      const where = whereOf(prisma as never);
      expect(where.AND[0].dueDate).toBeUndefined();
      expect(where.AND[0].AND).toEqual([
        {
          OR: [
            {
              dueDate: {
                gte: new Date("2026-09-01T00:00:00.000Z"),
                lte: new Date("2026-09-30T00:00:00.000Z")
              }
            },
            { dueDate: null }
          ]
        }
      ]);
    });

    it("keeps unfinished tasks from any period when includeOpen is set", async () => {
      const { service, prisma } = createListService();

      await service.findSelf(
        { fromDate: "2026-09-01", toDate: "2026-09-30", includeOpen: true },
        actor
      );

      const where = whereOf(prisma as never);
      expect(where.AND[0].AND).toEqual([
        {
          OR: [
            {
              dueDate: {
                gte: new Date("2026-09-01T00:00:00.000Z"),
                lte: new Date("2026-09-30T00:00:00.000Z")
              }
            },
            { status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] } }
          ]
        }
      ]);
    });

    it("still narrows by an explicit status on top of the widened period", async () => {
      const { service, prisma } = createListService();

      await service.findSelf(
        {
          fromDate: "2026-09-01",
          toDate: "2026-09-30",
          includeOpen: true,
          status: "DONE" as never
        },
        actor
      );

      // status AND (due this month OR open) = done this month.
      const where = whereOf(prisma as never);
      expect(where.AND[0].status).toBe("DONE");
      expect(where.AND[0].AND[0].OR).toHaveLength(2);
    });

    it("combines includeOpen and includeUndated in one OR", async () => {
      const { service, prisma } = createListService();

      await service.findSelf(
        {
          fromDate: "2026-09-01",
          toDate: "2026-09-30",
          includeOpen: true,
          includeUndated: true
        },
        actor
      );

      const where = whereOf(prisma as never);
      expect(where.AND[0].AND[0].OR).toEqual([
        expect.objectContaining({ dueDate: expect.any(Object) }),
        { dueDate: null },
        { status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] } }
      ]);
    });

    it("leads with open work only in the includeOpen view", async () => {
      const { service, prisma } = createListService();

      await service.findSelf(
        { fromDate: "2026-09-01", toDate: "2026-09-30", includeOpen: true },
        actor
      );
      expect(prisma.task.findMany.mock.calls[0][0].orderBy[0]).toEqual({
        status: "asc"
      });

      const plain = createListService();
      await plain.service.findSelf({}, actor);
      expect(plain.prisma.task.findMany.mock.calls[0][0].orderBy[0]).toEqual({
        parentTaskId: "asc"
      });
    });

    it("leaves the due date unconstrained without a period", async () => {
      const { service, prisma } = createListService();

      await service.findSelf({ includeUndated: true }, actor);

      const where = whereOf(prisma as never);
      expect(where.AND[0].dueDate).toBeUndefined();
      expect(where.AND[0].AND).toBeUndefined();
    });
  });

  describe("grouped by team task", () => {
    const root = (id: number) => ({ id, parentTaskId: null, status: "IN_PROGRESS", departmentId: 1, teamId: 2, assigneeId: null });
    const child = (id: number, parentTaskId: number) => ({
      id,
      parentTaskId,
      status: "IN_REVIEW",
      departmentId: 1,
      teamId: 2,
      assigneeId: 30
    });

    function createGroupedService() {
      const created = createService();
      created.prisma.task.findMany = jest.fn((args: { select?: { id?: boolean; parentTaskId?: boolean }; where: any }) => {
        // 1. every matching row, 2. sort keys of their team tasks, 3. the page's team tasks, 4. their subtasks
        if (args.select && Object.keys(args.select).length === 2 && args.select.parentTaskId) {
          return Promise.resolve([
            { id: 11, parentTaskId: 1 },
            { id: 2, parentTaskId: null },
            { id: 12, parentTaskId: 1 }
          ]);
        }
        if ((args.select as Record<string, unknown> | undefined)?.project) {
          return Promise.resolve([
            { id: 1, status: "IN_PROGRESS", dueDate: new Date("2026-10-01"), createdAt: new Date(), projectId: 1, project: { code: "A" } },
            { id: 2, status: "IN_PROGRESS", dueDate: new Date("2026-10-02"), createdAt: new Date(), projectId: 1, project: { code: "A" } }
          ]);
        }
        if (args.where?.AND) {
          return Promise.resolve([child(11, 1), child(12, 1), child(13, 1)]);
        }
        return Promise.resolve([root(2), root(1)]);
      }) as never;
      created.prisma.task.count = jest.fn().mockResolvedValue(2);
      return created;
    }

    it("brings a team task in through a matching subtask and says which ones matched", async () => {
      const { service } = createGroupedService();

      const result = (await service.findSelf({ groupByRoot: true, status: "IN_REVIEW" } as never, actor)) as {
        items: Array<{ id: number; matchedSelf: boolean; matchedSubtaskIds: number[]; childTasks: unknown[] }>;
        meta: { total: number };
      };

      expect(result.items.map((item) => item.id)).toEqual([1, 2]);
      expect(result.items[0]).toMatchObject({ matchedSelf: false, matchedSubtaskIds: [11, 12] });
      expect(result.items[0].childTasks).toHaveLength(3);
      expect(result.items[1]).toMatchObject({ matchedSelf: true, matchedSubtaskIds: [] });
      expect(result.meta.total).toBe(2);
    });

    it("pages team tasks, not rows", async () => {
      const { service, prisma } = createGroupedService();
      const keys = Array.from({ length: 12 }, (_, index) => ({
        id: index + 1,
        status: "TODO",
        dueDate: new Date(Date.UTC(2026, 9, index + 1)),
        createdAt: new Date(),
        projectId: 1,
        project: { code: "P" }
      }));
      (prisma.task.findMany as jest.Mock).mockImplementation((args: { select?: Record<string, unknown>; where: any }) => {
        if (args.select?.parentTaskId && Object.keys(args.select).length === 2) {
          return Promise.resolve(keys.map((key) => ({ id: key.id, parentTaskId: null })));
        }
        if (args.select?.project) {
          return Promise.resolve(keys);
        }
        return Promise.resolve([]);
      });

      await service.findSelf({ groupByRoot: true, page: 2, limit: 10 } as never, actor);

      const rootsCall = (prisma.task.findMany as jest.Mock).mock.calls.find(([args]) => args.include)[0];
      expect(rootsCall.where.id.in).toEqual([11, 12]);
    });

    it("counts each quick filter under the other filters", async () => {
      const { service } = createGroupedService();

      const result = (await service.findSelf({ groupByRoot: true } as never, actor)) as {
        summary: Record<string, number>;
      };

      expect(result.summary).toEqual({ overdue: 2, dueSoon: 2, review: 2, unassigned: 2 });
    });
  });

  describe("orderTeamTasksByProject", () => {
    const key = (id: number, projectId: number, status: string, due: string) => ({
      id,
      status: status as never,
      dueDate: new Date(due),
      createdAt: new Date("2026-01-01"),
      projectId,
      project: { code: `P${projectId}` }
    });

    it("keeps a project together and puts finished projects last", () => {
      const ordered = orderTeamTasksByProject([
        key(1, 1, "DONE", "2026-09-01"),
        key(2, 2, "TODO", "2026-10-10"),
        key(3, 3, "IN_PROGRESS", "2026-09-20"),
        key(4, 2, "DONE", "2026-09-05"),
        key(5, 3, "TODO", "2026-11-01")
      ]);

      // Project 3 has the earliest open due date, project 1 is all done.
      expect(ordered.map((item) => item.id)).toEqual([3, 5, 2, 4, 1]);
    });
  });

  describe("quick filters", () => {
    const today = new Date("2026-09-27T00:00:00.000Z");

    it("counts only unfinished subtasks past their due date as overdue", () => {
      expect(quickTaskWhere("overdue", today, 10)).toEqual({
        parentTaskId: { not: null },
        status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] },
        dueDate: { lt: today }
      });
    });

    it("looks three days ahead for due soon", () => {
      expect(quickTaskWhere("dueSoon", today, 10).dueDate).toEqual({
        gte: today,
        lte: new Date("2026-09-30T00:00:00.000Z")
      });
    });

    it("leaves the viewer's own work out of what waits for their review", () => {
      expect(quickTaskWhere("review", today, 10)).toMatchObject({
        status: "IN_REVIEW",
        assigneeId: { not: 10 }
      });
    });

    it("finds open subtasks nobody has taken", () => {
      expect(quickTaskWhere("unassigned", today, 10)).toMatchObject({
        parentTaskId: { not: null },
        assigneeId: null
      });
    });
  });

  it("refuses a level range that runs from senior down to junior", async () => {
    const { service, prisma, tx } = createService();
    prisma.task.findFirst.mockResolvedValue({ ...task, minLevel: null, maxLevel: "JUNIOR" });

    await expect(
      service.update(100, { minLevel: "SENIOR" }, actor)
    ).rejects.toMatchObject({ errorCode: "TASK_LEVEL_RANGE_INVALID" });
    expect(tx.task.update).not.toHaveBeenCalled();
  });

  it("validates updated start date against the existing due date", async () => {
    const { service, prisma, tx } = createService();

    prisma.task.findFirst.mockResolvedValue(task);

    await expect(
      service.update(100, { startDate: "2026-07-01" }, actor)
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: "VALIDATION_ERROR"
      })
    });
    expect(tx.task.update).not.toHaveBeenCalled();
  });

  describe("status changes", () => {
    const assignee = { ...actor, id: 2, roles: ["EMPLOYEE"], employeeId: 20 };
    const subtask = {
      ...task,
      title: "Build login",
      status: "IN_PROGRESS",
      assignedByUserId: 1,
      assignee: { id: 20, userId: 2 },
      team: { lead: { id: 10, userId: 1 }, members: [] },
      department: { managerId: 5 },
      completedAt: null
    };

    it("stops the assignee from approving their own task", async () => {
      const { service, prisma } = createService();
      prisma.task.findFirst.mockResolvedValue({ ...subtask, status: "IN_REVIEW" });

      await expect(
        service.updateStatus(100, { status: "DONE" as never }, assignee)
      ).rejects.toMatchObject({
        response: expect.objectContaining({ errorCode: "TASK_STATUS_TRANSITION_DENIED" })
      });
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it("tells the team lead when the assignee hands work in", async () => {
      const { service, prisma, notifications } = createService();
      prisma.task.findFirst.mockResolvedValue(subtask);
      prisma.task.update.mockResolvedValue({ ...subtask, status: "IN_REVIEW" });

      await service.updateStatus(100, { status: "IN_REVIEW" as never }, assignee);

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "IN_REVIEW", completedAt: null } })
      );
      expect(notifications.create).toHaveBeenCalledTimes(1);
      expect(notifications.create).toHaveBeenCalledWith(
        1,
        "TASK_STATUS_CHANGED",
        "Task status updated",
        '"Build login" was moved to IN_REVIEW by Nguyen Van A.',
        "Task",
        100
      );
    });

    it("tells the assignee when the lead sends work back", async () => {
      const { service, prisma, accessControl, notifications } = createService();
      accessControl.canReviewTask.mockResolvedValue(true);
      prisma.task.findFirst.mockResolvedValue({ ...subtask, status: "IN_REVIEW" });
      prisma.task.update.mockResolvedValue({ ...subtask, status: "IN_PROGRESS" });

      await service.updateStatus(100, { status: "IN_PROGRESS" as never }, actor);

      expect(notifications.create).toHaveBeenCalledWith(
        2,
        "TASK_STATUS_CHANGED",
        "Task returned for rework",
        '"Build login" needs changes before it can be accepted.',
        "Task",
        100
      );
    });

    it("keeps the completion time when a finished task is edited", async () => {
      const { service, prisma, tx } = createService();
      prisma.task.findFirst.mockResolvedValue({ ...subtask, status: "DONE" });
      tx.task.update.mockResolvedValue({ ...subtask, status: "DONE" });

      await service.update(100, { title: "Build login page", status: "DONE" as never }, actor);

      expect(tx.task.update.mock.calls[0][0].data.completedAt).toBeUndefined();
    });
  });

  it("does not record a new assignment for the same assignee", async () => {
    const { service, prisma, tx, notifications } = createService();
    prisma.task.findFirst.mockResolvedValue({ ...task, project: null });

    await service.assign(100, { assigneeId: 20 }, actor);

    expect(tx.taskAssignment.create).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it("refuses to reassign a finished task", async () => {
    const { service, prisma } = createService();
    prisma.task.findFirst.mockResolvedValue({ ...task, status: "DONE", project: null });

    await expect(service.assign(100, { assigneeId: 30 }, actor)).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: "TASK_CLOSED" })
    });
  });

  it("deletes the finished subtasks together with their team-level task", async () => {
    const { service, prisma, tx } = createService();
    prisma.task.findFirst.mockResolvedValue({ ...task, parentTaskId: null });

    await service.softDelete(100, actor);

    expect(tx.task.updateMany).toHaveBeenCalledWith({
      where: { parentTaskId: 100, deletedAt: null },
      data: { deletedAt: expect.any(Date) }
    });
  });

  it("refuses to narrow a team-level task past its subtasks", async () => {
    const { service, prisma, tx } = createService();
    prisma.task.findFirst.mockResolvedValue({
      ...task,
      parentTaskId: null,
      childTasks: [{ startDate: new Date("2026-06-05"), dueDate: new Date("2026-06-18") }]
    });

    await expect(service.update(100, { dueDate: "2026-06-10" }, actor)).rejects.toMatchObject({
      response: expect.objectContaining({ errorCode: "SUBTASK_DATE_OUTSIDE_PARENT" })
    });
    expect(tx.task.update).not.toHaveBeenCalled();
  });
});
