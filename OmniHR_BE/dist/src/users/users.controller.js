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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const pagination_query_dto_1 = require("../common/dto/pagination-query.dto");
const permissions_decorator_1 = require("../common/decorators/permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const request_context_decorator_1 = require("../common/decorators/request-context.decorator");
const assign_role_dto_1 = require("./dto/assign-role.dto");
const create_user_dto_1 = require("./dto/create-user.dto");
const reset_user_password_dto_1 = require("./dto/reset-user-password.dto");
const update_user_dto_1 = require("./dto/update-user.dto");
const users_service_1 = require("./users.service");
let UsersController = class UsersController {
    usersService;
    constructor(usersService) {
        this.usersService = usersService;
    }
    findAll(query) {
        return this.usersService.findAll(query);
    }
    findOne(id) {
        return this.usersService.findOne(id);
    }
    create(dto, user, context) {
        return this.usersService.create(dto, user, context);
    }
    update(id, dto, user, context) {
        return this.usersService.update(id, dto, user, context);
    }
    remove(id, user, context) {
        return this.usersService.softDelete(id, user, context);
    }
    assignRole(id, dto, user, context) {
        return this.usersService.assignRole(id, dto, user, context);
    }
    removeRole(id, roleId, user, context) {
        return this.usersService.removeRole(id, roleId, user, context);
    }
    resetPassword(id, dto, user, context) {
        return this.usersService.resetPassword(id, dto, user, context);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, permissions_decorator_1.Permissions)("USER_READ"),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [pagination_query_dto_1.PaginationQueryDto]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "findAll", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("USER_READ"),
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "findOne", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("USER_CREATE"),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_user_dto_1.CreateUserDto, Object, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "create", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("USER_UPDATE"),
    (0, common_1.Patch)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_user_dto_1.UpdateUserDto, Object, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "update", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("USER_DELETE"),
    (0, common_1.Delete)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "remove", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("ROLE_ASSIGN"),
    (0, common_1.Post)(":id/roles"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, assign_role_dto_1.AssignRoleDto, Object, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "assignRole", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("ROLE_ASSIGN"),
    (0, common_1.Delete)(":id/roles/:roleId"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)("roleId", common_1.ParseIntPipe)),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "removeRole", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("USER_UPDATE"),
    (0, common_1.Post)(":id/reset-password"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, reset_user_password_dto_1.ResetUserPasswordDto, Object, Object]),
    __metadata("design:returntype", void 0)
], UsersController.prototype, "resetPassword", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)("users"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)("users"),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
//# sourceMappingURL=users.controller.js.map