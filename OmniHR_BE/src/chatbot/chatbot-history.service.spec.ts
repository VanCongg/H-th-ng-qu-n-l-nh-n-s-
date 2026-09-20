import { ChatbotMessageRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ChatbotHistoryService } from "./chatbot-history.service";

describe("ChatbotHistoryService", () => {
  it("keeps content flagged sensitive out of the history sent to the planner", async () => {
    const prisma = {
      chatbotMessage: {
        findMany: jest.fn().mockResolvedValue([
          {
            role: ChatbotMessageRole.ASSISTANT,
            content: "Số dư phép còn lại: 12 ngày",
            metadata: { sensitive: true },
          },
          {
            role: ChatbotMessageRole.USER,
            content: "Tôi còn bao nhiêu ngày phép?",
            metadata: null,
          },
        ]),
      },
    };
    const service = new ChatbotHistoryService(
      prisma as unknown as PrismaService,
    );

    const history = await service.recentHistory(7, 12);

    expect(history).toEqual([
      { role: "user", content: "Tôi còn bao nhiêu ngày phép?" },
      {
        role: "assistant",
        content: expect.stringContaining("đã được ẩn") as unknown as string,
      },
    ]);
    expect(JSON.stringify(history)).not.toContain("12 ngày");
  });
});
