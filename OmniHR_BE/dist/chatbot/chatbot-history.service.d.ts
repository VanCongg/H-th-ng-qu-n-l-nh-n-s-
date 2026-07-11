import { ChatbotMessageRole, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ChatbotHistoryItem } from "./types/chatbot.types";
export declare class ChatbotHistoryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getOrCreateConversation(userId: number, conversationId: number | undefined, firstMessage: string): Promise<{
        deletedAt: Date | null;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        userId: number;
        title: string | null;
    }>;
    addMessage(conversationId: number, role: ChatbotMessageRole, content: string, metadata?: Prisma.InputJsonValue): Promise<{
        role: import(".prisma/client").$Enums.ChatbotMessageRole;
        id: number;
        createdAt: Date;
        content: string;
        metadata: Prisma.JsonValue | null;
        conversationId: number;
    }>;
    recentHistory(conversationId: number, limit?: number): Promise<ChatbotHistoryItem[]>;
    listConversations(userId: number): Promise<({
        messages: {
            role: import(".prisma/client").$Enums.ChatbotMessageRole;
            id: number;
            createdAt: Date;
            content: string;
            metadata: Prisma.JsonValue | null;
            conversationId: number;
        }[];
        actions: {
            id: number;
            createdAt: Date;
            userId: number;
            result: Prisma.JsonValue | null;
            status: import(".prisma/client").$Enums.ChatbotActionStatus;
            expiresAt: Date;
            cancelledAt: Date | null;
            conversationId: number;
            actionType: import(".prisma/client").$Enums.ChatbotActionType;
            payload: Prisma.JsonValue;
            confirmedAt: Date | null;
        }[];
    } & {
        deletedAt: Date | null;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        userId: number;
        title: string | null;
    })[]>;
    listMessages(userId: number, conversationId: number): Promise<{
        role: import(".prisma/client").$Enums.ChatbotMessageRole;
        id: number;
        createdAt: Date;
        content: string;
        metadata: Prisma.JsonValue | null;
        conversationId: number;
    }[]>;
    ensureConversationOwner(userId: number, conversationId: number): Promise<void>;
    private expireStaleActions;
    private titleFrom;
}
