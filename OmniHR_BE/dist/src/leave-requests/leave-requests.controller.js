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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaveRequestsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const permissions_decorator_1 = require("../common/decorators/permissions.decorator");
const request_context_decorator_1 = require("../common/decorators/request-context.decorator");
const create_leave_request_dto_1 = require("./dto/create-leave-request.dto");
const leave_request_query_dto_1 = require("./dto/leave-request-query.dto");
const reject_leave_request_dto_1 = require("./dto/reject-leave-request.dto");
const leave_requests_service_1 = require("./leave-requests.service");
let LeaveRequestsController = class LeaveRequestsController {
    leaveRequestsService;
    constructor(leaveRequestsService) {
        this.leaveRequestsService = leaveRequestsService;
    }
    create(dto, user, context) {
        return this.leaveRequestsService.create(dto, user, context);
    }
    findAll(query) {
        return this.leaveRequestsService.findAll(query);
    }
    findSelf(user, query) {
        return this.leaveRequestsService.findSelf(user, query);
    }
    findTeam(user, query) {
        return this.leaveRequestsService.findTeam(user, query);
    }
    findOne(id, user) {
        return this.leaveRequestsService.findOne(id, user);
    }
    approve(id, user, context) {
        return this.leaveRequestsService.approve(id, user, context);
    }
    reject(id, dto, user, context) {
        return this.leaveRequestsService.reject(id, dto, user, context);
    }
    cancel(id, user, context) {
        return this.leaveRequestsService.cancel(id, user, context);
    }
};
exports.LeaveRequestsController = LeaveRequestsController;
__decorate([
    (0, permissions_decorator_1.Permissions)("LEAVE_CREATE"),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_leave_request_dto_1.CreateLeaveRequestDto, Object, Object]),
    __metadata("design:returntype", void 0)
], LeaveRequestsController.prototype, "create", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("LEAVE_READ_ALL"),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [leave_request_query_dto_1.LeaveRequestQueryDto]),
    __metadata("design:returntype", void 0)
], LeaveRequestsController.prototype, "findAll", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("LEAVE_READ_SELF"),
    (0, common_1.Get)("self"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, leave_request_query_dto_1.LeaveRequestQueryDto]),
    __metadata("design:returntype", void 0)
], LeaveRequestsController.prototype, "findSelf", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("LEAVE_READ_TEAM"),
    (0, common_1.Get)("team"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, leave_request_query_dto_1.LeaveRequestQueryDto]),
    __metadata("design:returntype", void 0)
], LeaveRequestsController.prototype, "findTeam", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("LEAVE_READ_ALL", "LEAVE_READ_TEAM", "LEAVE_READ_SELF"),
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], LeaveRequestsController.prototype, "findOne", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("LEAVE_APPROVE"),
    (0, common_1.Post)(":id/approve"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], LeaveRequestsController.prototype, "approve", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("LEAVE_REJECT"),
    (0, common_1.Post)(":id/reject"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, reject_leave_request_dto_1.RejectLeaveRequestDto, Object, Object]),
    __metadata("design:returntype", void 0)
], LeaveRequestsController.prototype, "reject", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("LEAVE_CANCEL_SELF"),
    (0, common_1.Post)(":id/cancel"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], LeaveRequestsController.prototype, "cancel", null);
exports.LeaveRequestsController = LeaveRequestsController = __decorate([
    (0, swagger_1.ApiTags)("leave-requests"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)("leave-requests"),
    __metadata("design:paramtypes", [leave_requests_service_1.LeaveRequestsService])
], LeaveRequestsController);
//# sourceMappingURL=leave-requests.controller.js.map