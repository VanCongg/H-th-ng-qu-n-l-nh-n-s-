import { HttpStatus, Injectable } from "@nestjs/common";
import { ChatbotMessageRole, Prisma } from "@prisma/client";
import { ApiError } from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { ChatbotHistoryItem } from "./types/chatbot.types";

// Câu thay thế cho các tin nhắn có dữ liệu cá nhân khi gửi lịch sử sang AI.
const SENSITIVE_PLACEHOLDER =
  "[Dữ liệu cá nhân đã được ẩn khỏi ngữ cảnh gửi cho AI]";

/**
 * Lưu và đọc lịch sử chat (bảng chatbot_conversations, chatbot_messages).
 * Mỗi tin nhắn có role USER / ASSISTANT / TOOL; metadata ghi intent, tool đã
 * chạy và cờ `sensitive` để biết có được gửi sang AI hay không.
 */
@Injectable()
export class ChatbotHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Có conversationId: lấy hội thoại đó, nhưng chỉ khi nó thuộc về đúng người
   * dùng (người khác đoán id cũng nhận 404). Không có: tạo hội thoại mới,
   * tiêu đề lấy từ tin nhắn đầu tiên.
   */
  async getOrCreateConversation(
    userId: number,
    conversationId: number | undefined,
    firstMessage: string,
  ) {
    if (conversationId) {
      const conversation = await this.prisma.chatbotConversation.findFirst({
        where: { id: conversationId, userId, deletedAt: null },
      });
      if (!conversation) {
        throw new ApiError(
          HttpStatus.NOT_FOUND,
          "Conversation not found",
          "CHATBOT_CONVERSATION_NOT_FOUND",
        );
      }
      return conversation;
    }

    return this.prisma.chatbotConversation.create({
      data: {
        userId,
        title: this.titleFrom(firstMessage),
      },
    });
  }

  /** Lưu một tin nhắn và đẩy hội thoại lên đầu danh sách (cập nhật updatedAt). */
  async addMessage(
    conversationId: number,
    role: ChatbotMessageRole,
    content: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    const message = await this.prisma.chatbotMessage.create({
      data: {
        conversationId,
        role,
        content,
        metadata,
      },
    });
    await this.prisma.chatbotConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
    return message;
  }

  async recentHistory(
    conversationId: number,
    limit = 12,
  ): Promise<ChatbotHistoryItem[]> {
    // Lịch sử gửi sang AI làm ngữ cảnh (mặc định 12 tin gần nhất):
    // - bỏ hẳn các tin TOOL (kết quả thô của tool, AI không cần thấy);
    // - tin nào đánh dấu sensitive thì thay nội dung bằng SENSITIVE_PLACEHOLDER,
    //   nên dữ liệu nhân sự không bị gửi ra LLM bên ngoài.
    // Raw tool results are records for the app, not context for the planner:
    // the rendered assistant reply already says what the user was told.
    const messages = await this.prisma.chatbotMessage.findMany({
      where: { conversationId, role: { not: ChatbotMessageRole.TOOL } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return messages.reverse().map((message) => ({
      role: message.role.toLowerCase() as ChatbotHistoryItem["role"],
      content: this.isSensitive(message.metadata)
        ? SENSITIVE_PLACEHOLDER
        : message.content,
    }));
  }

  private isSensitive(metadata: Prisma.JsonValue) {
    return (
      typeof metadata === "object" &&
      metadata !== null &&
      !Array.isArray(metadata) &&
      metadata.sensitive === true
    );
  }

  /** Danh sách hội thoại kèm tin cuối và bản nháp đang chờ (nếu có). */
  async listConversations(userId: number) {
    await this.expireStaleActions(userId);
    return this.prisma.chatbotConversation.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      include: {
        actions: {
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  }

  async listMessages(userId: number, conversationId: number) {
    await this.ensureConversationOwner(userId, conversationId);
    return this.prisma.chatbotMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
  }

  async ensureConversationOwner(userId: number, conversationId: number) {
    const conversation = await this.prisma.chatbotConversation.findFirst({
      where: { id: conversationId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!conversation) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        "Conversation not found",
        "CHATBOT_CONVERSATION_NOT_FOUND",
      );
    }
  }

  // Bản nháp quá hạn (mặc định 30 phút) chuyển sang EXPIRED để không còn xác nhận được.
  private expireStaleActions(userId: number) {
    return this.prisma.chatbotPendingAction.updateMany({
      where: {
        userId,
        status: "PENDING",
        expiresAt: { lte: new Date() },
      },
      data: { status: "EXPIRED" },
    });
  }

  private titleFrom(message: string) {
    const normalized = message.trim().replace(/\s+/g, " ");
    if (!normalized) {
      return "HRGenie";
    }
    return normalized.length <= 80
      ? normalized
      : `${normalized.slice(0, 77)}...`;
  }
}
