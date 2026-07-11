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
var ChatbotService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatbotService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const api_error_1 = require("../common/api-error");
const system_settings_service_1 = require("../common/services/system-settings.service");
const prisma_service_1 = require("../prisma/prisma.service");
const chatbot_ai_client_service_1 = require("./chatbot-ai-client.service");
const chatbot_history_service_1 = require("./chatbot-history.service");
const chatbot_tools_service_1 = require("./chatbot-tools.service");
const AI_FALLBACK_REPLY = "HRGenie hiện chưa phản hồi được. Bạn vui lòng thử lại sau hoặc thao tác trực tiếp trên app.";
let ChatbotService = ChatbotService_1 = class ChatbotService {
    prisma;
    history;
    aiClient;
    tools;
    systemSettings;
    logger = new common_1.Logger(ChatbotService_1.name);
    rateLimitBuckets = new Map();
    constructor(prisma, history, aiClient, tools, systemSettings) {
        this.prisma = prisma;
        this.history = history;
        this.aiClient = aiClient;
        this.tools = tools;
        this.systemSettings = systemSettings;
    }
    async sendMessage(dto, user, context) {
        const text = dto.message.trim();
        this.assertNonEmptyMessage(text);
        this.assertMessageLength(text);
        this.assertRateLimit(user.id);
        const conversation = await this.history.getOrCreateConversation(user.id, dto.conversationId, text);
        await this.history.addMessage(conversation.id, client_1.ChatbotMessageRole.USER, text);
        const availableTools = this.tools.availableTools(user);
        let reply = AI_FALLBACK_REPLY;
        let pendingAction;
        let toolResults = [];
        try {
            const startedAt = Date.now();
            const plan = await this.aiClient.plan(await this.planPayload(conversation.id, text, user, availableTools));
            this.logPlan(conversation.id, user.id, plan, Date.now() - startedAt);
            if (plan.toolCalls.length) {
                toolResults = [];
                for (const toolCall of plan.toolCalls) {
                    const result = await this.tools.executeTool(conversation.id, toolCall, user, context);
                    toolResults.push(result);
                    await this.history.addMessage(conversation.id, client_1.ChatbotMessageRole.TOOL, JSON.stringify(result), this.toJsonValue({
                        toolName: result.toolName,
                        success: result.success,
                    }));
                }
                pendingAction = toolResults.find((result) => result.pendingAction)?.pendingAction;
                reply = pendingAction
                    ? this.pendingActionReply(pendingAction)
                    : this.renderToolReply(toolResults, plan.reply);
            }
            else {
                reply = plan.reply || AI_FALLBACK_REPLY;
            }
            await this.history.addMessage(conversation.id, client_1.ChatbotMessageRole.ASSISTANT, reply, this.toJsonValue({
                intent: plan.intent ?? null,
                aiPlanType: plan.type,
                needConfirmation: plan.needConfirmation,
                confidence: plan.confidence,
                fallbackUsed: plan.fallbackUsed ?? null,
                pendingActionId: pendingAction?.actionId ?? null,
            }));
        }
        catch (error) {
            this.logger.warn(`Chatbot planner failed conversationId=${conversation.id} userId=${user.id}: ${this.errorMessage(error)}`);
            await this.history.addMessage(conversation.id, client_1.ChatbotMessageRole.ASSISTANT, AI_FALLBACK_REPLY);
            reply = AI_FALLBACK_REPLY;
        }
        return {
            conversationId: conversation.id,
            reply,
            messages: [],
            pendingAction,
        };
    }
    listConversations(user) {
        return this.history.listConversations(user.id);
    }
    listMessages(user, conversationId) {
        return this.history.listMessages(user.id, conversationId);
    }
    async confirmAction(actionId, user, context) {
        const result = await this.tools.confirmAction(actionId, user, context);
        await this.history.addMessage(result.conversationId, client_1.ChatbotMessageRole.ASSISTANT, result.reply, this.toJsonValue({ actionId, actionResult: result.data }));
        return {
            success: true,
            reply: result.reply,
            data: result.data,
        };
    }
    async cancelAction(actionId, dto, user, context) {
        const result = await this.tools.cancelAction(actionId, user, dto.reason, context);
        await this.history.addMessage(result.conversationId, client_1.ChatbotMessageRole.ASSISTANT, result.reply, this.toJsonValue({ actionId, actionResult: result.data }));
        return {
            success: true,
            reply: result.reply,
            data: result.data,
        };
    }
    async planPayload(conversationId, message, user, availableTools) {
        const [history, userContext, settings] = await Promise.all([
            this.history.recentHistory(conversationId, this.historyLimit()),
            this.userContext(user),
            this.systemSettings.getSettings(),
        ]);
        return {
            conversationId: String(conversationId),
            message,
            locale: "vi",
            timezone: "Asia/Ho_Chi_Minh",
            today: this.dateKeyForOffset(new Date(), settings.timezoneOffsetMinutes),
            userContext,
            availableTools,
            history,
        };
    }
    async userContext(user) {
        const employee = user.employeeId
            ? await this.prisma.employee.findUnique({
                where: { id: user.employeeId },
                select: { departmentId: true, positionId: true },
            })
            : null;
        return {
            userId: user.id,
            employeeId: user.employeeId ?? null,
            roles: user.roles,
            permissions: user.permissions,
            departmentId: employee?.departmentId ?? null,
            positionId: employee?.positionId ?? null,
        };
    }
    renderToolReply(results, fallback) {
        const failed = results.find((result) => !result.success);
        if (failed) {
            return failed.message || "Tôi chưa thực hiện được thao tác này.";
        }
        const first = results[0];
        if (!first) {
            return fallback || "Tôi chưa có đủ thông tin để trả lời.";
        }
        switch (first.toolName) {
            case "get_my_profile":
                return this.profileReply(first.data);
            case "get_my_leave_balance":
                return this.leaveBalanceReply(first.data);
            case "get_my_leave_requests":
                return this.leaveRequestsReply(first.data);
            case "get_leave_types":
                return this.leaveTypesReply(first.data);
            case "get_today_attendance":
                return this.attendanceReply(first.data);
            case "get_attendance_policy":
                return this.attendancePolicyReply(first.data);
            case "get_my_tasks":
            case "get_my_upcoming_tasks":
                return this.tasksReply(first.data);
            default:
                return fallback || "Tôi đã lấy được thông tin bạn cần.";
        }
    }
    pendingActionReply(action) {
        const summary = action.summary;
        if (action.type === client_1.ChatbotActionType.CANCEL_LEAVE_REQUEST) {
            return [
                "Tôi đã tìm thấy đơn nghỉ đang chờ duyệt để hủy:",
                `- Loại nghỉ: ${summary.leaveType ?? "-"}`,
                `- Thời gian: ${this.formatDate(summary.startDate)} đến ${this.formatDate(summary.endDate)}`,
                `- Lý do: ${summary.reason ?? "-"}`,
                "Bạn xác nhận hủy đơn này nhé?",
            ].join("\n");
        }
        return [
            "Tôi đã chuẩn bị nháp đơn nghỉ như sau:",
            `- Loại nghỉ: ${summary.leaveType ?? summary.leaveTypeCode ?? "-"}`,
            `- Thời gian: ${this.formatDate(summary.startDate)} đến ${this.formatDate(summary.endDate)}`,
            `- Số ngày: ${summary.totalDays ?? "-"}`,
            `- Lý do: ${summary.reason ?? "-"}`,
            "Bạn xác nhận nộp đơn này nhé?",
        ].join("\n");
    }
    profileReply(data) {
        const profile = this.record(data);
        return [
            `Bạn là ${profile.fullName ?? "nhân viên OmniHR"}.`,
            `Mã nhân viên: ${profile.employeeCode ?? "-"}.`,
            `Phòng ban: ${profile.department ?? "-"}.`,
            `Vị trí: ${profile.position ?? "-"}.`,
            `Quản lý trực tiếp: ${profile.manager ?? "chưa có thông tin"}.`,
        ].join("\n");
    }
    leaveBalanceReply(data) {
        const balance = this.record(data);
        const items = Array.isArray(balance.items)
            ? balance.items.map((item) => this.record(item))
            : [];
        const annual = items.find((item) => String(item.code ?? "").includes("ANNUAL")) ??
            items.find((item) => item.annualAllowance !== null && item.annualAllowance !== undefined) ??
            items[0];
        if (!annual) {
            return "Tôi chưa tìm thấy cấu hình phép năm để tính số ngày còn lại.";
        }
        const remaining = annual.remainingDays === null || annual.remainingDays === undefined
            ? "chưa cấu hình"
            : `${annual.remainingDays} ngày`;
        return `Năm ${balance.year ?? ""}, ${annual.name ?? "phép năm"} của bạn: còn ${remaining}, đã duyệt ${annual.approvedDays ?? 0} ngày, đang chờ duyệt ${annual.pendingDays ?? 0} ngày.`;
    }
    leaveRequestsReply(data) {
        const requests = Array.isArray(data)
            ? data.map((item) => this.record(item))
            : [];
        if (!requests.length) {
            return "Bạn chưa có đơn nghỉ nào gần đây.";
        }
        const latest = requests[0];
        const leaveType = this.record(latest.leaveType);
        return `Đơn nghỉ gần nhất của bạn là ${leaveType.name ?? "đơn nghỉ"} từ ${this.formatDate(latest.startDate)} đến ${this.formatDate(latest.endDate)}, trạng thái ${latest.status ?? "-"}.`;
    }
    leaveTypesReply(data) {
        const types = Array.isArray(data)
            ? data.map((item) => this.record(item))
            : [];
        if (!types.length) {
            return "Hiện chưa có loại nghỉ nào đang hoạt động.";
        }
        return `Các loại nghỉ đang dùng: ${types.map((type) => type.name ?? type.code).join(", ")}.`;
    }
    attendanceReply(data) {
        const attendance = this.record(data);
        const latest = attendance.latestRecordedAt
            ? ` Lần ghi nhận gần nhất lúc ${this.formatTime(attendance.latestRecordedAt)}.`
            : "";
        if (attendance.checkedIn) {
            return `Hôm nay bạn đã check-in${attendance.checkedOut ? " và đã check-out" : " nhưng chưa check-out"}.${latest}`;
        }
        return "Hôm nay tôi chưa thấy bản ghi check-in của bạn.";
    }
    attendancePolicyReply(data) {
        const settings = this.record(data);
        return `Giờ làm việc hiện tại: sáng ${settings.morningShiftStart ?? "08:00"}-${settings.morningShiftEnd ?? "12:00"}, chiều ${settings.afternoonShiftStart ?? "13:00"}-${settings.afternoonShiftEnd ?? "17:00"}. Bán kính chấm công: ${settings.attendanceRadiusMeters ?? 100}m.`;
    }
    tasksReply(data) {
        const tasks = Array.isArray(data)
            ? data.map((item) => this.record(item))
            : [];
        if (!tasks.length) {
            return "Bạn không có task mở nào trong danh sách hiện tại.";
        }
        const lines = tasks.slice(0, 5).map((task, index) => {
            const due = task.dueDate ? `, hạn ${this.formatDate(task.dueDate)}` : "";
            return `${index + 1}. ${task.title ?? "Task"} (${task.status ?? "-"})${due}`;
        });
        return `Các task sắp tới của bạn:\n${lines.join("\n")}`;
    }
    assertMessageLength(message) {
        if (message.length <= this.maxMessageLength()) {
            return;
        }
        throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Tin nhắn quá dài. Vui lòng rút gọn nội dung.", "CHATBOT_MESSAGE_TOO_LONG");
    }
    assertNonEmptyMessage(message) {
        if (message.length > 0) {
            return;
        }
        throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Tin nhắn không được để trống.", "CHATBOT_MESSAGE_EMPTY");
    }
    assertRateLimit(userId) {
        const ttlSeconds = this.envInt("CHATBOT_RATE_LIMIT_TTL_SECONDS", 60, 1, 3600);
        const limit = this.envInt("CHATBOT_RATE_LIMIT_MAX", this.envInt("CHATBOT_RATE_LIMIT_PER_MINUTE", 20, 1, 300), 1, 300);
        const now = Date.now();
        const windowStart = now - ttlSeconds * 1000;
        const bucket = (this.rateLimitBuckets.get(userId) ?? []).filter((timestamp) => timestamp > windowStart);
        if (bucket.length >= limit) {
            this.rateLimitBuckets.set(userId, bucket);
            throw new api_error_1.ApiError(common_1.HttpStatus.TOO_MANY_REQUESTS, "Bạn đang gửi quá nhiều tin nhắn. Vui lòng thử lại sau ít phút.", "CHATBOT_RATE_LIMITED");
        }
        bucket.push(now);
        this.rateLimitBuckets.set(userId, bucket);
    }
    logPlan(conversationId, userId, plan, latencyMs) {
        this.logger.log(`Chatbot plan conversationId=${conversationId} userId=${userId} provider=${plan.provider ?? process.env.LLM_PROVIDER ?? "unknown"} model=${plan.model ?? process.env.LLM_MODEL ?? "unknown"} intent=${plan.intent ?? "unknown"} type=${plan.type} tools=${plan.toolCalls.map((tool) => tool.toolName).join(",") || "-"} confidence=${plan.confidence ?? "-"} fallbackUsed=${plan.fallbackUsed ?? "unknown"} latencyMs=${latencyMs} success=true`);
    }
    historyLimit() {
        return this.envInt("CHATBOT_HISTORY_LIMIT", 12, 1, 50);
    }
    maxMessageLength() {
        return this.envInt("CHATBOT_MAX_MESSAGE_LENGTH", 1000, 1, 4000);
    }
    envInt(name, fallback, min, max) {
        const value = Number(process.env[name] ?? fallback);
        if (!Number.isInteger(value)) {
            return fallback;
        }
        return Math.min(Math.max(value, min), max);
    }
    dateKeyForOffset(date, offsetMinutes) {
        const local = new Date(date.getTime() + offsetMinutes * 60_000);
        return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()))
            .toISOString()
            .slice(0, 10);
    }
    formatDate(value) {
        if (typeof value !== "string" && !(value instanceof Date)) {
            return "-";
        }
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "-";
        }
        return new Intl.DateTimeFormat("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }).format(date);
    }
    formatTime(value) {
        if (typeof value !== "string" && !(value instanceof Date)) {
            return "-";
        }
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "-";
        }
        return new Intl.DateTimeFormat("vi-VN", {
            timeZone: "Asia/Ho_Chi_Minh",
            hour: "2-digit",
            minute: "2-digit",
        }).format(date);
    }
    record(value) {
        return typeof value === "object" && value !== null && !Array.isArray(value)
            ? value
            : {};
    }
    toJsonValue(value) {
        return JSON.parse(JSON.stringify(value));
    }
    errorMessage(error) {
        return error instanceof Error ? error.message : String(error);
    }
};
exports.ChatbotService = ChatbotService;
exports.ChatbotService = ChatbotService = ChatbotService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        chatbot_history_service_1.ChatbotHistoryService,
        chatbot_ai_client_service_1.ChatbotAiClientService,
        chatbot_tools_service_1.ChatbotToolsService,
        system_settings_service_1.SystemSettingsService])
], ChatbotService);
//# sourceMappingURL=chatbot.service.js.map