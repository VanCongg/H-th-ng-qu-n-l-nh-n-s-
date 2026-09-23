import { TaskAssignmentType } from "@prisma/client";
import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { TasksService } from "./tasks.service";

describe("TasksService", () => {
  function createService() {
    const tx = {
      task: {
        update: jest.fn()
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
        update: jest.fn()
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
      ensureCanAssignToEmployee: jest.fn()
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
});
