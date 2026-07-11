import { AuthUser, RequestContext } from "../common/types";
import { ChatbotService } from "./chatbot.service";
import { ChatbotCancelActionDto } from "./dto/chatbot-cancel-action.dto";
import { ChatbotMessageDto } from "./dto/chatbot-message.dto";
export declare class ChatbotController {
    private readonly chatbotService;
    constructor(chatbotService: ChatbotService);
    sendMessage(dto: ChatbotMessageDto, user: AuthUser, context: RequestContext): Promise<import("./types/chatbot.types").ChatbotReply>;
    listConversations(user: AuthUser): Promise<({
        messages: {
            role: import(".prisma/client").$Enums.ChatbotMessageRole;
            id: number;
            createdAt: Date;
            content: string;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            conversationId: number;
        }[];
        actions: {
            id: number;
            createdAt: Date;
            userId: number;
            result: import("@prisma/client/runtime/library").JsonValue | null;
            status: import(".prisma/client").$Enums.ChatbotActionStatus;
            expiresAt: Date;
            cancelledAt: Date | null;
            conversationId: number;
            actionType: import(".prisma/client").$Enums.ChatbotActionType;
            payload: import("@prisma/client/runtime/library").JsonValue;
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
    listMessages(id: number, user: AuthUser): Promise<{
        role: import(".prisma/client").$Enums.ChatbotMessageRole;
        id: number;
        createdAt: Date;
        content: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        conversationId: number;
    }[]>;
    confirmAction(actionId: number, user: AuthUser, context: RequestContext): Promise<{
        success: boolean;
        reply: string;
        data: {
            leaveRequestId: number;
            status: import(".prisma/client").$Enums.LeaveRequestStatus;
        };
    }>;
    cancelAction(actionId: number, dto: ChatbotCancelActionDto, user: AuthUser, context: RequestContext): Promise<{
        success: boolean;
        reply: string;
        data: {
            actionId: number;
            status: "CANCELLED";
        };
    }>;
}
