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
exports.RolesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const permissions_decorator_1 = require("../common/decorators/permissions.decorator");
const request_context_decorator_1 = require("../common/decorators/request-context.decorator");
const assign_permission_dto_1 = require("./dto/assign-permission.dto");
const create_role_dto_1 = require("./dto/create-role.dto");
const update_role_dto_1 = require("./dto/update-role.dto");
const roles_service_1 = require("./roles.service");
let RolesController = class RolesController {
    rolesService;
    constructor(rolesService) {
        this.rolesService = rolesService;
    }
    findAll() {
        return this.rolesService.findAll();
    }
    findOne(id) {
        return this.rolesService.findOne(id);
    }
    create(dto, user, context) {
        return this.rolesService.create(dto, user, context);
    }
    update(id, dto, user, context) {
        return this.rolesService.update(id, dto, user, context);
    }
    remove(id, user, context) {
        return this.rolesService.remove(id, user, context);
    }
    assignPermission(id, dto, user, context) {
        return this.rolesService.assignPermission(id, dto, user, context);
    }
    removePermission(id, permissionId, user, context) {
        return this.rolesService.removePermission(id, permissionId, user, context);
    }
};
exports.RolesController = RolesController;
__decorate([
    (0, permissions_decorator_1.Permissions)("ROLE_READ"),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RolesController.prototype, "findAll", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("ROLE_READ"),
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], RolesController.prototype, "findOne", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("ROLE_CREATE"),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_role_dto_1.CreateRoleDto, Object, Object]),
    __metadata("design:returntype", void 0)
], RolesController.prototype, "create", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("ROLE_UPDATE"),
    (0, common_1.Patch)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_role_dto_1.UpdateRoleDto, Object, Object]),
    __metadata("design:returntype", void 0)
], RolesController.prototype, "update", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("ROLE_DELETE"),
    (0, common_1.Delete)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], RolesController.prototype, "remove", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("PERMISSION_ASSIGN"),
    (0, common_1.Post)(":id/permissions"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, assign_permission_dto_1.AssignPermissionDto, Object, Object]),
    __metadata("design:returntype", void 0)
], RolesController.prototype, "assignPermission", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("PERMISSION_ASSIGN"),
    (0, common_1.Delete)(":id/permissions/:permissionId"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)("permissionId", common_1.ParseIntPipe)),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object, Object]),
    __metadata("design:returntype", void 0)
], RolesController.prototype, "removePermission", null);
exports.RolesController = RolesController = __decorate([
    (0, swagger_1.ApiTags)("roles"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)("roles"),
    __metadata("design:paramtypes", [roles_service_1.RolesService])
], RolesController);
//# sourceMappingURL=roles.controller.js.map