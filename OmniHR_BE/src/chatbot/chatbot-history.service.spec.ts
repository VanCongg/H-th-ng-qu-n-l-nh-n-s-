import { ChatbotMessageRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ChatbotHistoryService } from "./chatbot-history.service";

describe("ChatbotHistoryService", () => {
  it("keeps payslip content out of the history sent to the planner", async () => {
    const prisma = {
      chatbotMessage: {
        findMany: jest.fn().mockResolvedValue([
          {
            role: ChatbotMessageRole.ASSISTANT,
            content: "Thực lĩnh: 18.500.000 đ",
            metadata: { sensitive: true },
          },
          {
            role: ChatbotMessageRole.USER,
            content: "Lương tháng trước của tôi bao nhiêu?",
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
      { role: "user", content: "Lương tháng trước của tôi bao nhiêu?" },
      {
        role: "assistant",
        content: expect.stringContaining("đã được ẩn") as unknown as string,
      },
    ]);
    expect(JSON.stringify(history)).not.toContain("18.500.000");
  });
});
