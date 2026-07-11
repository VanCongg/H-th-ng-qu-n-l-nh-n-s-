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
exports.ChatbotToolsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const api_error_1 = require("../common/api-error");
const prisma_where_1 = require("../common/prisma-where");
const audit_service_1 = require("../common/services/audit.service");
const system_settings_service_1 = require("../common/services/system-settings.service");
const utils_1 = require("../common/utils");
const leave_requests_service_1 = require("../leave-requests/leave-requests.service");
const prisma_service_1 = require("../prisma/prisma.service");
const DEFAULT_PENDING_ACTION_TTL_MINUTES = 30;
let ChatbotToolsService = class ChatbotToolsService {
    prisma;
    audit;
    systemSettings;
    leaveRequests;
    constructor(prisma, audit, systemSettings, leaveRequests) {
        this.prisma = prisma;
        this.audit = audit;
        this.systemSettings = systemSettings;
        this.leaveRequests = leaveRequests;
    }
    availableTools(user) {
        const tools = [
            {
                name: "get_attendance_policy",
                description: "Get current company attendance settings and working hours",
            },
            {
                name: "get_leave_types",
                description: "Get active leave types",
            },
        ];
        if (user.employeeId && this.hasAny(user, "EMPLOYEE_READ_SELF")) {
            tools.push({
                name: "get_my_profile",
                description: "Get current employee profile, department, position, and manager",
            });
        }
        if (user.employeeId &&
            this.hasAny(user, "LEAVE_READ_SELF", "LEAVE_CREATE")) {
            tools.push({
                name: "get_my_leave_balance",
                description: "Get current employee leave balance for a year",
            });
            tools.push({
                name: "get_my_leave_requests",
                description: "Get recent leave requests of the current employee",
            });
        }
        if (user.employeeId && this.hasAny(user, "LEAVE_CREATE")) {
            tools.push({
                name: "create_leave_request_draft",
                description: "Validate and prepare a leave request pending user confirmation",
            });
        }
        if (user.employeeId && this.hasAny(user, "LEAVE_CANCEL_SELF")) {
            tools.push({
                name: "cancel_my_pending_leave_request",
                description: "Prepare cancellation of the current employee pending leave request",
            });
        }
        if (user.employeeId && this.hasAny(user, "ATTENDANCE_READ_SELF")) {
            tools.push({
                name: "get_today_attendance",
                description: "Get current employee attendance records for today",
            });
        }
        if (user.employeeId && this.hasAny(user, "TASK_READ_SELF")) {
            tools.push({
                name: "get_my_tasks",
                description: "Get current employee open tasks",
            });
            tools.push({
                name: "get_my_upcoming_tasks",
                description: "Get current employee upcoming or overdue tasks",
            });
        }
        return tools;
    }
    async executeTool(conversationId, call, user, context) {
        const allowed = new Set(this.availableTools(user).map((tool) => tool.name));
        if (!allowed.has(call.toolName)) {
            return {
                toolName: call.toolName,
                success: false,
                errorCode: "CHATBOT_TOOL_FORBIDDEN",
                message: "Bạn không có quyền thực hiện thao tác này.",
            };
        }
        try {
            switch (call.toolName) {
                case "get_my_profile":
                    return this.success(call.toolName, await this.getMyProfile(user));
                case "get_my_leave_balance":
                    return this.success(call.toolName, await this.getMyLeaveBalance(user, call.arguments));
                case "get_my_leave_requests":
                    return this.success(call.toolName, await this.getMyLeaveRequests(user, call.arguments));
                case "get_leave_types":
                    return this.success(call.toolName, await this.getLeaveTypes());
                case "create_leave_request_draft":
                    return this.success(call.toolName, await this.createLeaveRequestDraft(conversationId, user, call.arguments, context));
                case "cancel_my_pending_leave_request":
                    return this.success(call.toolName, await this.cancelMyPendingLeaveRequestDraft(conversationId, user, call.arguments, context));
                case "get_today_attendance":
                    return this.success(call.toolName, await this.getTodayAttendance(user));
                case "get_attendance_policy":
                    return this.success(call.toolName, await this.systemSettings.getSettings());
                case "get_my_tasks":
                    return this.success(call.toolName, await this.getMyTasks(user, call.arguments));
                case "get_my_upcoming_tasks":
                    return this.success(call.toolName, await this.getMyUpcomingTasks(user, call.arguments));
                default:
                    return {
                        toolName: call.toolName,
                        success: false,
                        errorCode: "CHATBOT_TOOL_UNKNOWN",
                        message: "Tôi chưa hỗ trợ thao tác này.",
                    };
            }
        }
        catch (error) {
            await this.audit.log({
                userId: user.id,
                action: "CHATBOT_TOOL_CALL_FAILED",
                entityType: "ChatbotTool",
                entityId: call.toolName,
                newValue: this.errorSnapshot(error),
                context,
            });
            return {
                toolName: call.toolName,
                success: false,
                ...this.errorSnapshot(error),
            };
        }
    }
    async confirmAction(actionId, user, context) {
        const action = await this.loadOwnedAction(actionId, user.id);
        await this.ensurePending(action, user.id, context);
        this.ensureActionPermission(action.actionType, user);
        let claimedAction = false;
        try {
            const claimed = await this.prisma.chatbotPendingAction.updateMany({
                where: {
                    id: action.id,
                    userId: user.id,
                    status: client_1.ChatbotActionStatus.PENDING,
                    expiresAt: { gt: new Date() },
                },
                data: { status: client_1.ChatbotActionStatus.CONFIRMED, confirmedAt: new Date() },
            });
            if (claimed.count !== 1) {
                throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Action is not pending", "CHATBOT_ACTION_NOT_PENDING");
            }
            claimedAction = true;
            await this.audit.log({
                userId: user.id,
                action: "CHATBOT_CONFIRM_ACTION",
                entityType: "ChatbotPendingAction",
                entityId: action.id,
                oldValue: { status: action.status },
                newValue: { status: client_1.ChatbotActionStatus.CONFIRMED },
                context,
            });
            const execution = await this.executeConfirmedAction(action, user, context);
            const updated = await this.prisma.chatbotPendingAction.update({
                where: { id: action.id },
                data: {
                    status: client_1.ChatbotActionStatus.EXECUTED,
                    result: this.toJsonValue(execution.result),
                },
            });
            await this.audit.log({
                userId: user.id,
                action: "CHATBOT_EXECUTE_ACTION",
                entityType: "ChatbotPendingAction",
                entityId: action.id,
                oldValue: { status: client_1.ChatbotActionStatus.CONFIRMED },
                newValue: { status: updated.status, ...execution.auditValue },
                context,
            });
            return {
                conversationId: action.conversationId,
                reply: execution.reply,
                data: {
                    ...execution.data,
                },
            };
        }
        catch (error) {
            if (claimedAction) {
                await this.prisma.chatbotPendingAction.update({
                    where: { id: action.id },
                    data: {
                        status: client_1.ChatbotActionStatus.FAILED,
                        result: this.toJsonValue(this.errorSnapshot(error)),
                    },
                });
                await this.audit.log({
                    userId: user.id,
                    action: "CHATBOT_TOOL_CALL_FAILED",
                    entityType: "ChatbotPendingAction",
                    entityId: action.id,
                    newValue: this.errorSnapshot(error),
                    context,
                });
            }
            throw error;
        }
    }
    async cancelAction(actionId, user, reason, context) {
        const action = await this.loadOwnedAction(actionId, user.id);
        await this.ensurePending(action, user.id, context);
        const updated = await this.prisma.chatbotPendingAction.updateMany({
            where: {
                id: action.id,
                userId: user.id,
                status: client_1.ChatbotActionStatus.PENDING,
                expiresAt: { gt: new Date() },
            },
            data: {
                status: client_1.ChatbotActionStatus.CANCELLED,
                cancelledAt: new Date(),
                result: reason ? this.toJsonValue({ reason }) : undefined,
            },
        });
        if (updated.count !== 1) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Action is not pending", "CHATBOT_ACTION_NOT_PENDING");
        }
        await this.audit.log({
            userId: user.id,
            action: "CHATBOT_CANCEL_ACTION",
            entityType: "ChatbotPendingAction",
            entityId: action.id,
            oldValue: { status: action.status },
            newValue: { status: client_1.ChatbotActionStatus.CANCELLED, reason: reason ?? null },
            context,
        });
        return {
            conversationId: action.conversationId,
            reply: "Tôi đã hủy thao tác đang chờ xác nhận.",
            data: { actionId: action.id, status: client_1.ChatbotActionStatus.CANCELLED },
        };
    }
    async getMyProfile(user) {
        const employeeId = this.requireEmployee(user);
        const today = (0, utils_1.toDateOnly)(new Date());
        const employee = await this.prisma.employee.findFirst({
            where: (0, prisma_where_1.currentEmployeeWhere)({ id: employeeId }),
            include: {
                department: true,
                position: true,
                subordinateRelations: {
                    where: {
                        isActive: true,
                        OR: [{ endDate: null }, { endDate: { gte: today } }],
                    },
                    include: {
                        manager: { include: { department: true, position: true } },
                    },
                    orderBy: { startDate: "desc" },
                    take: 1,
                },
            },
        });
        if (!employee) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Employee profile not found", "EMPLOYEE_NOT_FOUND");
        }
        const manager = employee.subordinateRelations[0]?.manager ?? null;
        return {
            fullName: employee.fullName,
            employeeCode: employee.employeeCode,
            department: employee.department?.name ?? null,
            position: employee.position?.name ?? null,
            manager: manager?.fullName ?? null,
        };
    }
    async getMyLeaveBalance(user, args) {
        const employeeId = this.requireEmployee(user);
        const year = this.integerArg(args.year, new Date().getFullYear());
        const start = new Date(Date.UTC(year, 0, 1));
        const end = new Date(Date.UTC(year, 11, 31));
        const [leaveTypes, grouped] = await Promise.all([
            this.prisma.leaveType.findMany({
                where: { isActive: true },
                orderBy: { code: "asc" },
            }),
            this.prisma.leaveRequest.groupBy({
                by: ["leaveTypeId", "status"],
                where: {
                    employeeId,
                    startDate: { gte: start },
                    endDate: { lte: end },
                    status: {
                        in: [client_1.LeaveRequestStatus.APPROVED, client_1.LeaveRequestStatus.PENDING],
                    },
                },
                _sum: { totalDays: true },
            }),
        ]);
        return {
            year,
            items: leaveTypes.map((leaveType) => {
                const approved = grouped.find((item) => item.leaveTypeId === leaveType.id &&
                    item.status === client_1.LeaveRequestStatus.APPROVED)?._sum.totalDays ?? 0;
                const pending = grouped.find((item) => item.leaveTypeId === leaveType.id &&
                    item.status === client_1.LeaveRequestStatus.PENDING)?._sum.totalDays ?? 0;
                const allowance = leaveType.annualAllowance ?? null;
                return {
                    leaveTypeId: leaveType.id,
                    code: leaveType.code,
                    name: leaveType.name,
                    annualAllowance: allowance,
                    approvedDays: approved,
                    pendingDays: pending,
                    remainingDays: allowance === null ? null : allowance - approved - pending,
                };
            }),
        };
    }
    async getMyLeaveRequests(user, args) {
        const employeeId = this.requireEmployee(user);
        const status = typeof args.status === "string" && args.status in client_1.LeaveRequestStatus
            ? args.status
            : undefined;
        return this.prisma.leaveRequest.findMany({
            where: { employeeId, status },
            include: { leaveType: true },
            orderBy: { createdAt: "desc" },
            take: Math.min(Math.max(this.integerArg(args.limit, 5), 1), 10),
        });
    }
    getLeaveTypes() {
        return this.prisma.leaveType.findMany({
            where: { isActive: true },
            orderBy: { code: "asc" },
        });
    }
    async createLeaveRequestDraft(conversationId, user, args, context) {
        const employeeId = this.requireEmployee(user);
        const leaveTypeCode = this.stringArg(args.leaveTypeCode, "ANNUAL_LEAVE");
        const leaveType = await this.prisma.leaveType.findFirst({
            where: { code: leaveTypeCode, isActive: true },
        });
        if (!leaveType) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Leave type not found", "LEAVE_TYPE_NOT_FOUND");
        }
        const startDate = this.dateArg(args.startDate, "startDate");
        const endDate = this.dateArg(args.endDate, "endDate");
        if (startDate > endDate) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Start date must be before or equal to end date", "VALIDATION_ERROR");
        }
        const totalDays = (0, utils_1.calculateLeaveDays)(startDate, endDate);
        if (totalDays <= 0) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Leave range has no valid working days", "LEAVE_REQUEST_INVALID_DAYS");
        }
        const overlap = await this.prisma.leaveRequest.findFirst({
            where: {
                employeeId,
                status: {
                    in: [client_1.LeaveRequestStatus.PENDING, client_1.LeaveRequestStatus.APPROVED],
                },
                startDate: { lte: endDate },
                endDate: { gte: startDate },
            },
            select: { id: true },
        });
        if (overlap) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Leave request overlaps with an existing pending or approved request", "LEAVE_REQUEST_OVERLAP");
        }
        const reason = this.stringArg(args.reason, "Tạo từ HRGenie").slice(0, 1000);
        const payload = {
            leaveTypeId: leaveType.id,
            leaveTypeCode: leaveType.code,
            leaveTypeName: leaveType.name,
            startDate: this.dateKey(startDate),
            endDate: this.dateKey(endDate),
            totalDays,
            reason,
        };
        const action = await this.prisma.chatbotPendingAction.create({
            data: {
                conversationId,
                userId: user.id,
                actionType: client_1.ChatbotActionType.SUBMIT_LEAVE_REQUEST,
                payload: this.toJsonValue(payload),
                expiresAt: new Date(Date.now() + this.pendingActionTtlMs()),
            },
        });
        await this.audit.log({
            userId: user.id,
            action: "CHATBOT_CREATE_PENDING_ACTION",
            entityType: "ChatbotPendingAction",
            entityId: action.id,
            newValue: payload,
            context,
        });
        return {
            pendingAction: this.pendingActionView(client_1.ChatbotActionType.SUBMIT_LEAVE_REQUEST, action.id, action.expiresAt, payload),
        };
    }
    async cancelMyPendingLeaveRequestDraft(conversationId, user, args, context) {
        const employeeId = this.requireEmployee(user);
        const leaveRequestId = this.optionalIntegerArg(args.leaveRequestId);
        const startDate = typeof args.startDate === "string" && args.startDate.trim()
            ? this.dateArg(args.startDate, "startDate")
            : undefined;
        const matches = await this.prisma.leaveRequest.findMany({
            where: {
                employeeId,
                status: client_1.LeaveRequestStatus.PENDING,
                ...(leaveRequestId ? { id: leaveRequestId } : {}),
                ...(startDate
                    ? { startDate: { lte: startDate }, endDate: { gte: startDate } }
                    : {}),
            },
            include: { leaveType: true },
            orderBy: { createdAt: "desc" },
            take: 2,
        });
        if (!matches.length) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Không tìm thấy đơn nghỉ đang chờ duyệt phù hợp để hủy.", "CHATBOT_LEAVE_REQUEST_NOT_FOUND");
        }
        if (matches.length > 1) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Bạn có nhiều đơn nghỉ đang chờ duyệt. Vui lòng nói rõ ngày nghỉ hoặc mã đơn cần hủy.", "CHATBOT_LEAVE_REQUEST_AMBIGUOUS");
        }
        const leaveRequest = matches[0];
        const payload = {
            leaveRequestId: leaveRequest.id,
            leaveType: leaveRequest.leaveType?.name ?? null,
            startDate: this.dateKey(leaveRequest.startDate),
            endDate: this.dateKey(leaveRequest.endDate),
            totalDays: leaveRequest.totalDays,
            reason: leaveRequest.reason,
            currentStatus: leaveRequest.status,
        };
        const action = await this.prisma.chatbotPendingAction.create({
            data: {
                conversationId,
                userId: user.id,
                actionType: client_1.ChatbotActionType.CANCEL_LEAVE_REQUEST,
                payload: this.toJsonValue(payload),
                expiresAt: new Date(Date.now() + this.pendingActionTtlMs()),
            },
        });
        await this.audit.log({
            userId: user.id,
            action: "CHATBOT_CREATE_PENDING_ACTION",
            entityType: "ChatbotPendingAction",
            entityId: action.id,
            newValue: payload,
            context,
        });
        return {
            pendingAction: this.pendingActionView(client_1.ChatbotActionType.CANCEL_LEAVE_REQUEST, action.id, action.expiresAt, payload),
        };
    }
    async getTodayAttendance(user) {
        const employeeId = this.requireEmployee(user);
        const settings = await this.systemSettings.getSettings();
        const workDate = this.workDateFor(new Date(), settings.timezoneOffsetMinutes);
        const records = await this.prisma.attendanceRecord.findMany({
            where: { employeeId, workDate },
            orderBy: { recordedAt: "asc" },
        });
        const latest = records[records.length - 1] ?? null;
        return {
            workDate: this.dateKey(workDate),
            checkedIn: records.some((item) => item.recordType === "CHECK_IN"),
            checkedOut: latest?.recordType === "CHECK_OUT",
            latestRecordType: latest?.recordType ?? null,
            latestRecordedAt: latest?.recordedAt ?? null,
            records,
        };
    }
    async getMyTasks(user, args) {
        const employeeId = this.requireEmployee(user);
        const statuses = this.taskStatuses(args.status);
        return this.prisma.task.findMany({
            where: {
                assigneeId: employeeId,
                deletedAt: null,
                status: { in: statuses },
            },
            include: {
                project: true,
                department: true,
                team: true,
            },
            orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
            take: Math.min(Math.max(this.integerArg(args.limit, 10), 1), 20),
        });
    }
    async getMyUpcomingTasks(user, args) {
        const employeeId = this.requireEmployee(user);
        const limit = Math.min(Math.max(this.integerArg(args.limit, 10), 1), 20);
        const mode = this.stringArg(args.mode, "upcoming");
        const days = Math.min(Math.max(this.integerArg(args.days, 7), 1), 30);
        const today = (0, utils_1.toDateOnly)(new Date());
        const endDate = new Date(today);
        endDate.setUTCDate(endDate.getUTCDate() + days);
        const dueDate = mode === "overdue"
            ? { lt: today }
            : mode === "today"
                ? { gte: today, lte: today }
                : { gte: today, lte: endDate };
        return this.prisma.task.findMany({
            where: {
                assigneeId: employeeId,
                deletedAt: null,
                status: {
                    in: [client_1.TaskStatus.TODO, client_1.TaskStatus.IN_PROGRESS, client_1.TaskStatus.IN_REVIEW],
                },
                dueDate,
            },
            include: {
                project: true,
                department: true,
                team: true,
            },
            orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
            take: limit,
        });
    }
    async loadOwnedAction(actionId, userId) {
        const action = await this.prisma.chatbotPendingAction.findFirst({
            where: { id: actionId, userId },
        });
        if (!action) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Pending action not found", "CHATBOT_ACTION_NOT_FOUND");
        }
        return action;
    }
    async ensurePending(action, userId, context) {
        if (action.status !== client_1.ChatbotActionStatus.PENDING) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Action is not pending", "CHATBOT_ACTION_NOT_PENDING");
        }
        if (action.expiresAt.getTime() <= Date.now()) {
            await this.prisma.chatbotPendingAction.update({
                where: { id: action.id },
                data: { status: client_1.ChatbotActionStatus.EXPIRED },
            });
            await this.audit.log({
                userId,
                action: "CHATBOT_EXPIRE_ACTION",
                entityType: "ChatbotPendingAction",
                entityId: action.id,
                oldValue: { status: action.status },
                newValue: { status: client_1.ChatbotActionStatus.EXPIRED },
                context,
            });
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Action has expired", "CHATBOT_ACTION_EXPIRED");
        }
    }
    async executeConfirmedAction(action, user, context) {
        if (action.actionType === client_1.ChatbotActionType.SUBMIT_LEAVE_REQUEST) {
            const payload = this.submitLeavePayload(action.payload);
            const leaveRequest = await this.leaveRequests.create(payload, user, context);
            await this.audit.log({
                userId: user.id,
                action: "CREATE_LEAVE_REQUEST_BY_CHATBOT",
                entityType: "LeaveRequest",
                entityId: leaveRequest.id,
                newValue: leaveRequest,
                context,
            });
            return {
                result: leaveRequest,
                auditValue: { leaveRequestId: leaveRequest.id },
                reply: "Đơn nghỉ của bạn đã được nộp và đang chờ quản lý duyệt.",
                data: {
                    leaveRequestId: leaveRequest.id,
                    status: leaveRequest.status,
                },
            };
        }
        if (action.actionType === client_1.ChatbotActionType.CANCEL_LEAVE_REQUEST) {
            const payload = this.cancelLeavePayload(action.payload);
            const leaveRequest = await this.leaveRequests.cancel(payload.leaveRequestId, user, context);
            await this.audit.log({
                userId: user.id,
                action: "CANCEL_LEAVE_REQUEST_BY_CHATBOT",
                entityType: "LeaveRequest",
                entityId: leaveRequest.id,
                newValue: leaveRequest,
                context,
            });
            return {
                result: leaveRequest,
                auditValue: { leaveRequestId: leaveRequest.id },
                reply: "Đơn nghỉ đang chờ duyệt đã được hủy.",
                data: {
                    leaveRequestId: leaveRequest.id,
                    status: leaveRequest.status,
                },
            };
        }
        throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Unsupported chatbot action", "CHATBOT_ACTION_UNSUPPORTED");
    }
    submitLeavePayload(value) {
        const payload = isRecord(value) ? value : {};
        return {
            leaveTypeId: this.integerArg(payload.leaveTypeId, 0),
            startDate: this.stringArg(payload.startDate),
            endDate: this.stringArg(payload.endDate),
            reason: this.stringArg(payload.reason, "Tạo từ HRGenie").slice(0, 1000),
        };
    }
    cancelLeavePayload(value) {
        const payload = isRecord(value) ? value : {};
        const leaveRequestId = this.integerArg(payload.leaveRequestId, 0);
        if (!leaveRequestId) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Leave request id is required", "VALIDATION_ERROR");
        }
        return { leaveRequestId };
    }
    pendingActionView(actionType, actionId, expiresAt, payload) {
        if (actionType === client_1.ChatbotActionType.CANCEL_LEAVE_REQUEST) {
            return {
                actionId,
                type: actionType,
                title: "Xác nhận hủy đơn nghỉ",
                summary: {
                    leaveRequestId: payload.leaveRequestId,
                    leaveType: payload.leaveType,
                    startDate: payload.startDate,
                    endDate: payload.endDate,
                    totalDays: payload.totalDays,
                    reason: payload.reason,
                    currentStatus: payload.currentStatus,
                },
                expiresAt,
            };
        }
        return {
            actionId,
            type: actionType,
            title: "Xác nhận nộp đơn nghỉ",
            summary: {
                leaveType: payload.leaveTypeName,
                leaveTypeCode: payload.leaveTypeCode,
                startDate: payload.startDate,
                endDate: payload.endDate,
                totalDays: payload.totalDays,
                reason: payload.reason,
            },
            expiresAt,
        };
    }
    success(toolName, data) {
        if (isRecord(data) && isRecord(data.pendingAction)) {
            return {
                toolName,
                success: true,
                data,
                pendingAction: data.pendingAction,
            };
        }
        return { toolName, success: true, data };
    }
    errorSnapshot(error) {
        if (error instanceof api_error_1.ApiError) {
            const response = error.getResponse();
            if (isRecord(response)) {
                return {
                    message: String(response.message ?? error.message),
                    errorCode: String(response.errorCode ?? "CHATBOT_TOOL_FAILED"),
                };
            }
        }
        return {
            message: error instanceof Error ? error.message : "Tool execution failed",
            errorCode: "CHATBOT_TOOL_FAILED",
        };
    }
    hasAny(user, ...permissions) {
        return permissions.some((permission) => user.permissions.includes(permission));
    }
    requireEmployee(user) {
        if (!user.employeeId) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Employee profile not found", "EMPLOYEE_NOT_FOUND");
        }
        return user.employeeId;
    }
    ensureActionPermission(actionType, user) {
        if (actionType === client_1.ChatbotActionType.SUBMIT_LEAVE_REQUEST) {
            this.requirePermission(user, "LEAVE_CREATE");
            return;
        }
        if (actionType === client_1.ChatbotActionType.CANCEL_LEAVE_REQUEST) {
            this.requirePermission(user, "LEAVE_CANCEL_SELF");
            return;
        }
    }
    requirePermission(user, permission) {
        if (this.hasAny(user, permission)) {
            return;
        }
        throw new api_error_1.ApiError(common_1.HttpStatus.FORBIDDEN, "Forbidden", "FORBIDDEN");
    }
    stringArg(value, fallback = "") {
        return typeof value === "string" && value.trim() ? value.trim() : fallback;
    }
    integerArg(value, fallback) {
        const numberValue = typeof value === "number"
            ? value
            : typeof value === "string"
                ? Number(value)
                : Number.NaN;
        return Number.isInteger(numberValue) ? numberValue : fallback;
    }
    optionalIntegerArg(value) {
        const numberValue = typeof value === "number"
            ? value
            : typeof value === "string"
                ? Number(value)
                : Number.NaN;
        return Number.isInteger(numberValue) && numberValue > 0
            ? numberValue
            : undefined;
    }
    pendingActionTtlMs() {
        const minutes = Number(process.env.CHATBOT_PENDING_ACTION_TTL_MINUTES ??
            DEFAULT_PENDING_ACTION_TTL_MINUTES);
        const safeMinutes = Number.isInteger(minutes)
            ? Math.min(Math.max(minutes, 1), 24 * 60)
            : DEFAULT_PENDING_ACTION_TTL_MINUTES;
        return safeMinutes * 60 * 1000;
    }
    dateArg(value, field) {
        if (typeof value !== "string") {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, `${field} is required`, "VALIDATION_ERROR");
        }
        const date = (0, utils_1.toDateOnly)(value);
        if (Number.isNaN(date.getTime())) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, `${field} is invalid`, "VALIDATION_ERROR");
        }
        return date;
    }
    taskStatuses(value) {
        const raw = Array.isArray(value)
            ? value
            : typeof value === "string"
                ? [value]
                : [];
        const statuses = raw.filter((item) => Object.values(client_1.TaskStatus).includes(item));
        return statuses.length
            ? statuses
            : [client_1.TaskStatus.TODO, client_1.TaskStatus.IN_PROGRESS];
    }
    workDateFor(recordedAt, timezoneOffsetMinutes) {
        const local = new Date(recordedAt.getTime() + timezoneOffsetMinutes * 60_000);
        return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
    }
    dateKey(value) {
        return (0, utils_1.toDateOnly)(value).toISOString().slice(0, 10);
    }
    toJsonValue(value) {
        return JSON.parse(JSON.stringify(value));
    }
};
exports.ChatbotToolsService = ChatbotToolsService;
exports.ChatbotToolsService = ChatbotToolsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        system_settings_service_1.SystemSettingsService,
        leave_requests_service_1.LeaveRequestsService])
], ChatbotToolsService);
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=chatbot-tools.service.js.map