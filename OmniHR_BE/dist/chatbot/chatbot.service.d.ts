import { SystemSettingsService } from "../common/services/system-settings.service";
import { AuthUser, RequestContext } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";
import { ChatbotAiClientService } from "./chatbot-ai-client.service";
import { ChatbotHistoryService } from "./chatbot-history.service";
import { ChatbotToolsService } from "./chatbot-tools.service";
import { ChatbotCancelActionDto } from "./dto/chatbot-cancel-action.dto";
import { ChatbotMessageDto } from "./dto/chatbot-message.dto";
import { ChatbotReply } from "./types/chatbot.types";
export declare class ChatbotService {
    private readonly prisma;
    private readonly history;
    private readonly aiClient;
    private readonly tools;
    private readonly systemSettings;
    private readonly logger;
    private readonly rateLimitBuckets;
    constructor(prisma: PrismaService, history: ChatbotHistoryService, aiClient: ChatbotAiClientService, tools: ChatbotToolsService, systemSettings: SystemSettingsService);
    sendMessage(dto: ChatbotMessageDto, user: AuthUser, context?: RequestContext): Promise<ChatbotReply>;
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
    listMessages(user: AuthUser, conversationId: number): Promise<{
        role: import(".prisma/client").$Enums.ChatbotMessageRole;
        id: number;
        createdAt: Date;
        content: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        conversationId: number;
    }[]>;
    confirmAction(actionId: number, user: AuthUser, context?: RequestContext): Promise<{
        success: boolean;
        reply: string;
        data: {
            leaveRequestId: number;
            status: import(".prisma/client").$Enums.LeaveRequestStatus;
        };
    }>;
    cancelAction(actionId: number, dto: ChatbotCancelActionDto, user: AuthUser, context?: RequestContext): Promise<{
        success: boolean;
        reply: string;
        data: {
            actionId: number;
            status: "CANCELLED";
        };
    }>;
    private planPayload;
    private userContext;
    private renderToolReply;
    private pendingActionReply;
    private profileReply;
    private leaveBalanceReply;
    private leaveRequestsReply;
    private leaveTypesReply;
    private attendanceReply;
    private attendancePolicyReply;
    private tasksReply;
    private assertMessageLength;
    private assertNonEmptyMessage;
    private assertRateLimit;
    private logPlan;
    private historyLimit;
    private maxMessageLength;
    private envInt;
    private dateKeyForOffset;
    private formatDate;
    private formatTime;
    private record;
    private toJsonValue;
    private errorMessage;
}
