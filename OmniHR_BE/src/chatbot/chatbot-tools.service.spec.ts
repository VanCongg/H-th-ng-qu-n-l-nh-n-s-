import { LeaveBalancesService } from "../leave-balances/leave-balances.service";
import {
  ChatbotActionStatus,
  ChatbotActionType,
  LeaveRequestStatus,
} from "@prisma/client";
import { AccessControlService } from "../common/services/access-control.service";
import { AuditService } from "../common/services/audit.service";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { AuthUser } from "../common/types";
import { LeaveRequestsService } from "../leave-requests/leave-requests.service";
import { PrismaService } from "../prisma/prisma.service";
import { TasksService } from "../tasks/tasks.service";
import { TimesheetService } from "../attendance/timesheet.service";
import { ChatbotToolsService } from "./chatbot-tools.service";

describe("ChatbotToolsService", () => {
  const user: AuthUser = {
    id: 1,
    username: "employee",
    email: "employee@example.com",
    roles: ["EMPLOYEE"],
    permissions: ["LEAVE_CREATE", "LEAVE_CANCEL_SELF", "LEAVE_READ_SELF"],
    employeeId: 10,
    mustChangePassword: false,
  };

  function createService() {
    const prisma = {
      leaveType: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      leaveRequest: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      chatbotPendingAction: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      employee: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      attendanceRecord: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      task: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      teamMember: {
        findMany: jest.fn(),
      },
    };
    const audit = { log: jest.fn() };
    const accessControl = {
      isAdmin: jest.fn().mockReturnValue(false),
      isManager: jest.fn().mockReturnValue(false),
      teamEmployeeIds: jest.fn().mockResolvedValue([]),
      managedTeamIds: jest.fn().mockResolvedValue([]),
      isDepartmentHead: jest.fn().mockResolvedValue(false),
    };
    const systemSettings = { getSettings: jest.fn() };
    const leaveRequests = { create: jest.fn(), cancel: jest.fn() };
    const tasks = { updateStatus: jest.fn() };
    const timesheets = { forEmployees: jest.fn() };

    return {
      service: new ChatbotToolsService(
        prisma as unknown as PrismaService,
        audit as unknown as AuditService,
        accessControl as unknown as AccessControlService,
        systemSettings as unknown as SystemSettingsService,
        leaveRequests as unknown as LeaveRequestsService,
        {} as LeaveBalancesService,
        tasks as unknown as TasksService,
        timesheets as unknown as TimesheetService,
      ),
      prisma,
      audit,
      accessControl,
      systemSettings,
      leaveRequests,
      tasks,
      timesheets,
    };
  }

  const settings = {
    workWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
    timezoneOffsetMinutes: 420,
  };
  const selfUser: AuthUser = {
    ...user,
    permissions: [
      "EMPLOYEE_READ_SELF",
      "ATTENDANCE_READ_SELF",
      "TASK_READ_SELF",
    ],
  };

  describe("personal data tools", () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date("2026-11-19T03:00:00.000Z"));
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it("offers them only with the matching self permission", () => {
      const { service } = createService();
      const names = (permissions: string[]) =>
        service
          .availableTools({ ...user, permissions })
          .map((tool) => tool.name);

      expect(names(selfUser.permissions)).toEqual(
        expect.arrayContaining([
          "get_my_attendance_summary",
          "get_my_projects",
          "get_my_skills",
          "get_my_team_members",
          "get_my_task_stats",
        ]),
      );
      expect(
        service
          .availableTools({ ...selfUser, employeeId: undefined })
          .map((tool) => tool.name),
      ).not.toContain("get_my_attendance_summary");
    });

    it("counts late days, early leaves and absences in the month", async () => {
      const { service, prisma, systemSettings, timesheets } = createService();
      systemSettings.getSettings.mockResolvedValue(settings);
      timesheets.forEmployees.mockResolvedValue(
        new Map([[10, { attendanceDays: 2, lateMinutes: 25, workedMinutes: 900 }]]),
      );
      const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
      prisma.attendanceRecord.findMany.mockResolvedValue([
        { workDate: day("2026-11-02"), recordType: "CHECK_IN", attendanceStatus: "LATE" },
        { workDate: day("2026-11-02"), recordType: "CHECK_OUT", attendanceStatus: "EARLY_OUT" },
        { workDate: day("2026-11-03"), recordType: "CHECK_IN", attendanceStatus: "ON_TIME" },
      ]);
      prisma.leaveRequest.findMany.mockResolvedValue([
        { startDate: day("2026-11-04"), endDate: day("2026-11-17") },
      ]);
      prisma.employee.findUnique.mockResolvedValue({ hireDate: null });
      prisma.attendanceRecord.findFirst.mockResolvedValue({
        workDate: day("2026-11-02"),
      });

      const result = await service.executeTool(
        7,
        { id: "c", toolName: "get_my_attendance_summary", arguments: {} },
        selfUser,
      );

      expect(result.data).toEqual(
        expect.objectContaining({
          year: 2026,
          month: 11,
          lateCount: 1,
          lateMinutes: 25,
          earlyLeaveCount: 1,
          workedHours: 15,
          // 18/11 is absent; 19/11 is today and not counted yet.
          absentDates: ["2026-11-18"],
        }),
      );
    });

    it("does not count days before attendance was tracked as absences", async () => {
      const { service, prisma, systemSettings, timesheets } = createService();
      systemSettings.getSettings.mockResolvedValue(settings);
      timesheets.forEmployees.mockResolvedValue(new Map());
      const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
      prisma.attendanceRecord.findMany.mockResolvedValue([
        { workDate: day("2026-11-17"), recordType: "CHECK_IN", attendanceStatus: "ON_TIME" },
      ]);
      prisma.leaveRequest.findMany.mockResolvedValue([]);
      prisma.employee.findUnique.mockResolvedValue({ hireDate: day("2020-01-06") });
      prisma.attendanceRecord.findFirst.mockResolvedValue({
        workDate: day("2026-11-17"),
      });

      const result = await service.executeTool(
        7,
        { id: "c", toolName: "get_my_attendance_summary", arguments: {} },
        selfUser,
      );

      expect(result.data).toEqual(
        expect.objectContaining({ absentDates: ["2026-11-18"] }),
      );
    });

    it("lists team members with names and positions only", async () => {
      const { service, prisma } = createService();
      prisma.teamMember.findMany.mockResolvedValue([
        {
          team: {
            name: "Nhóm Backend",
            lead: { id: 3, fullName: "Vũ Anh Tuấn" },
            members: [
              { role: "LEAD", employee: { id: 3, fullName: "Vũ Anh Tuấn", position: { name: "Trưởng nhóm" } } },
              { role: "MEMBER", employee: { id: 10, fullName: "Lê Bảo Ngọc", position: null } },
            ],
          },
        },
      ]);

      const result = await service.executeTool(
        7,
        { id: "c", toolName: "get_my_team_members", arguments: {} },
        selfUser,
      );

      expect(result.data).toEqual({
        items: [
          {
            teamName: "Nhóm Backend",
            leadName: "Vũ Anh Tuấn",
            memberCount: 2,
            members: [
              { fullName: "Vũ Anh Tuấn", positionName: "Trưởng nhóm", isLead: true, isMe: false },
              { fullName: "Lê Bảo Ngọc", positionName: null, isLead: false, isMe: true },
            ],
          },
        ],
      });
    });

    it("splits completed tasks into on time and late", async () => {
      const { service, prisma, systemSettings } = createService();
      systemSettings.getSettings.mockResolvedValue(settings);
      prisma.task.findMany.mockResolvedValue([
        { dueDate: new Date("2026-11-10T00:00:00.000Z"), completedAt: new Date("2026-11-10T09:00:00.000Z"), actualHours: 6 },
        { dueDate: new Date("2026-11-05T00:00:00.000Z"), completedAt: new Date("2026-11-07T09:00:00.000Z"), actualHours: 10.5 },
      ]);
      prisma.task.count.mockResolvedValueOnce(4).mockResolvedValueOnce(1);

      const result = await service.executeTool(
        7,
        { id: "c", toolName: "get_my_task_stats", arguments: { month: 11 } },
        selfUser,
      );

      expect(result.data).toEqual({
        year: 2026,
        month: 11,
        completedCount: 2,
        onTimeCount: 1,
        lateCount: 1,
        onTimeRate: 50,
        assignedCount: 4,
        overdueOpenCount: 1,
        actualHours: 16.5,
      });
    });
  });

  describe("update_task_status_draft", () => {
    const taskUser: AuthUser = {
      ...user,
      permissions: ["TASK_READ_SELF", "TASK_UPDATE_STATUS"],
    };

    it("offers the tool only to employees who can update a status", () => {
      const { service } = createService();
      const names = (auth: AuthUser) =>
        service.availableTools(auth).map((tool) => tool.name);

      expect(names(taskUser)).toContain("update_task_status_draft");
      expect(names(user)).not.toContain("update_task_status_draft");
    });

    it("prepares a pending action instead of updating the task", async () => {
      const { service, prisma, audit, tasks } = createService();
      const expiresAt = new Date("2026-07-01T10:30:00.000Z");

      prisma.task.findMany.mockResolvedValue([
        {
          id: 42,
          parentTaskId: 40,
          title: "Viết tài liệu API",
          status: "TODO",
          project: { name: "HRGenie" },
        },
      ]);
      prisma.chatbotPendingAction.create.mockResolvedValue({
        id: 77,
        expiresAt,
      });

      const result = await service.executeTool(
        7,
        {
          id: "call_1",
          toolName: "update_task_status_draft",
          arguments: { taskTitle: "tài liệu API", status: "IN_PROGRESS" },
        },
        taskUser,
      );

      expect(result.success).toBe(true);
      expect(result.pendingAction).toEqual(
        expect.objectContaining({
          actionId: 77,
          type: ChatbotActionType.UPDATE_TASK_STATUS,
          summary: expect.objectContaining({
            taskId: 42,
            currentStatus: "TODO",
            status: "IN_PROGRESS",
          }),
        }),
      );
      expect(tasks.updateStatus).not.toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "CHATBOT_CREATE_PENDING_ACTION" }),
      );
    });

    it("asks again when the keyword matches more than one task", async () => {
      const { service, prisma } = createService();
      prisma.task.findMany.mockResolvedValue([
        { id: 42, parentTaskId: 40, title: "Viết tài liệu API", status: "TODO" },
        { id: 43, parentTaskId: 40, title: "Viết tài liệu DB", status: "TODO" },
      ]);

      const result = await service.executeTool(
        7,
        {
          id: "call_1",
          toolName: "update_task_status_draft",
          arguments: { taskTitle: "viết tài liệu", status: "DONE" },
        },
        taskUser,
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("CHATBOT_TASK_AMBIGUOUS");
    });

    it("refuses a team-level task because its status is derived", async () => {
      const { service, prisma } = createService();
      prisma.task.findMany.mockResolvedValue([
        { id: 40, parentTaskId: null, title: "Tài liệu hệ thống", status: "TODO" },
      ]);

      const result = await service.executeTool(
        7,
        {
          id: "call_1",
          toolName: "update_task_status_draft",
          arguments: { taskId: 40, status: "DONE" },
        },
        taskUser,
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("ROOT_TASK_STATUS_IS_DERIVED");
    });

    it("updates the task only after the user confirms", async () => {
      const { service, prisma, tasks } = createService();
      const action = {
        id: 77,
        conversationId: 7,
        userId: 1,
        actionType: ChatbotActionType.UPDATE_TASK_STATUS,
        status: ChatbotActionStatus.PENDING,
        payload: {
          taskId: 42,
          taskTitle: "Viết tài liệu API",
          currentStatus: "TODO",
          status: "DONE",
          note: "Cập nhật từ HRGenie",
        },
        expiresAt: new Date(Date.now() + 60_000),
      };

      prisma.chatbotPendingAction.findFirst.mockResolvedValue(action);
      prisma.chatbotPendingAction.updateMany.mockResolvedValue({ count: 1 });
      prisma.chatbotPendingAction.update.mockResolvedValueOnce({
        ...action,
        status: ChatbotActionStatus.EXECUTED,
      });
      tasks.updateStatus.mockResolvedValue({
        id: 42,
        title: "Viết tài liệu API",
        status: "DONE",
      });

      await expect(service.confirmAction(77, taskUser)).resolves.toEqual({
        conversationId: 7,
        reply: expect.stringContaining("hoàn thành"),
        data: { taskId: 42, status: "DONE" },
      });

      expect(tasks.updateStatus).toHaveBeenCalledWith(
        42,
        { status: "DONE", note: "Cập nhật từ HRGenie" },
        taskUser,
        undefined,
      );
    });
  });

  it("creates only a pending action for create_leave_request_draft", async () => {
    const { service, prisma, audit, leaveRequests, systemSettings } = createService();
    const expiresAt = new Date("2026-07-01T10:30:00.000Z");

    systemSettings.getSettings.mockResolvedValue({
      workWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
    });
    prisma.leaveType.findFirst.mockResolvedValue({
      id: 3,
      code: "ANNUAL_LEAVE",
      name: "Nghỉ phép năm",
      isActive: true,
    });
    prisma.leaveRequest.findFirst.mockResolvedValue(null);
    prisma.chatbotPendingAction.create.mockResolvedValue({
      id: 99,
      expiresAt,
    });

    const result = await service.executeTool(
      7,
      {
        id: "call_1",
        toolName: "create_leave_request_draft",
        arguments: {
          leaveTypeCode: "ANNUAL_LEAVE",
          startDate: "2026-07-02",
          endDate: "2026-07-02",
          reason: "Có việc gia đình",
        },
      },
      user,
    );

    expect(result.success).toBe(true);
    expect(result.pendingAction).toEqual(
      expect.objectContaining({
        actionId: 99,
        type: ChatbotActionType.SUBMIT_LEAVE_REQUEST,
      }),
    );
    expect(prisma.chatbotPendingAction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 7,
        userId: 1,
        actionType: ChatbotActionType.SUBMIT_LEAVE_REQUEST,
        payload: expect.objectContaining({
          leaveTypeId: 3,
          startDate: "2026-07-02",
          endDate: "2026-07-02",
          totalDays: 1,
        }),
      }),
    });
    expect(leaveRequests.create).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CHATBOT_CREATE_PENDING_ACTION",
        entityType: "ChatbotPendingAction",
        entityId: 99,
      }),
    );
  });

  it("returns birthday list without birth year or age", async () => {
    const { service, prisma, systemSettings } = createService();
    const birthdayUser: AuthUser = {
      ...user,
      permissions: ["EMPLOYEE_READ_SELF"],
    };

    systemSettings.getSettings.mockResolvedValue({ timezoneOffsetMinutes: 420 });
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 10,
        fullName: "Nguyen Van A",
        birthDate: new Date("1996-07-20T00:00:00.000Z"),
        department: { name: "Engineering" },
      },
    ]);

    const result = await service.executeTool(
      7,
      {
        id: "call_1",
        toolName: "get_employee_birthdays",
        arguments: { month: 7, year: 2026 },
      },
      birthdayUser,
    );

    expect(result.success).toBe(true);
    expect(result.pendingAction).toBeUndefined();
    expect(prisma.chatbotPendingAction.create).not.toHaveBeenCalled();
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            employeeId: "10",
            fullName: "Nguyen Van A",
            birthday: "20/07",
          }),
        ],
      }),
    );
    expect(JSON.stringify(result.data)).not.toContain("1996");
    expect(JSON.stringify(result.data).toLowerCase()).not.toContain("age");
  });

  it("confirms then executes a pending leave action", async () => {
    const { service, prisma, audit, leaveRequests } = createService();
    const action = {
      id: 99,
      conversationId: 7,
      userId: 1,
      actionType: ChatbotActionType.SUBMIT_LEAVE_REQUEST,
      status: ChatbotActionStatus.PENDING,
      payload: {
        leaveTypeId: 3,
        startDate: "2026-07-02",
        endDate: "2026-07-02",
        reason: "Có việc gia đình",
      },
      expiresAt: new Date(Date.now() + 60_000),
    };
    const leaveRequest = { id: 123, status: LeaveRequestStatus.PENDING };

    prisma.chatbotPendingAction.findFirst.mockResolvedValue(action);
    prisma.chatbotPendingAction.updateMany.mockResolvedValue({ count: 1 });
    prisma.chatbotPendingAction.update
      .mockResolvedValueOnce({
        ...action,
        status: ChatbotActionStatus.EXECUTED,
        result: leaveRequest,
      });
    leaveRequests.create.mockResolvedValue(leaveRequest);

    await expect(service.confirmAction(99, user)).resolves.toEqual({
      conversationId: 7,
      reply: expect.any(String),
      data: {
        leaveRequestId: 123,
        status: LeaveRequestStatus.PENDING,
      },
    });

    expect(leaveRequests.create).toHaveBeenCalledWith(
      {
        leaveTypeId: 3,
        startDate: "2026-07-02",
        endDate: "2026-07-02",
        reason: "Có việc gia đình",
      },
      user,
      undefined,
    );
    expect(prisma.chatbotPendingAction.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 99,
        userId: 1,
        status: ChatbotActionStatus.PENDING,
      }),
      data: expect.objectContaining({
        status: ChatbotActionStatus.CONFIRMED,
      }),
    });
    expect(prisma.chatbotPendingAction.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: expect.objectContaining({
        status: ChatbotActionStatus.EXECUTED,
      }),
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CHATBOT_CONFIRM_ACTION" }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CHATBOT_EXECUTE_ACTION" }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CREATE_LEAVE_REQUEST_BY_CHATBOT" }),
    );
  });

  it("does not execute expired pending actions", async () => {
    const { service, prisma, leaveRequests } = createService();
    prisma.chatbotPendingAction.findFirst.mockResolvedValue({
      id: 99,
      conversationId: 7,
      userId: 1,
      actionType: ChatbotActionType.SUBMIT_LEAVE_REQUEST,
      status: ChatbotActionStatus.PENDING,
      payload: {},
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(service.confirmAction(99, user)).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: "CHATBOT_ACTION_EXPIRED",
      }),
    });

    expect(prisma.chatbotPendingAction.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: { status: ChatbotActionStatus.EXPIRED },
    });
    expect(leaveRequests.create).not.toHaveBeenCalled();
  });

  it("does not let another user confirm an action", async () => {
    const { service, prisma, leaveRequests } = createService();
    prisma.chatbotPendingAction.findFirst.mockResolvedValue(null);

    await expect(service.confirmAction(99, user)).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: "CHATBOT_ACTION_NOT_FOUND",
      }),
    });

    expect(prisma.chatbotPendingAction.findFirst).toHaveBeenCalledWith({
      where: { id: 99, userId: 1 },
    });
    expect(leaveRequests.create).not.toHaveBeenCalled();
  });

  it("confirms then executes a pending cancel leave action", async () => {
    const { service, prisma, audit, leaveRequests } = createService();
    const action = {
      id: 100,
      conversationId: 7,
      userId: 1,
      actionType: ChatbotActionType.CANCEL_LEAVE_REQUEST,
      status: ChatbotActionStatus.PENDING,
      payload: { leaveRequestId: 123 },
      expiresAt: new Date(Date.now() + 60_000),
    };
    const leaveRequest = { id: 123, status: LeaveRequestStatus.CANCELLED };

    prisma.chatbotPendingAction.findFirst.mockResolvedValue(action);
    prisma.chatbotPendingAction.updateMany.mockResolvedValue({ count: 1 });
    prisma.chatbotPendingAction.update.mockResolvedValue({
      ...action,
      status: ChatbotActionStatus.EXECUTED,
      result: leaveRequest,
    });
    leaveRequests.cancel.mockResolvedValue(leaveRequest);

    await expect(service.confirmAction(100, user)).resolves.toEqual({
      conversationId: 7,
      reply: expect.any(String),
      data: {
        leaveRequestId: 123,
        status: LeaveRequestStatus.CANCELLED,
      },
    });

    expect(leaveRequests.cancel).toHaveBeenCalledWith(123, user, undefined);
    expect(leaveRequests.create).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CANCEL_LEAVE_REQUEST_BY_CHATBOT" }),
    );
  });

  it("cancels a pending chatbot action", async () => {
    const { service, prisma, audit } = createService();
    const action = {
      id: 99,
      conversationId: 7,
      userId: 1,
      actionType: ChatbotActionType.SUBMIT_LEAVE_REQUEST,
      status: ChatbotActionStatus.PENDING,
      payload: {},
      expiresAt: new Date(Date.now() + 60_000),
    };

    prisma.chatbotPendingAction.findFirst.mockResolvedValue(action);
    prisma.chatbotPendingAction.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.cancelAction(99, user, "No need")).resolves.toEqual({
      conversationId: 7,
      reply: expect.any(String),
      data: { actionId: 99, status: ChatbotActionStatus.CANCELLED },
    });

    expect(prisma.chatbotPendingAction.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 99,
        userId: 1,
        status: ChatbotActionStatus.PENDING,
      }),
      data: expect.objectContaining({
        status: ChatbotActionStatus.CANCELLED,
      }),
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CHATBOT_CANCEL_ACTION" }),
    );
  });

  it("does not cancel an executed chatbot action", async () => {
    const { service, prisma } = createService();
    prisma.chatbotPendingAction.findFirst.mockResolvedValue({
      id: 99,
      conversationId: 7,
      userId: 1,
      actionType: ChatbotActionType.SUBMIT_LEAVE_REQUEST,
      status: ChatbotActionStatus.EXECUTED,
      payload: {},
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(service.cancelAction(99, user)).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: "CHATBOT_ACTION_NOT_PENDING",
      }),
    });

    expect(prisma.chatbotPendingAction.updateMany).not.toHaveBeenCalled();
  });

  it("does not confirm a cancelled chatbot action", async () => {
    const { service, prisma, leaveRequests } = createService();
    prisma.chatbotPendingAction.findFirst.mockResolvedValue({
      id: 99,
      conversationId: 7,
      userId: 1,
      actionType: ChatbotActionType.SUBMIT_LEAVE_REQUEST,
      status: ChatbotActionStatus.CANCELLED,
      payload: {},
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(service.confirmAction(99, user)).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: "CHATBOT_ACTION_NOT_PENDING",
      }),
    });

    expect(prisma.chatbotPendingAction.updateMany).not.toHaveBeenCalled();
    expect(leaveRequests.create).not.toHaveBeenCalled();
  });

  it("does not confirm an executed chatbot action again", async () => {
    const { service, prisma, leaveRequests } = createService();
    prisma.chatbotPendingAction.findFirst.mockResolvedValue({
      id: 99,
      conversationId: 7,
      userId: 1,
      actionType: ChatbotActionType.SUBMIT_LEAVE_REQUEST,
      status: ChatbotActionStatus.EXECUTED,
      payload: {},
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(service.confirmAction(99, user)).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: "CHATBOT_ACTION_NOT_PENDING",
      }),
    });

    expect(prisma.chatbotPendingAction.updateMany).not.toHaveBeenCalled();
    expect(leaveRequests.create).not.toHaveBeenCalled();
  });

  it("marks a claimed action as failed when execution fails", async () => {
    const { service, prisma, leaveRequests } = createService();
    const action = {
      id: 99,
      conversationId: 7,
      userId: 1,
      actionType: ChatbotActionType.SUBMIT_LEAVE_REQUEST,
      status: ChatbotActionStatus.PENDING,
      payload: {
        leaveTypeId: 3,
        startDate: "2026-07-02",
        endDate: "2026-07-02",
        reason: "Có việc gia đình",
      },
      expiresAt: new Date(Date.now() + 60_000),
    };

    prisma.chatbotPendingAction.findFirst.mockResolvedValue(action);
    prisma.chatbotPendingAction.updateMany.mockResolvedValue({ count: 1 });
    prisma.chatbotPendingAction.update.mockResolvedValue({
      ...action,
      status: ChatbotActionStatus.FAILED,
    });
    leaveRequests.create.mockRejectedValue(new Error("create failed"));

    await expect(service.confirmAction(99, user)).rejects.toThrow(
      "create failed",
    );

    expect(prisma.chatbotPendingAction.update).toHaveBeenCalledWith({
      where: { id: 99 },
      data: expect.objectContaining({
        status: ChatbotActionStatus.FAILED,
      }),
    });
  });
});
