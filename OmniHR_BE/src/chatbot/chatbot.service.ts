import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ChatbotActionType, ChatbotMessageRole } from "@prisma/client";
import { ApiError } from "../common/api-error";
import { SystemSettingsService } from "../common/services/system-settings.service";
import { AuthUser, RequestContext } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { ChatbotAiClientService } from "./chatbot-ai-client.service";
import { ChatbotHistoryService } from "./chatbot-history.service";
import { ChatbotToolsService } from "./chatbot-tools.service";
import { ChatbotCancelActionDto } from "./dto/chatbot-cancel-action.dto";
import { ChatbotMessageDto } from "./dto/chatbot-message.dto";
import {
  ChatbotReply,
  PendingActionView,
  ToolExecutionResult,
} from "./types/chatbot.types";

const AI_FALLBACK_REPLY =
  "HRGenie hiện chưa phản hồi được. Bạn vui lòng thử lại sau hoặc thao tác trực tiếp trên app.";
// Results the user may see but the external LLM must not: they are stored
// flagged as sensitive and left out of the history sent to the planner.
const SENSITIVE_TOOLS = new Set<string>();
// Same sliding window as the in-process fallback below, but shared by every
// API instance. Trimming, counting and adding have to be one atomic step or
// two concurrent messages can both slip past a full bucket.
const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', key, 0, now - windowMs)
if redis.call('ZCARD', key) >= limit then
  redis.call('PEXPIRE', key, windowMs)
  return 0
