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
