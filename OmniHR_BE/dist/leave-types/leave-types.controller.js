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
exports.LeaveTypesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const permissions_decorator_1 = require("../common/decorators/permissions.decorator");
const request_context_decorator_1 = require("../common/decorators/request-context.decorator");
const create_leave_type_dto_1 = require("./dto/create-leave-type.dto");
const update_leave_type_dto_1 = require("./dto/update-leave-type.dto");
const leave_types_service_1 = require("./leave-types.service");
let LeaveTypesController = class LeaveTypesController {
    leaveTypesService;
    constructor(leaveTypesService) {
        this.leaveTypesService = leaveTypesService;
    }
    findAll() {
        return this.leaveTypesService.findAll();
    }
    findOne(id) {
        return this.leaveTypesService.findOne(id);
    }
    create(dto, user, context) {
        return this.leaveTypesService.create(dto, user, context);
    }
    update(id, dto, user, context) {
        return this.leaveTypesService.update(id, dto, user, context);
    }
    remove(id, user, context) {
        return this.leaveTypesService.remove(id, user, context);
    }
};
exports.LeaveTypesController = LeaveTypesController;
__decorate([
    (0, permissions_decorator_1.Permissions)("LEAVE_TYPE_READ"),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LeaveTypesController.prototype, "findAll", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("LEAVE_TYPE_READ"),
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], LeaveTypesController.prototype, "findOne", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("LEAVE_TYPE_CREATE"),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_leave_type_dto_1.CreateLeaveTypeDto, Object, Object]),
    __metadata("design:returntype", void 0)
], LeaveTypesController.prototype, "create", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("LEAVE_TYPE_UPDATE"),
    (0, common_1.Patch)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_leave_type_dto_1.UpdateLeaveTypeDto, Object, Object]),
    __metadata("design:returntype", void 0)
], LeaveTypesController.prototype, "update", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("LEAVE_TYPE_DELETE"),
    (0, common_1.Delete)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], LeaveTypesController.prototype, "remove", null);
exports.LeaveTypesController = LeaveTypesController = __decorate([
    (0, swagger_1.ApiTags)("leave-types"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)("leave-types"),
    __metadata("design:paramtypes", [leave_types_service_1.LeaveTypesService])
], LeaveTypesController);
//# sourceMappingURL=leave-types.controller.js.map