end
redis.call('ZADD', key, now, ARGV[4])
redis.call('PEXPIRE', key, windowMs)
return 1
`;

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly rateLimitBuckets = new Map<number, number[]>();
  private rateLimitSeq = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly history: ChatbotHistoryService,
    private readonly aiClient: ChatbotAiClientService,
    private readonly tools: ChatbotToolsService,
    private readonly systemSettings: SystemSettingsService,
    private readonly redis: RedisService,
  ) {}

  async sendMessage(
    dto: ChatbotMessageDto,
    user: AuthUser,
    context?: RequestContext,
  ): Promise<ChatbotReply> {
    const text = dto.message.trim();
    this.assertNonEmptyMessage(text);
    this.assertMessageLength(text);
    await this.assertRateLimit(user.id);

    const conversation = await this.history.getOrCreateConversation(
      user.id,
      dto.conversationId,
      text,
    );
    await this.history.addMessage(
      conversation.id,
      ChatbotMessageRole.USER,
      text,
    );

    const availableTools = this.tools.availableTools(user);
    let reply = AI_FALLBACK_REPLY;
    let pendingAction: PendingActionView | undefined;
    let toolResults: ToolExecutionResult[] = [];

    try {
      const startedAt = Date.now();
      const plan = await this.aiClient.plan(
        await this.planPayload(conversation.id, text, user, availableTools),
      );
      this.logPlan(conversation.id, user.id, plan, Date.now() - startedAt);

      if (plan.toolCalls.length) {
        toolResults = [];
        for (const toolCall of plan.toolCalls) {
          const result = await this.tools.executeTool(
            conversation.id,
            toolCall,
            user,
            context,
          );
          toolResults.push(result);
          await this.history.addMessage(
            conversation.id,
            ChatbotMessageRole.TOOL,
            JSON.stringify(result),
            this.toJsonValue({
              toolName: result.toolName,
              success: result.success,
              sensitive: SENSITIVE_TOOLS.has(result.toolName),
            }),
          );
        }
        pendingAction = toolResults.find(
          (result) => result.pendingAction,
        )?.pendingAction;
        reply = pendingAction
          ? this.pendingActionReply(pendingAction)
          : this.renderToolReply(toolResults, plan.reply);
      } else {
        reply = plan.reply || AI_FALLBACK_REPLY;
      }

      await this.history.addMessage(
        conversation.id,
        ChatbotMessageRole.ASSISTANT,
        reply,
        this.toJsonValue({
          intent: plan.intent ?? null,
          aiPlanType: plan.type,
          needConfirmation: plan.needConfirmation,
          confidence: plan.confidence,
          fallbackUsed: plan.fallbackUsed ?? null,
          pendingActionId: pendingAction?.actionId ?? null,
          sensitive: (toolResults ?? []).some((result) =>
            SENSITIVE_TOOLS.has(result.toolName),
          ),
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Chatbot planner failed conversationId=${conversation.id} userId=${user.id}: ${this.errorMessage(error)}`,
      );
      await this.history.addMessage(
        conversation.id,
        ChatbotMessageRole.ASSISTANT,
        AI_FALLBACK_REPLY,
      );
      reply = AI_FALLBACK_REPLY;
    }

    return {
      conversationId: conversation.id,
      reply,
      messages: [],
      pendingAction,
    };
  }

  listConversations(user: AuthUser) {
    return this.history.listConversations(user.id);
  }

  listMessages(user: AuthUser, conversationId: number) {
    return this.history.listMessages(user.id, conversationId);
  }

  async confirmAction(
    actionId: number,
    user: AuthUser,
    context?: RequestContext,
  ) {
    const result = await this.tools.confirmAction(actionId, user, context);
    await this.history.addMessage(
      result.conversationId,
      ChatbotMessageRole.ASSISTANT,
      result.reply,
      this.toJsonValue({ actionId, actionResult: result.data }),
    );
    return {
      success: true,
      reply: result.reply,
      data: result.data,
    };
  }

  async cancelAction(
    actionId: number,
    dto: ChatbotCancelActionDto,
    user: AuthUser,
    context?: RequestContext,
  ) {
    const result = await this.tools.cancelAction(
      actionId,
      user,
      dto.reason,
      context,
    );
    await this.history.addMessage(
      result.conversationId,
      ChatbotMessageRole.ASSISTANT,
      result.reply,
      this.toJsonValue({ actionId, actionResult: result.data }),
    );
    return {
      success: true,
      reply: result.reply,
      data: result.data,
    };
  }

  private async planPayload(
    conversationId: number,
    message: string,
    user: AuthUser,
    availableTools: ReturnType<ChatbotToolsService["availableTools"]>,
  ) {
    const [history, userContext, settings] = await Promise.all([
      this.history.recentHistory(conversationId, this.historyLimit()),
      this.userContext(user),
      this.systemSettings.getSettings(),
    ]);

    const currentDate = this.dateKeyForOffset(
      new Date(),
      settings.timezoneOffsetMinutes,
    );

    return {
      conversationId: String(conversationId),
      message,
      locale: "vi",
      timezone: "Asia/Ho_Chi_Minh",
      today: currentDate,
      currentDate,
      userContext,
      availableTools,
      history,
    };
  }

  private async userContext(user: AuthUser) {
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

  /**
   * Tool failures bubble up the shared English validation copy, while the rest
   * of the chat is Vietnamese - so known error codes get a Vietnamese reply.
   */
  private toolFailureReply(failed: ToolExecutionResult) {
    const known: Record<string, string> = {
      LEAVE_REQUEST_OVERLAP:
        "Khoảng nghỉ này trùng với một đơn đang chờ duyệt hoặc đã được duyệt của bạn. Bạn kiểm tra lại ngày nghỉ giúp mình nhé.",
      LEAVE_REQUEST_INVALID_DAYS:
        "Khoảng nghỉ bạn chọn không có ngày làm việc nào. Bạn chọn lại ngày trong tuần làm việc giúp mình nhé.",
      LEAVE_TYPE_NOT_FOUND:
        "Mình không tìm thấy loại nghỉ phép này. Bạn thử nói rõ loại nghỉ (ví dụ: nghỉ phép năm) nhé.",
      EMPLOYEE_NOT_FOUND:
        "Tài khoản của bạn chưa được gắn với hồ sơ nhân viên nên mình chưa thực hiện được thao tác này.",
      VALIDATION_ERROR:
        "Thông tin bạn cung cấp chưa hợp lệ. Bạn thử nói lại rõ hơn giúp mình nhé.",
      CHATBOT_ACTION_NOT_FOUND: "Mình không tìm thấy thao tác cần xác nhận.",
      CHATBOT_ACTION_NOT_PENDING:
        "Thao tác này đã được xử lý trước đó rồi.",
      CHATBOT_ACTION_EXPIRED:
        "Yêu cầu xác nhận đã hết hạn. Bạn thực hiện lại từ đầu giúp mình nhé.",
      CHATBOT_ACTION_UNSUPPORTED: "Mình chưa hỗ trợ thao tác này.",
      ROOT_TASK_STATUS_IS_DERIVED:
        "Công việc cấp nhóm nhận trạng thái từ các công việc con, nên bạn cập nhật công việc con giúp mình nhé.",
      CHATBOT_DATE_RANGE_TOO_WIDE:
        "Khoảng thời gian bạn hỏi quá dài. Bạn thu hẹp lại giúp mình nhé.",
      FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
      CHATBOT_TOOL_FORBIDDEN: "Bạn không có quyền thực hiện thao tác này."
    };

    const mapped = failed.errorCode ? known[failed.errorCode] : undefined;
    return (
      mapped || failed.message || "Tôi chưa thực hiện được thao tác này."
    );
  }

  private renderToolReply(results: ToolExecutionResult[], fallback: string) {
    const failed = results.find((result) => !result.success);
    if (failed) {
      return this.toolFailureReply(failed);
    }

    const first = results[0];
    if (!first) {
      return fallback || "Tôi chưa có đủ thông tin để trả lời.";
    }

    switch (first.toolName) {
      case "get_my_profile":
        return this.profileReply(first.data);
      case "get_my_manager":
        return this.myManagerReply(first.data);
      case "get_my_leave_balance":
        return this.leaveBalanceReply(first.data);
      case "get_my_leave_requests":
        return this.leaveRequestsReply(first.data);
      case "get_leave_types":
        return this.leaveTypesReply(first.data);
      case "get_employee_birthdays":
        return this.birthdaysReply(first.data);
      case "get_who_is_on_leave_today":
        return this.leaveTodayReply(first.data);
      case "get_upcoming_leaves":
        return this.upcomingLeavesReply(first.data);
      case "get_today_attendance":
        return this.attendanceReply(first.data);
      case "get_team_attendance_summary":
        return this.attendanceSummaryReply(first.data);
      case "get_attendance_policy":
        return this.attendancePolicyReply(first.data);
      case "get_my_tasks":
      case "get_my_upcoming_tasks":
        return this.tasksReply(first.data);
      case "get_team_task_summary":
        return this.teamTaskSummaryReply(first.data);
      case "get_department_headcount":
        return this.headcountReply(first.data);
      case "get_my_attendance_summary":
        return this.attendanceMonthReply(first.data);
      case "get_my_projects":
        return this.projectsReply(first.data);
      case "get_my_skills":
        return this.skillsReply(first.data);
      case "get_my_team_members":
        return this.teamMembersReply(first.data);
      case "get_my_task_stats":
        return this.taskStatsReply(first.data);
      default:
        return fallback || "Tôi đã lấy được thông tin bạn cần.";
    }
  }

  private taskStatusLabel(status: unknown) {
    const labels: Record<string, string> = {
      TODO: "chưa làm",
      IN_PROGRESS: "đang làm",
      IN_REVIEW: "chờ duyệt",
      DONE: "hoàn thành",
      CANCELLED: "đã hủy",
    };
    const key = typeof status === "string" ? status : "";
    return labels[key] ?? (key || "-");
  }

  private pendingActionReply(action: PendingActionView) {
    const summary = action.summary;
    if (action.type === ChatbotActionType.UPDATE_TASK_STATUS) {
      return [
        "Tôi đã chuẩn bị cập nhật công việc sau:",
        `- Công việc: ${summary.taskTitle ?? "-"}`,
        `- Dự án: ${summary.projectName ?? "-"}`,
        `- Trạng thái: ${this.taskStatusLabel(summary.currentStatus)} -> ${this.taskStatusLabel(summary.status)}`,
        "Bạn xác nhận cập nhật nhé?",
      ].join("\n");
    }

    if (action.type === ChatbotActionType.CANCEL_LEAVE_REQUEST) {
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

  private profileReply(data: unknown) {
    const profile = this.record(data);
    return [
      `Bạn là ${profile.fullName ?? "nhân viên OmniHR"}.`,
      `Mã nhân viên: ${profile.employeeCode ?? "-"}.`,
      `Phòng ban: ${profile.department ?? "-"}.`,
      `Vị trí: ${profile.position ?? "-"}.`,
      `Quản lý trực tiếp: ${profile.manager ?? "chưa có thông tin"}.`,
    ].join("\n");
  }

  private myManagerReply(data: unknown) {
    const profile = this.record(data);
    const manager = this.record(profile.manager);
    const managerText = manager.fullName
      ? `${manager.fullName}${manager.positionName ? ` - ${manager.positionName}` : ""}`
      : "chưa có thông tin quản lý";
    return [
      `Phòng ban của bạn: ${profile.departmentName ?? "-"}.`,
      `Vị trí: ${profile.positionName ?? "-"}.`,
      `Quản lý/người duyệt chính: ${managerText}.`,
    ].join("\n");
  }

  private leaveBalanceReply(data: unknown) {
    const balance = this.record(data);
    const items = Array.isArray(balance.items)
      ? balance.items.map((item) => this.record(item))
      : [];
    const annual =
      items.find((item) => String(item.code ?? "").includes("ANNUAL")) ??
      items.find(
        (item) =>
          item.annualAllowance !== null && item.annualAllowance !== undefined,
      ) ??
      items[0];
    if (!annual) {
      return "Tôi chưa tìm thấy cấu hình phép năm để tính số ngày còn lại.";
    }
    const remaining =
      annual.remainingDays === null || annual.remainingDays === undefined
        ? "chưa cấu hình"
        : `${annual.remainingDays} ngày`;
    return `Năm ${balance.year ?? ""}, ${annual.name ?? "phép năm"} của bạn: còn ${remaining}, đã duyệt ${annual.approvedDays ?? 0} ngày, đang chờ duyệt ${annual.pendingDays ?? 0} ngày.`;
  }

  private leaveRequestsReply(data: unknown) {
    const requests = Array.isArray(data)
      ? data.map((item) => this.record(item))
      : [];
    if (!requests.length) {
      return "Bạn chưa có đơn nghỉ nào gần đây.";
    }
    const latest = requests[0];
    const leaveType = this.record(latest.leaveType);
    return `Đơn nghỉ gần nhất của bạn là ${leaveType.name ?? "đơn nghỉ"} từ ${this.formatDate(latest.startDate)} đến ${this.formatDate(latest.endDate)}, trạng thái ${this.statusLabel(latest.status)}.`;
  }

  private leaveTypesReply(data: unknown) {
    const types = Array.isArray(data)
      ? data.map((item) => this.record(item))
      : [];
    if (!types.length) {
      return "Hiện chưa có loại nghỉ nào đang hoạt động.";
    }
    return `Các loại nghỉ đang dùng: ${types.map((type) => type.name ?? type.code).join(", ")}.`;
  }

  private birthdaysReply(data: unknown) {
    const items = this.items(data);
    if (!items.length) {
      return "Chưa có nhân viên nào trong phạm vi bạn được xem có sinh nhật trong khoảng thời gian này.";
    }
    const lines = items.slice(0, 8).map((item, index) => {
      const department = item.departmentName ? ` - ${item.departmentName}` : "";
      return `${index + 1}. ${item.fullName ?? "Nhân viên"}: ${item.birthday ?? "-"}${department}`;
    });
    const suffix = items.length > 8 ? `\n... và ${items.length - 8} người khác.` : "";
    return `Danh sách sinh nhật trong phạm vi bạn được xem:\n${lines.join("\n")}${suffix}`;
  }

  private leaveTodayReply(data: unknown) {
    const payload = this.record(data);
    const items = this.items(data);
    if (!items.length) {
      return `Ngày ${this.formatDate(payload.date)}, chưa có nhân viên nào trong phạm vi bạn được xem nghỉ phép.`;
    }
    return `Ngày ${this.formatDate(payload.date)}, có ${items.length} nhân viên nghỉ:\n${this.leaveLines(items)}`;
  }

  private upcomingLeavesReply(data: unknown) {
    const payload = this.record(data);
    const items = this.items(data);
    if (!items.length) {
      return `Từ ${this.formatDate(payload.fromDate)} đến ${this.formatDate(payload.toDate)}, chưa có nhân viên nào trong phạm vi bạn được xem nghỉ phép.`;
    }
    return `Lịch nghỉ từ ${this.formatDate(payload.fromDate)} đến ${this.formatDate(payload.toDate)}:\n${this.leaveLines(items)}`;
  }

  private attendanceReply(data: unknown) {
    const attendance = this.record(data);
    const latest = attendance.latestRecordedAt
      ? ` Lần ghi nhận gần nhất lúc ${this.formatTime(attendance.latestRecordedAt)}.`
      : "";
    if (attendance.checkedIn) {
      return `Hôm nay bạn đã check-in${attendance.checkedOut ? " và đã check-out" : " nhưng chưa check-out"}.${latest}`;
    }
    return "Hôm nay tôi chưa thấy bản ghi check-in của bạn.";
  }

  private attendancePolicyReply(data: unknown) {
    const settings = this.record(data);
    return `Giờ làm việc hiện tại: sáng ${settings.morningShiftStart ?? "08:00"}-${settings.morningShiftEnd ?? "12:00"}, chiều ${settings.afternoonShiftStart ?? "13:00"}-${settings.afternoonShiftEnd ?? "17:00"}. Bán kính chấm công: ${settings.attendanceRadiusMeters ?? 100}m.`;
  }

  private attendanceSummaryReply(data: unknown) {
    const summary = this.record(data);
    const notCheckedIn = this.items(summary.notCheckedInEmployees);
    const late = this.items(summary.lateEmployees);
    const lines = [
      `Tình hình chấm công ngày ${this.formatDate(summary.date)}:`,
      `- Tổng nhân viên: ${summary.totalEmployees ?? 0}`,
      `- Đã check-in: ${summary.checkedInCount ?? 0}`,
      `- Chưa check-in: ${summary.notCheckedInCount ?? 0}`,
      `- Đi muộn: ${summary.lateCount ?? 0}`,
      `- Về sớm: ${summary.earlyOutCount ?? 0}`,
    ];
    if (notCheckedIn.length) {
      lines.push(
        `Chưa check-in: ${notCheckedIn
          .slice(0, 6)
          .map((item) => item.fullName)
          .join(", ")}.`,
      );
    }
    if (late.length) {
      lines.push(
        `Đi muộn: ${late
          .slice(0, 6)
          .map((item) => item.fullName)
          .join(", ")}.`,
      );
    }
    return lines.join("\n");
  }

  private tasksReply(data: unknown) {
    const tasks = Array.isArray(data)
      ? data.map((item) => this.record(item))
      : this.items(data);
    if (!tasks.length) {
      return "Bạn không có task mở nào trong danh sách hiện tại.";
    }
    const lines = tasks.slice(0, 5).map((task, index) => {
      const due = task.dueDate ? `, hạn ${this.formatDate(task.dueDate)}` : "";
      const overdue = task.isOverdue ? " - quá hạn" : "";
      return `${index + 1}. ${task.title ?? "Task"} (${this.statusLabel(task.status)})${due}${overdue}`;
    });
    return `Các task sắp tới của bạn:\n${lines.join("\n")}`;
  }

  private teamTaskSummaryReply(data: unknown) {
    const summary = this.record(data);
    const byStatus = this.record(summary.byStatus);
    const topAssignees = this.items(summary.topAssignees);
    const lines = [
      `Phạm vi của bạn hiện có ${summary.totalActiveTasks ?? 0} task đang mở.`,
      `Task quá hạn: ${summary.overdueTaskCount ?? 0}.`,
      `Theo trạng thái: chưa bắt đầu ${byStatus.TODO ?? 0}, đang làm ${byStatus.IN_PROGRESS ?? 0}, chờ duyệt kết quả ${byStatus.IN_REVIEW ?? 0}.`,
    ];
    if (topAssignees.length) {
      lines.push(
        `Người đang có nhiều task: ${topAssignees
          .map((item) => `${item.fullName} (${item.activeTaskCount})`)
          .join(", ")}.`,
      );
    }
    return lines.join("\n");
  }

  private headcountReply(data: unknown) {
    const payload = this.record(data);
    const departments = this.items(payload.departments);
    const lines = [`Số nhân viên đang làm việc trong phạm vi này: ${payload.count ?? 0}.`];
    if (departments.length > 1) {
      lines.push(
        departments
          .slice(0, 8)
          .map(
            (department) =>
              `- ${department.departmentName ?? "Phòng ban"}: ${department.count ?? 0}`,
          )
          .join("\n"),
      );
    }
    return lines.join("\n");
  }

  private attendanceMonthReply(data: unknown) {
    const summary = this.record(data);
    const period = `tháng ${summary.month}/${summary.year}`;
    const lines = [
      `Chấm công ${period}${summary.isCurrentMonth ? " (tính đến hôm nay)" : ""}:`,
      `- Ngày đi làm: ${summary.attendanceDays ?? 0}/${summary.standardWorkDays ?? 0} ngày công chuẩn`,
      `- Đi muộn: ${summary.lateCount ?? 0} lần, tổng ${summary.lateMinutes ?? 0} phút`,
      `- Về sớm: ${summary.earlyLeaveCount ?? 0} lần, tổng ${summary.earlyLeaveMinutes ?? 0} phút`,
      `- Quên check-out: ${summary.missingCheckOuts ?? 0} lần`,
      `- Nghỉ phép có lương: ${summary.paidLeaveDays ?? 0} ngày, không lương: ${summary.unpaidLeaveDays ?? 0} ngày`,
      `- Tổng giờ làm: ${summary.workedHours ?? 0} giờ, tăng ca ${summary.overtimeMinutes ?? 0} phút`,
    ];
    const absent = Array.isArray(summary.absentDates) ? summary.absentDates : [];
    lines.push(
      absent.length
        ? `- Vắng không phép: ${absent.length} ngày (${absent
            .slice(0, 6)
            .map((day) => this.formatDate(day))
            .join(", ")}${absent.length > 6 ? ", ..." : ""})`
        : "- Không có ngày vắng không phép.",
    );
    return lines.join("\n");
  }

  private projectsReply(data: unknown) {
    const payload = this.record(data);
    const items = this.items(data);
    if (!items.length) {
      return "Bạn chưa có task nào thuộc dự án.";
    }
    const lines = items.slice(0, 8).map((item, index) => {
      const manager = item.managerName ? `, quản lý: ${String(item.managerName)}` : "";
      return `${index + 1}. ${String(item.name)} (${this.projectStatusLabel(item.status)}${manager}): ${String(item.openTaskCount)} task đang mở, ${String(item.doneTaskCount)} đã xong`;
    });
    return `Bạn đang có task trong ${String(payload.total ?? items.length)} dự án:\n${lines.join("\n")}`;
  }

  private skillsReply(data: unknown) {
    const items = this.items(data);
    if (!items.length) {
      return "Hồ sơ của bạn chưa ghi nhận kỹ năng nào. Bạn có thể cập nhật trong mục Hồ sơ.";
    }
    const levels: Record<string, string> = {
      EXPERT: "chuyên gia",
      ADVANCED: "thành thạo",
      INTERMEDIATE: "khá",
      BEGINNER: "cơ bản",
    };
    const lines = items.slice(0, 12).map((item) => {
      const years =
        item.yearsExperience === null || item.yearsExperience === undefined
          ? ""
          : `, ${String(item.yearsExperience)} năm`;
      const level = levels[String(item.proficiency)] ?? String(item.proficiency);
      return `- ${String(item.name)}: ${level}${years}`;
    });
    const suffix =
      items.length > 12 ? `\n... và ${items.length - 12} kỹ năng khác.` : "";
    return `Kỹ năng đang ghi nhận trong hồ sơ của bạn:\n${lines.join("\n")}${suffix}`;
  }

  private teamMembersReply(data: unknown) {
    const teams = this.items(data);
    if (!teams.length) {
      return "Bạn chưa thuộc nhóm nào.";
    }
    return teams
      .map((team) => {
        const members = this.items(team.members).map((member) => {
          const tags = [
            member.isLead ? "trưởng nhóm" : null,
            member.isMe ? "bạn" : null,
          ]
            .filter(Boolean)
            .join(", ");
          const position = member.positionName
            ? ` - ${String(member.positionName)}`
            : "";
          return `- ${String(member.fullName)}${position}${tags ? ` (${tags})` : ""}`;
        });
        const lead = team.leadName ? String(team.leadName) : "chưa có";
        return `${String(team.teamName)} có ${String(team.memberCount)} thành viên, trưởng nhóm ${lead}:\n${members.join("\n")}`;
      })
      .join("\n\n");
  }

  private taskStatsReply(data: unknown) {
    const stats = this.record(data);
    const rate =
      stats.onTimeRate === null || stats.onTimeRate === undefined
        ? "chưa có task hoàn thành"
        : `${String(stats.onTimeRate)}%`;
    return [
      `Task của bạn tháng ${String(stats.month)}/${String(stats.year)}:`,
      `- Hoàn thành: ${String(stats.completedCount ?? 0)} (đúng hạn ${String(stats.onTimeCount ?? 0)}, trễ hạn ${String(stats.lateCount ?? 0)})`,
      `- Tỉ lệ đúng hạn: ${rate}`,
      `- Giờ thực tế của các task đã xong: ${String(stats.actualHours ?? 0)} giờ`,
      `- Task được giao mới trong tháng: ${String(stats.assignedCount ?? 0)}`,
      `- Task đang quá hạn hiện tại: ${String(stats.overdueOpenCount ?? 0)}`,
    ].join("\n");
  }

  private projectStatusLabel(status: unknown) {
    const labels: Record<string, string> = {
      PLANNING: "đang lên kế hoạch",
      ACTIVE: "đang chạy",
      ON_HOLD: "tạm dừng",
      COMPLETED: "đã hoàn thành",
      CANCELLED: "đã hủy",
    };
    const key = String(status ?? "");
    return labels[key] ?? (key || "-");
  }

  private leaveLines(items: Array<Record<string, unknown>>) {
    return items
      .slice(0, 8)
      .map((item, index) => {
        const type = item.leaveTypeName ? ` - ${item.leaveTypeName}` : "";
        const department = item.departmentName ? ` (${item.departmentName})` : "";
        return `${index + 1}. ${item.fullName ?? "Nhân viên"}${department}${type}: ${this.formatDate(item.startDate)} đến ${this.formatDate(item.endDate)}`;
      })
      .join("\n");
  }

  /** Leave and task statuses in words; raw enum codes read badly in chat. */
  private statusLabel(status: unknown) {
    const labels: Record<string, string> = {
      PENDING: "chờ duyệt",
      APPROVED: "đã duyệt",
      REJECTED: "bị từ chối",
      CANCELLED: "đã hủy",
      TODO: "chưa bắt đầu",
      IN_PROGRESS: "đang làm",
      IN_REVIEW: "chờ duyệt kết quả",
      DONE: "hoàn thành",
    };
    const key = String(status ?? "");
    return labels[key] ?? (key || "-");
  }

  private assertMessageLength(message: string) {
    if (message.length <= this.maxMessageLength()) {
      return;
    }
    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      "Tin nhắn quá dài. Vui lòng rút gọn nội dung.",
      "CHATBOT_MESSAGE_TOO_LONG",
    );
  }

  private assertNonEmptyMessage(message: string) {
    if (message.length > 0) {
      return;
    }
    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      "Tin nhắn không được để trống.",
      "CHATBOT_MESSAGE_EMPTY",
    );
  }

  private async assertRateLimit(userId: number) {
    const ttlSeconds = this.envInt("CHATBOT_RATE_LIMIT_TTL_SECONDS", 60, 1, 3600);
    const limit = this.envInt(
      "CHATBOT_RATE_LIMIT_MAX",
      this.envInt("CHATBOT_RATE_LIMIT_PER_MINUTE", 20, 1, 300),
      1,
      300,
    );
    const windowMs = ttlSeconds * 1000;

    const allowed = await this.consumeSharedRateLimit(userId, windowMs, limit);
    if (allowed === null) {
      this.consumeLocalRateLimit(userId, windowMs, limit);
      return;
    }
    if (!allowed) {
      throw this.rateLimitedError();
    }
  }

  /**
   * Counts the message in Redis so the limit holds across API instances.
   * Returns null when Redis cannot answer, which hands the decision back to
   * the in-process bucket rather than letting a cache outage block chat.
   */
  private async consumeSharedRateLimit(
    userId: number,
    windowMs: number,
    limit: number,
  ): Promise<boolean | null> {
    const client = this.redis.getClient();
    if (!client || !this.redis.isReady()) {
      return null;
    }

    const now = Date.now();
    try {
      const allowed = (await client.eval(
        RATE_LIMIT_SCRIPT,
        1,
        `chatbot:ratelimit:${userId}`,
        now,
        windowMs,
        limit,
        // Two messages can land on the same millisecond; a sorted set would
        // collapse them into one member without this suffix.
        `${now}-${(this.rateLimitSeq += 1)}`,
      )) as number;
      return allowed === 1;
    } catch {
      return null;
    }
  }

  private consumeLocalRateLimit(
    userId: number,
    windowMs: number,
    limit: number,
  ) {
    const now = Date.now();
    const windowStart = now - windowMs;
    const bucket = (this.rateLimitBuckets.get(userId) ?? []).filter(
      (timestamp) => timestamp > windowStart,
    );

    if (bucket.length >= limit) {
      this.rateLimitBuckets.set(userId, bucket);
      throw this.rateLimitedError();
    }

    bucket.push(now);
    this.rateLimitBuckets.set(userId, bucket);
  }

  private rateLimitedError() {
    return new ApiError(
      HttpStatus.TOO_MANY_REQUESTS,
      "Bạn đang gửi quá nhiều tin nhắn. Vui lòng thử lại sau ít phút.",
      "CHATBOT_RATE_LIMITED",
    );
  }

  private logPlan(
    conversationId: number,
    userId: number,
    plan: {
      intent?: string;
      type: string;
      toolCalls: Array<{ toolName: string }>;
      confidence?: number;
      fallbackUsed?: boolean;
      provider?: string;
      model?: string;
    },
    latencyMs: number,
  ) {
    this.logger.log(
      `Chatbot plan conversationId=${conversationId} userId=${userId} provider=${plan.provider ?? process.env.LLM_PROVIDER ?? "unknown"} model=${plan.model ?? process.env.LLM_MODEL ?? "unknown"} intent=${plan.intent ?? "unknown"} type=${plan.type} tools=${plan.toolCalls.map((tool) => tool.toolName).join(",") || "-"} confidence=${plan.confidence ?? "-"} fallbackUsed=${plan.fallbackUsed ?? "unknown"} latencyMs=${latencyMs} success=true`,
    );
  }

  private historyLimit() {
    return this.envInt("CHATBOT_HISTORY_LIMIT", 12, 1, 50);
  }

  private maxMessageLength() {
    return this.envInt("CHATBOT_MAX_MESSAGE_LENGTH", 1000, 1, 4000);
  }

  private envInt(name: string, fallback: number, min: number, max: number) {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isInteger(value)) {
      return fallback;
    }
    return Math.min(Math.max(value, min), max);
  }

  private dateKeyForOffset(date: Date, offsetMinutes: number) {
    const local = new Date(date.getTime() + offsetMinutes * 60_000);
    return new Date(
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()),
    )
      .toISOString()
      .slice(0, 10);
  }

  private formatDate(value: unknown) {
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

  private formatTime(value: unknown) {
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

  private record(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private items(value: unknown): Array<Record<string, unknown>> {
    const record = this.record(value);
    const source = Array.isArray(value)
      ? value
      : Array.isArray(record.items)
        ? record.items
        : [];
    return source.map((item) => this.record(item));
  }

  private toJsonValue(value: unknown) {
    return JSON.parse(JSON.stringify(value));
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
