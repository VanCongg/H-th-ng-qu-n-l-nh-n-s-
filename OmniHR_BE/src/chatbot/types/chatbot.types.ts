// Các kiểu dữ liệu dùng chung của module chatbot (HRGenie).
// Luồng: app -> NestJS -> AI service (lập kế hoạch) -> NestJS chạy tool -> app.

/** Một tin nhắn trong lịch sử gửi sang AI service làm ngữ cảnh. */
export type ChatbotHistoryItem = {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
};

/** Tool mà người dùng hiện tại được phép dùng; chỉ danh sách này được gửi cho AI. */
export type ChatbotToolDefinition = {
  name: string;
  description: string;
};

/** Một lời gọi tool do AI đề xuất (NestJS sẽ kiểm tra lại quyền trước khi chạy). */
export type AiToolCall = {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
};

/**
 * Kế hoạch AI service trả về cho NestJS (hợp đồng cố định, không đổi theo chế độ planner).
 * - type "answer": chỉ trả lời, không gọi tool.
 * - type "tool_plan": gọi tool đọc dữ liệu.
 * - type "confirmation_required": gọi tool ghi, sẽ tạo bản nháp chờ người dùng xác nhận.
 */
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
  // true khi LLM lỗi và đã chuyển sang planner rule-based.
  fallbackUsed?: boolean;
  provider?: string;
  model?: string;
  // Nguồn tài liệu chính sách (RAG) dùng để trả lời, nếu có.
  citations?: Array<Record<string, unknown>>;
};

/** Kết quả chạy một tool trong NestJS (dữ liệu thật lấy từ DB, hoặc lỗi kèm mã lỗi). */
export type ToolExecutionResult = {
  toolName: string;
  success: boolean;
  data?: unknown;
  errorCode?: string;
  message?: string;
  // Có khi tool ghi đã tạo bản nháp chờ xác nhận.
  pendingAction?: PendingActionView;
};

/** Bản nháp chờ xác nhận trả về app để hiện thẻ "Xác nhận / Hủy". */
export type PendingActionView = {
  actionId: number;
  type: string;
  title: string;
  summary: Record<string, unknown>;
  expiresAt: Date;
};

/** Phản hồi của POST /chatbot/message cho app. */
export type ChatbotReply = {
  conversationId: number;
  reply: string;
  messages: unknown[];
  pendingAction?: PendingActionView;
};
