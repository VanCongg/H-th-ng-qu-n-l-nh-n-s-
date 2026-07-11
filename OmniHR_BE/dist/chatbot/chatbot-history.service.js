"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatbotHistoryService = void 0;
const common_1 = require("@nestjs/common");
const api_error_1 = require("../common/api-error");
const prisma_service_1 = require("../prisma/prisma.service");
let ChatbotHistoryService = class ChatbotHistoryService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getOrCreateConversation(userId, conversationId, firstMessage) {
        if (conversationId) {
            const conversation = await this.prisma.chatbotConversation.findFirst({
                where: { id: conversationId, userId, deletedAt: null },
            });
            if (!conversation) {
                throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Conversation not found", "CHATBOT_CONVERSATION_NOT_FOUND");
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
    async addMessage(conversationId, role, content, metadata) {
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
    async recentHistory(conversationId, limit = 12) {
        const messages = await this.prisma.chatbotMessage.findMany({
            where: { conversationId },
            orderBy: { createdAt: "desc" },
            take: limit,
        });
        return messages.reverse().map((message) => ({
            role: message.role.toLowerCase(),
            content: message.content,
        }));
    }
    async listConversations(userId) {
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
    async listMessages(userId, conversationId) {
        await this.ensureConversationOwner(userId, conversationId);
        return this.prisma.chatbotMessage.findMany({
            where: { conversationId },
            orderBy: { createdAt: "asc" },
        });
    }
    async ensureConversationOwner(userId, conversationId) {
        const conversation = await this.prisma.chatbotConversation.findFirst({
            where: { id: conversationId, userId, deletedAt: null },
            select: { id: true },
        });
        if (!conversation) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Conversation not found", "CHATBOT_CONVERSATION_NOT_FOUND");
        }
    }
    expireStaleActions(userId) {
        return this.prisma.chatbotPendingAction.updateMany({
            where: {
                userId,
                status: "PENDING",
                expiresAt: { lte: new Date() },
            },
            data: { status: "EXPIRED" },
        });
    }
    titleFrom(message) {
        const normalized = message.trim().replace(/\s+/g, " ");
        if (!normalized) {
            return "HRGenie";
        }
        return normalized.length <= 80
            ? normalized
            : `${normalized.slice(0, 77)}...`;
    }
};
exports.ChatbotHistoryService = ChatbotHistoryService;
exports.ChatbotHistoryService = ChatbotHistoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ChatbotHistoryService);
//# sourceMappingURL=chatbot-history.service.js.map