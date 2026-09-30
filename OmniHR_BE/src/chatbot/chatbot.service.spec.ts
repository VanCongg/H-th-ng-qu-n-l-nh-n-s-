import { ChatbotMessageRole } from "@prisma/client";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { ChatbotAiClientService } from "./chatbot-ai-client.service";
import { ChatbotHistoryService } from "./chatbot-history.service";
import { ChatbotService } from "./chatbot.service";
import { ChatbotToolsService } from "./chatbot-tools.service";

describe("ChatbotService", () => {
  const user: AuthUser = {
    id: 1,
    username: "employee",
    email: "employee@example.com",
    roles: ["EMPLOYEE"],
    permissions: ["LEAVE_READ_SELF"],
    employeeId: 10,
    mustChangePassword: false,
  };

  function createService(redisEval?: jest.Mock) {
    const prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue({
          departmentId: 2,
          positionId: 3,
        }),
      },
    };
    const history = {
      getOrCreateConversation: jest.fn().mockResolvedValue({
        id: 7,
        userId: 1,
      }),
      addMessage: jest.fn(),
      recentHistory: jest.fn().mockResolvedValue([]),
      listConversations: jest.fn(),
      listMessages: jest.fn(),
    };
    const aiClient = {
      plan: jest.fn().mockResolvedValue({
        type: "answer",
        reply: "Xin chào",
        toolCalls: [],
        needConfirmation: false,
        confidence: 0.8,
        citations: [],
      }),
    };
    const tools = {
      availableTools: jest.fn().mockReturnValue([]),
      executeTool: jest.fn(),
      confirmAction: jest.fn(),
      cancelAction: jest.fn(),
    };
    const systemSettings = {
      getSettings: jest.fn().mockResolvedValue({
        timezoneOffsetMinutes: 420,
      }),
    };
    // No eval mock means "no Redis", which exercises the in-process fallback.
    const redis = {
      isReady: () => Boolean(redisEval),
      getClient: () => (redisEval ? { eval: redisEval } : null),
    };

    return {
      service: new ChatbotService(
        prisma as unknown as PrismaService,
        history as unknown as ChatbotHistoryService,
        aiClient as unknown as ChatbotAiClientService,
        tools as unknown as ChatbotToolsService,
        systemSettings as unknown as SystemSettingsService,
        redis as unknown as RedisService,
      ),
      history,
      aiClient,
      tools,
    };
  }

  afterEach(() => {
    delete process.env.CHATBOT_MAX_MESSAGE_LENGTH;
    delete process.env.CHATBOT_HISTORY_LIMIT;
    delete process.env.CHATBOT_RATE_LIMIT_TTL_SECONDS;
    delete process.env.CHATBOT_RATE_LIMIT_MAX;
  });

  it("creates conversation and stores user/assistant messages", async () => {
    const { service, history, aiClient } = createService();

    await expect(
      service.sendMessage({ message: "Xin chào HRGenie" }, user),
    ).resolves.toEqual({
      conversationId: 7,
      reply: "Xin chào",
      messages: [],
      pendingAction: undefined,
    });

    expect(history.getOrCreateConversation).toHaveBeenCalledWith(
      1,
      undefined,
      "Xin chào HRGenie",
    );
    expect(history.addMessage).toHaveBeenCalledWith(
      7,
      ChatbotMessageRole.USER,
      "Xin chào HRGenie",
    );
    expect(history.addMessage).toHaveBeenCalledWith(
      7,
      ChatbotMessageRole.ASSISTANT,
      "Xin chào",
      expect.objectContaining({
        aiPlanType: "answer",
        needConfirmation: false,
      }),
    );
    expect(aiClient.plan).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "7",
        message: "Xin chào HRGenie",
        userContext: expect.objectContaining({
          userId: 1,
          employeeId: 10,
          departmentId: 2,
          positionId: 3,
        }),
      }),
    );
  });

  it("lists recent leave with half days and pending cancellations", async () => {
    const { service, aiClient, tools } = createService();
    aiClient.plan.mockResolvedValue({
      type: "tool_call",
      reply: "",
      toolCalls: [{ id: "call_1", toolName: "get_my_leave_requests", arguments: {} }],
      needConfirmation: false,
      confidence: 0.9,
      citations: [],
    });
    tools.executeTool.mockResolvedValue({
      toolName: "get_my_leave_requests",
      success: true,
      data: [
        {
          leaveType: { name: "Phép năm" },
          startDate: "2026-10-09",
          endDate: "2026-10-09",
          halfDay: "AFTERNOON",
          status: "PENDING",
        },
        {
          leaveType: { name: "Phép năm" },
          startDate: "2026-10-19",
          endDate: "2026-10-21",
          status: "APPROVED",
          cancelRequestedAt: "2026-09-26T03:00:00.000Z",
        },
      ],
    });

    const result = await service.sendMessage({ message: "Đơn nghỉ của tôi" }, user);

    expect(result.reply).toContain("(buổi chiều)");
    expect(result.reply).toContain("đang chờ quản lý duyệt yêu cầu hủy");
    expect(result.reply.split("\n")).toHaveLength(3);
  });

  describe("what is kept out of the history sent to the AI", () => {
    async function send(toolName: string, data: unknown) {
      const { service, aiClient, tools, history } = createService();
      aiClient.plan.mockResolvedValue({
        type: "tool_call",
        reply: "",
        toolCalls: [{ id: "call_1", toolName, arguments: {} }],
        needConfirmation: false,
        confidence: 0.9,
        citations: [],
      });
      tools.executeTool.mockResolvedValue({ toolName, success: true, data });
      await service.sendMessage({ message: "Cho tôi xem" }, user);
      return history.addMessage.mock.calls as Array<
        [number, ChatbotMessageRole, string, Record<string, unknown>?]
      >;
    }

    it("flags personal records sensitive, both the raw result and the reply", async () => {
      const calls = await send("get_my_leave_balance", []);

      const tool = calls.find(([, role]) => role === ChatbotMessageRole.TOOL);
      const assistant = calls.find(([, role]) => role === ChatbotMessageRole.ASSISTANT);
      expect(tool?.[3]).toEqual(expect.objectContaining({ sensitive: true }));
      expect(assistant?.[3]).toEqual(expect.objectContaining({ sensitive: true }));
    });

    it("keeps task replies readable so a follow-up can name the task", async () => {
      const calls = await send("get_my_tasks", []);

      const assistant = calls.find(([, role]) => role === ChatbotMessageRole.ASSISTANT);
      expect(assistant?.[3]).toEqual(expect.objectContaining({ sensitive: false }));
    });
  });

  describe("who is my manager", () => {
    async function ask(data: unknown) {
      const { service, aiClient, tools } = createService();
      aiClient.plan.mockResolvedValue({
        type: "tool_call",
        reply: "",
        toolCalls: [{ id: "call_1", toolName: "get_my_manager", arguments: {} }],
        needConfirmation: false,
        confidence: 0.9,
        citations: [],
      });
      tools.executeTool.mockResolvedValue({ toolName: "get_my_manager", success: true, data });
      return (await service.sendMessage({ message: "Quản lý của tôi là ai?" }, user)).reply;
    }

    it("names the direct manager and the department head", async () => {
      const reply = await ask({
        departmentName: "Công nghệ thông tin",
        positionName: "UI/UX",
        teamName: "Nhóm Sản phẩm",
        directManager: { fullName: "Phạm Hồng Sơn", positionName: "Trưởng nhóm sản phẩm" },
        departmentHead: { fullName: "Nguyễn Hoàng Minh", positionName: "Trưởng phòng" },
      });

      expect(reply).toContain("Quản lý trực tiếp: Phạm Hồng Sơn - Trưởng nhóm sản phẩm");
      expect(reply).toContain("Trưởng phòng: Nguyễn Hoàng Minh");
      expect(reply).toContain("Nhóm: Nhóm Sản phẩm");
    });

    it("says so when there is no direct manager yet", async () => {
      const reply = await ask({
        departmentName: "Công nghệ thông tin",
        directManager: null,
        departmentHead: { fullName: "Nguyễn Hoàng Minh" },
      });

      expect(reply).toContain("chưa có (bạn chưa thuộc nhóm nào)");
      expect(reply).toContain("Trưởng phòng: Nguyễn Hoàng Minh");
    });
  });

  describe("tasks due soon", () => {
    function askAboutDueTasks(data: unknown) {
      const created = createService();
      created.aiClient.plan.mockResolvedValue({
        type: "tool_call",
        reply: "",
        toolCalls: [{ id: "call_1", toolName: "get_my_upcoming_tasks", arguments: { days: 7 } }],
        needConfirmation: false,
        confidence: 0.9,
        citations: [],
      });
      created.tools.executeTool.mockResolvedValue({ toolName: "get_my_upcoming_tasks", success: true, data });
      return created.service.sendMessage({ message: "Tuần này tôi có task nào đến hạn không?" }, user);
    }

    it("says nothing is due this week instead of claiming there is no work, and names the next task", async () => {
      const result = await askAboutDueTasks({
        mode: "upcoming",
        days: 7,
        items: [],
        nextTask: { title: "Viết Terraform", dueDate: "2026-10-09" }
      });

      expect(result.reply).toContain("không có task nào đến hạn trong 7 ngày tới");
      expect(result.reply).toContain("Viết Terraform");
      expect(result.reply).not.toContain("không có task mở");
    });

    it("lists what is due under a heading that says the window", async () => {
      const result = await askAboutDueTasks({
        mode: "upcoming",
        days: 7,
        items: [{ title: "Giám sát dịch vụ", status: "IN_PROGRESS", dueDate: "2026-09-30" }],
        nextTask: null
      });

      expect(result.reply).toContain("Các task đến hạn trong 7 ngày tới của bạn");
      expect(result.reply).toContain("Giám sát dịch vụ");
    });
  });

  it("rejects blank messages before creating a conversation", async () => {
    const { service, history, aiClient } = createService();

    await expect(service.sendMessage({ message: "   " }, user)).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: "CHATBOT_MESSAGE_EMPTY",
      }),
    });

    expect(history.getOrCreateConversation).not.toHaveBeenCalled();
    expect(aiClient.plan).not.toHaveBeenCalled();
  });

  it("rejects too long messages before calling the AI service", async () => {
    process.env.CHATBOT_MAX_MESSAGE_LENGTH = "5";
    const { service, history, aiClient } = createService();

    await expect(
      service.sendMessage({ message: "123456" }, user),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: "CHATBOT_MESSAGE_TOO_LONG",
      }),
    });

    expect(history.getOrCreateConversation).not.toHaveBeenCalled();
    expect(aiClient.plan).not.toHaveBeenCalled();
  });

  it("passes only the configured recent history limit to the AI service", async () => {
    process.env.CHATBOT_HISTORY_LIMIT = "3";
    const { service, history } = createService();

    await service.sendMessage({ message: "Xin chào HRGenie" }, user);

    expect(history.recentHistory).toHaveBeenCalledWith(7, 3);
  });

  it("rate limits chatbot messages per user before calling AI again", async () => {
    process.env.CHATBOT_RATE_LIMIT_TTL_SECONDS = "60";
    process.env.CHATBOT_RATE_LIMIT_MAX = "1";
    const { service, aiClient } = createService();

    await expect(
      service.sendMessage({ message: "Xin chào HRGenie" }, user),
    ).resolves.toBeDefined();
    await expect(
      service.sendMessage({ message: "Tôi còn bao nhiêu phép?" }, user),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: "CHATBOT_RATE_LIMITED",
      }),
    });

    expect(aiClient.plan).toHaveBeenCalledTimes(1);
  });

  it("rate limits from Redis so the budget is shared across instances", async () => {
    // Redis owns the decision here: the in-process bucket is still empty, so a
    // rejection can only have come from the shared counter.
    const redisEval = jest.fn().mockResolvedValue(0);
    const { service, aiClient } = createService(redisEval);

    await expect(
      service.sendMessage({ message: "Xin chào HRGenie" }, user),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: "CHATBOT_RATE_LIMITED",
      }),
    });

    expect(redisEval).toHaveBeenCalledTimes(1);
    expect(redisEval.mock.calls[0][2]).toBe("chatbot:ratelimit:1");
    expect(aiClient.plan).not.toHaveBeenCalled();
  });

  it("falls back to the in-process bucket when Redis errors", async () => {
    const redisEval = jest.fn().mockRejectedValue(new Error("connection lost"));
    const { service, aiClient } = createService(redisEval);

    await expect(
      service.sendMessage({ message: "Xin chào HRGenie" }, user),
    ).resolves.toBeDefined();

    expect(redisEval).toHaveBeenCalledTimes(1);
    expect(aiClient.plan).toHaveBeenCalledTimes(1);
  });
});
