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
