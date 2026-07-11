import { AuditService } from "../common/services/audit.service";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { AuthUser, RequestContext } from "../common/types";
import { LeaveRequestsService } from "../leave-requests/leave-requests.service";
import { PrismaService } from "../prisma/prisma.service";
import { AiToolCall, ChatbotToolDefinition, ToolExecutionResult } from "./types/chatbot.types";
export declare class ChatbotToolsService {
    private readonly prisma;
    private readonly audit;
    private readonly systemSettings;
    private readonly leaveRequests;
    constructor(prisma: PrismaService, audit: AuditService, systemSettings: SystemSettingsService, leaveRequests: LeaveRequestsService);
    availableTools(user: AuthUser): ChatbotToolDefinition[];
    executeTool(conversationId: number, call: AiToolCall, user: AuthUser, context?: RequestContext): Promise<ToolExecutionResult>;
    confirmAction(actionId: number, user: AuthUser, context?: RequestContext): Promise<{
        conversationId: number;
        reply: string;
        data: {
            leaveRequestId: number;
            status: import(".prisma/client").$Enums.LeaveRequestStatus;
        };
    }>;
    cancelAction(actionId: number, user: AuthUser, reason?: string, context?: RequestContext): Promise<{
        conversationId: number;
        reply: string;
        data: {
            actionId: number;
            status: "CANCELLED";
        };
    }>;
    private getMyProfile;
    private getMyLeaveBalance;
    private getMyLeaveRequests;
    private getLeaveTypes;
    private createLeaveRequestDraft;
    private cancelMyPendingLeaveRequestDraft;
    private getTodayAttendance;
    private getMyTasks;
    private getMyUpcomingTasks;
    private loadOwnedAction;
    private ensurePending;
    private executeConfirmedAction;
    private submitLeavePayload;
    private cancelLeavePayload;
    private pendingActionView;
    private success;
    private errorSnapshot;
    private hasAny;
    private requireEmployee;
    private ensureActionPermission;
    private requirePermission;
    private stringArg;
    private integerArg;
    private optionalIntegerArg;
    private pendingActionTtlMs;
    private dateArg;
    private taskStatuses;
    private workDateFor;
    private dateKey;
    private toJsonValue;
}
