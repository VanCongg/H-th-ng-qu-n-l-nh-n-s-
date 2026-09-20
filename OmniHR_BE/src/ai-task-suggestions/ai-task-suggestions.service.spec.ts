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
import { SystemSettingsService } from "../common/services/system-settings.service";
import { SuggestionExplainerClient } from "./suggestion-explainer.client";
import { DEFAULT_SCORE_WEIGHTS } from "./suggestion-scoring";
import { AiTaskSuggestionsService } from "./ai-task-suggestions.service";

describe("AiTaskSuggestionsService", () => {
  function createService() {
    const prisma = {
      task: {
        findFirst: jest.fn(),
        // Finished tasks behind the track-record signal; empty means every
        // candidate is a new hire and that signal drops out of the score.
        findMany: jest.fn().mockResolvedValue([])
      },
      employee: {
        findMany: jest.fn()
      },
      leaveRequest: {
        findMany: jest.fn()
      },
      // Recent assignments behind the fair-share rebalancing; empty means the
      // team is perfectly balanced and nobody is penalised.
      taskAssignment: {
        groupBy: jest.fn().mockResolvedValue([])
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
    // The fitted weights come from settings; the defaults keep the expected
    // scores in this file readable.
    // Off by default here: these tests assert the sentence the service writes
    // itself, and the LLM wording is verified in the AI service tests.
    const explainer = { enabled: false, explain: jest.fn() };
    const systemSettings = {
      getSettings: jest.fn().mockResolvedValue({
        aiWeightSkill: DEFAULT_SCORE_WEIGHTS.skill,
        aiWeightWorkload: DEFAULT_SCORE_WEIGHTS.workload,
        aiWeightAvailability: DEFAULT_SCORE_WEIGHTS.availability,
        aiWeightHistory: DEFAULT_SCORE_WEIGHTS.history
      })
    };

    return {
      service: new AiTaskSuggestionsService(
        prisma as unknown as PrismaService,
        audit as unknown as AuditService,
        accessControl as unknown as AccessControlService,
        workloadService as unknown as TaskWorkloadService,
        systemSettings as unknown as SystemSettingsService,
        explainer as unknown as SuggestionExplainerClient
      ),
      prisma,
      accessControl,
      audit,
      workloadService,
      systemSettings,
      explainer
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
      title: "Build the monthly report",
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
      algorithmVersion: "rule-based-v4",
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

  it("generates suggestions with pending leave warnings and workday availability score", async () => {
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
          algorithmVersion: "mcdm-v5",
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
        eligible: true
      })
    );
  });

  it("scores with the weights fitted in system settings, not a constant", async () => {
    const { service, prisma, accessControl, workloadService, systemSettings } =
      createService();
    // Skill 92 and workload 40 for this candidate: weighting workload alone
    // has to land on 40, which no fixed weight vector would produce.
    systemSettings.getSettings.mockResolvedValue({
      aiWeightSkill: 0,
      aiWeightWorkload: 1,
      aiWeightAvailability: 0,
      aiWeightHistory: 0
    });
    prisma.task.findFirst.mockResolvedValue(baseTask());
    accessControl.candidateEmployeeIdsForTask.mockResolvedValue([actor.employeeId, 30]);
    prisma.employee.findMany.mockResolvedValue([baseEmployee()]);
    workloadService.summariesForEmployees.mockResolvedValue(
      new Map([
        [
          30,
          {
            employeeId: 30,
            activeTaskCount: 5,
            totalEstimatedHours: 36,
            overdueTaskCount: 0,
            capacityHoursPerWeek: 40,
            availableHours: 4,
            workloadScore: 40
          }
        ]
      ])
    );
    prisma.leaveRequest.findMany.mockResolvedValue([]);
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
            employee: baseEmployee()
          }))
        })
      )
    );

    const result = await service.generate(100, { includeAvailability: true }, actor);

    expect(result.items[0].score).toBe(40);
    expect(prisma.aiTaskSuggestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          inputSnapshot: expect.objectContaining({
            weights: { skill: 0, workload: 1, availability: 0, history: 0 }
          })
        })
      })
    );
  });

  it("uses the sentence the AI service wrote and keeps its own when it does not answer", async () => {
    const { service, prisma, accessControl, workloadService, explainer } =
      createService();
    explainer.enabled = true;
    explainer.explain.mockResolvedValue(
      new Map([[30, "Khớp cả hai kỹ năng bắt buộc và còn 28h trống trong tuần."]])
    );
    prisma.task.findFirst.mockResolvedValue(baseTask());
    accessControl.candidateEmployeeIdsForTask.mockResolvedValue([actor.employeeId, 30]);
    prisma.employee.findMany.mockResolvedValue([baseEmployee()]);
    workloadService.summariesForEmployees.mockResolvedValue(new Map());
    prisma.leaveRequest.findMany.mockResolvedValue([]);
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
            employee: baseEmployee()
          }))
        })
      )
    );

    const written = await service.generate(100, {}, actor);
    expect(written.items[0].reason).toBe(
      "Khớp cả hai kỹ năng bắt buộc và còn 28h trống trong tuần."
    );

    // The AI service answering with nothing must leave the ranking untouched.
    explainer.explain.mockResolvedValue(new Map());
    const fallback = await service.generate(100, {}, actor);
    expect(fallback.items[0].reason).toContain("Nguyen Van A");
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
