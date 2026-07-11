import {
  ChatbotActionStatus,
  ChatbotActionType,
  LeaveRequestStatus,
} from "@prisma/client";
import { AuditService } from "../common/services/audit.service";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { AuthUser } from "../common/types";
import { LeaveRequestsService } from "../leave-requests/leave-requests.service";
import { PrismaService } from "../prisma/prisma.service";
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
      },
      attendanceRecord: {
        findMany: jest.fn(),
      },
      task: {
        findMany: jest.fn(),
      },
    };
    const audit = { log: jest.fn() };
    const systemSettings = { getSettings: jest.fn() };
    const leaveRequests = { create: jest.fn(), cancel: jest.fn() };

    return {
      service: new ChatbotToolsService(
        prisma as unknown as PrismaService,
        audit as unknown as AuditService,
        systemSettings as unknown as SystemSettingsService,
        leaveRequests as unknown as LeaveRequestsService,
      ),
      prisma,
      audit,
      systemSettings,
      leaveRequests,
    };
  }

  it("creates only a pending action for create_leave_request_draft", async () => {
    const { service, prisma, audit, leaveRequests } = createService();
    const expiresAt = new Date("2026-07-01T10:30:00.000Z");

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
