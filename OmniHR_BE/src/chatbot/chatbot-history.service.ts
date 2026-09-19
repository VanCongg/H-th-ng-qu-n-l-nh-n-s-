import { HttpStatus, Injectable } from "@nestjs/common";
import { ChatbotMessageRole, Prisma } from "@prisma/client";
import { ApiError } from "../common/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { ChatbotHistoryItem } from "./types/chatbot.types";

const SENSITIVE_PLACEHOLDER =
  "[Nội dung lương đã được ẩn khỏi ngữ cảnh gửi cho AI]";

@Injectable()
export class ChatbotHistoryService {
  constructor(private readonly prisma: PrismaService) {}

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
    const messages = await this.prisma.chatbotMessage.findMany({
      where: { conversationId },
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
