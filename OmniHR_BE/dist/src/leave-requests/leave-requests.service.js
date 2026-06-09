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
exports.LeaveRequestsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const api_error_1 = require("../common/api-error");
const audit_service_1 = require("../common/services/audit.service");
const access_control_service_1 = require("../common/services/access-control.service");
const utils_1 = require("../common/utils");
const leaveInclude = {
    employee: {
        include: {
            department: true,
            position: true
        }
    },
    leaveType: true,
    approver: {
        select: { id: true, username: true, email: true }
    }
};
let LeaveRequestsService = class LeaveRequestsService {
    prisma;
    audit;
    accessControl;
    constructor(prisma, audit, accessControl) {
        this.prisma = prisma;
        this.audit = audit;
        this.accessControl = accessControl;
    }
    async create(dto, user, context) {
        const employeeId = this.requireEmployee(user);
        const leaveType = await this.prisma.leaveType.findFirst({
            where: { id: dto.leaveTypeId, isActive: true }
        });
        if (!leaveType) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Leave type not found", "LEAVE_TYPE_NOT_FOUND");
        }
        const startDate = (0, utils_1.toDateOnly)(dto.startDate);
        const endDate = (0, utils_1.toDateOnly)(dto.endDate);
        if (startDate > endDate) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Start date must be before or equal to end date", "VALIDATION_ERROR");
        }
        const totalDays = (0, utils_1.calculateLeaveDays)(startDate, endDate);
        if (totalDays <= 0) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Leave range has no valid working days", "LEAVE_REQUEST_INVALID_DAYS");
        }
        await this.ensureNoOverlap(employeeId, startDate, endDate);
        const leaveRequest = await this.prisma.leaveRequest.create({
            data: {
                employeeId,
                leaveTypeId: dto.leaveTypeId,
                startDate,
                endDate,
                totalDays,
                reason: dto.reason,
                status: client_1.LeaveRequestStatus.PENDING
            },
            include: leaveInclude
        });
        await this.audit.log({
            userId: user.id,
            action: "CREATE_LEAVE_REQUEST",
            entityType: "LeaveRequest",
            entityId: leaveRequest.id,
            newValue: leaveRequest,
            context
        });
        return leaveRequest;
    }
    async findAll(query) {
        return this.paginatedList(this.buildWhere(query), query);
    }
    async findSelf(user, query) {
        const employeeId = this.requireEmployee(user);
        return this.paginatedList({ ...this.buildWhere(query), employeeId }, query);
    }
    async findTeam(user, query) {
        const teamIds = await this.accessControl.teamEmployeeIds(user);
        const scopedIds = query.employeeId
            ? teamIds.includes(query.employeeId)
                ? [query.employeeId]
                : []
            : teamIds;
        return this.paginatedList({ ...this.buildWhere(query), employeeId: { in: scopedIds } }, query);
    }
    async findOne(id, user) {
        const leaveRequest = await this.prisma.leaveRequest.findUnique({
            where: { id },
            include: leaveInclude
        });
        if (!leaveRequest) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Leave request not found", "LEAVE_REQUEST_NOT_FOUND");
        }
        await this.accessControl.ensureCanReadEmployee(user, leaveRequest.employeeId);
        return leaveRequest;
    }
    async approve(id, user, context) {
        const leaveRequest = await this.findPendingForDecision(id, user);
        const updated = await this.prisma.leaveRequest.update({
            where: { id },
            data: {
                status: client_1.LeaveRequestStatus.APPROVED,
                approverUserId: user.id,
                approvedAt: new Date()
            },
            include: leaveInclude
        });
        await this.audit.log({
            userId: user.id,
            action: "APPROVE_LEAVE_REQUEST",
            entityType: "LeaveRequest",
            entityId: id,
            oldValue: leaveRequest,
            newValue: updated,
            context
        });
        return updated;
    }
    async reject(id, dto, user, context) {
        const leaveRequest = await this.findPendingForDecision(id, user);
        const updated = await this.prisma.leaveRequest.update({
            where: { id },
            data: {
                status: client_1.LeaveRequestStatus.REJECTED,
                approverUserId: user.id,
                approvedAt: new Date(),
                rejectionReason: dto.rejectionReason
            },
            include: leaveInclude
        });
        await this.audit.log({
            userId: user.id,
            action: "REJECT_LEAVE_REQUEST",
            entityType: "LeaveRequest",
            entityId: id,
            oldValue: leaveRequest,
            newValue: updated,
            context
        });
        return updated;
    }
    async cancel(id, user, context) {
        const leaveRequest = await this.prisma.leaveRequest.findUnique({
            where: { id },
            include: leaveInclude
        });
        if (!leaveRequest) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Leave request not found", "LEAVE_REQUEST_NOT_FOUND");
        }
        if (!this.accessControl.isAdmin(user) && leaveRequest.employeeId !== user.employeeId) {
            throw new api_error_1.ApiError(common_1.HttpStatus.FORBIDDEN, "Forbidden", "FORBIDDEN");
        }
        if (leaveRequest.status !== client_1.LeaveRequestStatus.PENDING) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Only pending leave request can be cancelled", "LEAVE_REQUEST_INVALID_STATUS");
        }
        const updated = await this.prisma.leaveRequest.update({
            where: { id },
            data: {
                status: client_1.LeaveRequestStatus.CANCELLED,
                canceledAt: new Date()
            },
            include: leaveInclude
        });
        await this.audit.log({
            userId: user.id,
            action: "CANCEL_LEAVE_REQUEST",
            entityType: "LeaveRequest",
            entityId: id,
            oldValue: leaveRequest,
            newValue: updated,
            context
        });
        return updated;
    }
    async findPendingForDecision(id, user) {
        const leaveRequest = await this.prisma.leaveRequest.findUnique({
            where: { id },
            include: leaveInclude
        });
        if (!leaveRequest) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Leave request not found", "LEAVE_REQUEST_NOT_FOUND");
        }
        if (leaveRequest.status !== client_1.LeaveRequestStatus.PENDING) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Only pending leave request can be processed", "LEAVE_REQUEST_INVALID_STATUS");
        }
        await this.accessControl.ensureCanManageLeave(user, leaveRequest.employeeId);
        return leaveRequest;
    }
    async paginatedList(where, query) {
        const { skip, take, page, limit } = (0, utils_1.pagination)(query.page, query.limit);
        const [items, total] = await this.prisma.$transaction([
            this.prisma.leaveRequest.findMany({
                where,
                include: leaveInclude,
                orderBy: { createdAt: "desc" },
                skip,
                take
            }),
            this.prisma.leaveRequest.count({ where })
        ]);
        return { items, meta: { total, page, limit } };
    }
    buildWhere(query) {
        return {
            status: query.status,
            employeeId: query.employeeId,
            leaveTypeId: query.leaveTypeId,
            employee: query.departmentId ? { departmentId: query.departmentId } : undefined,
            startDate: query.fromDate ? { gte: (0, utils_1.toDateOnly)(query.fromDate) } : undefined,
            endDate: query.toDate ? { lte: (0, utils_1.toDateOnly)(query.toDate) } : undefined
        };
    }
    async ensureNoOverlap(employeeId, startDate, endDate) {
        const overlap = await this.prisma.leaveRequest.findFirst({
            where: {
                employeeId,
                status: { in: [client_1.LeaveRequestStatus.PENDING, client_1.LeaveRequestStatus.APPROVED] },
                startDate: { lte: endDate },
                endDate: { gte: startDate }
            },
            select: { id: true }
        });
        if (overlap) {
            throw new api_error_1.ApiError(common_1.HttpStatus.BAD_REQUEST, "Leave request overlaps with an existing pending or approved request", "LEAVE_REQUEST_OVERLAP");
        }
    }
    requireEmployee(user) {
        if (!user.employeeId) {
            throw new api_error_1.ApiError(common_1.HttpStatus.NOT_FOUND, "Employee profile not found", "EMPLOYEE_NOT_FOUND");
        }
        return user.employeeId;
    }
};
exports.LeaveRequestsService = LeaveRequestsService;
exports.LeaveRequestsService = LeaveRequestsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        access_control_service_1.AccessControlService])
], LeaveRequestsService);
//# sourceMappingURL=leave-requests.service.js.map