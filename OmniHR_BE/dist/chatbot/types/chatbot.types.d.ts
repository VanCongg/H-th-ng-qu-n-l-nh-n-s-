export type ChatbotHistoryItem = {
    role: "user" | "assistant" | "tool" | "system";
    content: string;
};
export type ChatbotToolDefinition = {
    name: string;
    description: string;
};
export type AiToolCall = {
    id: string;
    toolName: string;
    arguments: Record<string, unknown>;
};
export type AiPlanResponse = {
    type: "answer" | "tool_plan" | "confirmation_required";
    intent?: string;
    reply: string;
    toolCalls: AiToolCall[];
    needConfirmation: boolean;
    confirmation?: {
        title?: string;
        summary?: Record<string, unknown>;
    };
    confidence?: number;
    fallbackUsed?: boolean;
    provider?: string;
    model?: string;
    citations?: Array<Record<string, unknown>>;
};
export type ToolExecutionResult = {
    toolName: string;
    success: boolean;
    data?: unknown;
    errorCode?: string;
    message?: string;
    pendingAction?: PendingActionView;
};
export type PendingActionView = {
    actionId: number;
    type: string;
    title: string;
    summary: Record<string, unknown>;
    expiresAt: Date;
};
export type ChatbotReply = {
    conversationId: number;
    reply: string;
    messages: unknown[];
    pendingAction?: PendingActionView;
};
