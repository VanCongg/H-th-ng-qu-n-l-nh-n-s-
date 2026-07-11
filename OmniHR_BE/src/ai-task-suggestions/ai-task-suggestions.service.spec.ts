import {
  AiTaskSuggestionStatus,
  LeaveRequestStatus,
  SkillProficiency,
  TaskPriority,
  TaskSkillImportance,
  TaskStatus
} from "@prisma/client";
import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { TaskWorkloadService } from "../task-workload/task-workload.service";
import { AiTaskSuggestionsService } from "./ai-task-suggestions.service";

describe("AiTaskSuggestionsService", () => {
  function createService() {
    const prisma = {
      task: {
        findFirst: jest.fn()
      },
      employee: {
        findMany: jest.fn()
      },
      leaveRequest: {
        findMany: jest.fn()
      },
      aiTaskSuggestion: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn()
      },
      team: {
        findFirst: jest.fn()
      },
      teamMember: {
        findFirst: jest.fn()
      },
      $transaction: jest.fn()
    };
    const audit = {
      log: jest.fn()
    };
    const accessControl = {
      ensureCanAssignTask: jest.fn(),
      ensureCanGenerateTaskSuggestion: jest.fn(),
      ensureCanReadTask: jest.fn(),
      candidateEmployeeIdsForTask: jest.fn(),
      isAdmin: jest.fn().mockReturnValue(false),
      teamEmployeeIds: jest.fn()
    };
    const workloadService = {
      summariesForEmployees: jest.fn()
    };

    return {
      service: new AiTaskSuggestionsService(
        prisma as unknown as PrismaService,
        audit as unknown as AuditService,
        accessControl as unknown as AccessControlService,
        workloadService as unknown as TaskWorkloadService
      ),
      prisma,
      accessControl,
      audit,
      workloadService
    };
  }

  const actor = {
    id: 1,
    username: "manager",
    email: "manager@example.com",
    roles: ["MANAGER"],
    permissions: ["AI_TASK_SELECT"],
    employeeId: 10,
    mustChangePassword: false
  };

  function date(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  function baseTask(overrides: Record<string, unknown> = {}) {
    return {
      id: 100,
      parentTaskId: 90,
      projectId: 3,
      departmentId: 2,
      teamId: null,
      title: "Build payroll report",
      description: null,
      priority: TaskPriority.HIGH,
      status: TaskStatus.TODO,
      assigneeId: null,
      createdByUserId: actor.id,
      assignedByUserId: null,
      startDate: date("2026-06-22"),
      dueDate: date("2026-06-26"),
      estimatedHours: 16,
      actualHours: null,
      completedAt: null,
      createdAt: date("2026-06-19"),
      updatedAt: date("2026-06-19"),
      deletedAt: null,
      requiredSkills: [
        {
          id: 1,
          taskId: 100,
          skillId: 9,
          requiredProficiency: SkillProficiency.INTERMEDIATE,
          importance: TaskSkillImportance.REQUIRED,
          createdAt: date("2026-06-19"),
          skill: {
            id: 9,
            code: "NODE",
            name: "Node.js",
            category: null,
            description: null,
            isActive: true,
            createdAt: date("2026-06-19"),
            updatedAt: date("2026-06-19")
          }
        }
      ],
      ...overrides
    };
  }

  function baseEmployee(overrides: Record<string, unknown> = {}) {
    return {
      id: 30,
      employeeCode: "E030",
      fullName: "Nguyen Van A",
      companyEmail: "a@example.com",
      avatarUrl: null,
      personalEmail: null,
      phone: null,
      birthDate: date("1995-01-01"),
      hireDate: date("2020-01-01"),
      status: "ACTIVE",
      departmentId: 2,
      positionId: 4,
      careerLevel: "MIDDLE",
      userId: null,
      createdAt: date("2026-06-19"),
      updatedAt: date("2026-06-19"),
      deletedAt: null,
      department: { id: 2, name: "Engineering" },
      position: { id: 4, name: "Backend Developer" },
      employeeSkills: [
        {
          id: 11,
          employeeId: 30,
          skillId: 9,
          yearsExperience: 3,
          proficiency: SkillProficiency.ADVANCED,
          lastUsedAt: null,
          note: null,
          createdAt: date("2026-06-19"),
          updatedAt: date("2026-06-19"),
          skill: {
            id: 9,
            code: "NODE",
            name: "Node.js",
            category: null,
            description: null,
            isActive: true,
            createdAt: date("2026-06-19"),
            updatedAt: date("2026-06-19")
          }
        }
      ],
      ...overrides
    };
  }

  function suggestionResponse(overrides: Record<string, unknown> = {}) {
    return {
      id: 50,
      taskId: 100,
      requestedByUserId: actor.id,
      algorithmVersion: "rule-based-v3",
      inputSnapshot: {},
      status: AiTaskSuggestionStatus.GENERATED,
      createdAt: date("2026-06-19"),
      task: {
        ...baseTask(),
        project: null,
        assignee: null
      },
      requestedByUser: {
        id: actor.id,
        username: actor.username,
        email: actor.email
      },
      items: [],
      ...overrides
    };
  }

  it("does not select a suggestion item outside the task team", async () => {
    const { service, prisma, accessControl } = createService();

    prisma.aiTaskSuggestion.findUnique.mockResolvedValue({
      id: 50,
      taskId: 100,
      status: AiTaskSuggestionStatus.GENERATED,
      inputSnapshot: {},
      task: baseTask({ teamId: 7 }),
      items: [{ id: 500, employeeId: 30 }]
    });
    prisma.teamMember.findFirst.mockResolvedValue(null);

    await expect(
      service.select(50, { suggestionItemId: 500 }, actor)
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: "VALIDATION_ERROR"
      })
    });
    expect(accessControl.ensureCanAssignTask).toHaveBeenCalledWith(actor, 100, 30);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("does not generate suggestions outside the task team", async () => {
    const { service, prisma, accessControl } = createService();

    prisma.task.findFirst.mockResolvedValue(baseTask({
      teamId: 7,
      requiredSkills: [],
      startDate: null,
      dueDate: null
    }));
    accessControl.candidateEmployeeIdsForTask.mockResolvedValue([30]);
    prisma.team.findFirst.mockResolvedValue({
      leadId: null,
      members: []
    });

    await expect(
      service.generate(100, { limit: 5, includeAvailability: true }, actor)
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: "AI_SUGGESTION_NO_CANDIDATES"
      })
    });
  });

  it("generates v3 suggestions with pending leave warnings and workday availability score", async () => {
    const { service, prisma, accessControl, workloadService } = createService();
    const task = baseTask();
    const employee = baseEmployee();

    prisma.task.findFirst.mockResolvedValue(task);
    accessControl.candidateEmployeeIdsForTask.mockResolvedValue([actor.employeeId, 30]);
    prisma.employee.findMany.mockResolvedValue([employee]);
    workloadService.summariesForEmployees.mockResolvedValue(
      new Map([
        [
          30,
          {
            employeeId: 30,
            activeTaskCount: 2,
            totalEstimatedHours: 12,
            overdueTaskCount: 0,
            capacityHoursPerWeek: 40,
            availableHours: 28,
            workloadScore: 100
          }
        ]
      ])
    );
    prisma.leaveRequest.findMany.mockResolvedValue([
      {
        startDate: date("2026-06-22"),
        endDate: date("2026-06-24"),
        status: LeaveRequestStatus.APPROVED
      },
      {
        startDate: date("2026-06-25"),
        endDate: date("2026-06-26"),
        status: LeaveRequestStatus.PENDING
      }
    ]);
    prisma.aiTaskSuggestion.create.mockImplementation(({ data }) =>
      Promise.resolve(
        suggestionResponse({
          algorithmVersion: data.algorithmVersion,
          inputSnapshot: data.inputSnapshot,
          items: data.items.create.map((item: Record<string, unknown>) => ({
            id: 500,
            suggestionId: 50,
            createdAt: date("2026-06-19"),
            selected: false,
            ...item,
            employee
          }))
        })
      )
    );

    const result = await service.generate(
      100,
      { includeAvailability: true, includePendingLeave: true },
      actor
    );

    expect(prisma.employee.findMany.mock.calls[0][0].where.AND).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: { in: [30] } })])
    );
    expect(prisma.aiTaskSuggestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          algorithmVersion: "rule-based-v3",
          inputSnapshot: expect.objectContaining({
            taskFingerprint: expect.any(String),
            expiresAt: expect.any(String),
            options: expect.objectContaining({
              includeSelf: false,
              includePendingLeave: true
            })
          })
        })
      })
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        availabilityScore: 54,
        warnings: expect.arrayContaining([
          "APPROVED_LEAVE_OVERLAP",
          "PENDING_LEAVE_OVERLAP"
        ]),
        employeeCode: "E030",
        departmentName: "Engineering",
        positionName: "Backend Developer",
        eligible: true,
        performanceScore: null
      })
    );
  });

  it("expires stale suggestions when the task fingerprint changed before selection", async () => {
    const { service, prisma, accessControl } = createService();
    prisma.aiTaskSuggestion.findUnique.mockResolvedValue({
      id: 50,
      taskId: 100,
      status: AiTaskSuggestionStatus.GENERATED,
      inputSnapshot: {
        expiresAt: "2099-01-01T00:00:00.000Z",
        taskFingerprint: "old-fingerprint"
      },
      task: baseTask(),
      items: [{ id: 500, employeeId: 30 }]
    });

    await expect(
      service.select(50, { suggestionItemId: 500 }, actor)
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: "AI_SUGGESTION_EXPIRED"
      })
    });
    expect(prisma.aiTaskSuggestion.update).toHaveBeenCalledWith({
      where: { id: 50 },
      data: { status: AiTaskSuggestionStatus.EXPIRED }
    });
    expect(accessControl.ensureCanAssignTask).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("cancels generated suggestions and keeps the reason in the snapshot", async () => {
    const { service, prisma, accessControl, audit } = createService();
    const current = suggestionResponse({
      inputSnapshot: { taskFingerprint: "abc" }
    });
    const cancelled = suggestionResponse({
      status: AiTaskSuggestionStatus.CANCELLED,
      inputSnapshot: {
        taskFingerprint: "abc",
        cancelledAt: "2026-06-19T00:00:00.000Z",
        cancelledByUserId: actor.id,
        cancelReason: "Wrong priority"
      }
    });
    prisma.aiTaskSuggestion.findUnique.mockResolvedValue(current);
    prisma.aiTaskSuggestion.update.mockResolvedValue(cancelled);

    const result = await service.cancel(50, { reason: "Wrong priority" }, actor);

    expect(accessControl.ensureCanReadTask).toHaveBeenCalledWith(actor, 100);
    expect(prisma.aiTaskSuggestion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 50 },
        data: expect.objectContaining({
          status: AiTaskSuggestionStatus.CANCELLED,
          inputSnapshot: expect.objectContaining({
            taskFingerprint: "abc",
            cancelledByUserId: actor.id,
            cancelReason: "Wrong priority"
          })
        })
      })
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CANCEL_AI_TASK_SUGGESTION" })
    );
    expect(result.status).toBe(AiTaskSuggestionStatus.CANCELLED);
  });
});
