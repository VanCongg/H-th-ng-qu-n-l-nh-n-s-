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
exports.EmployeesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const permissions_decorator_1 = require("../common/decorators/permissions.decorator");
const request_context_decorator_1 = require("../common/decorators/request-context.decorator");
const create_employee_dto_1 = require("./dto/create-employee.dto");
const employee_query_dto_1 = require("./dto/employee-query.dto");
const update_employee_dto_1 = require("./dto/update-employee.dto");
const update_self_employee_dto_1 = require("./dto/update-self-employee.dto");
const employees_service_1 = require("./employees.service");
let EmployeesController = class EmployeesController {
    employeesService;
    constructor(employeesService) {
        this.employeesService = employeesService;
    }
    findAll(query) {
        return this.employeesService.findAll(query);
    }
    findTeam(user, query) {
        return this.employeesService.findTeam(user, query);
    }
    me(user) {
        return this.employeesService.myProfile(user);
    }
    updateMe(user, dto, context) {
        return this.employeesService.updateSelf(user, dto, context);
    }
    findOne(id, user) {
        return this.employeesService.findOne(id, user);
    }
    create(dto, user, context) {
        return this.employeesService.create(dto, user, context);
    }
    update(id, dto, user, context) {
        return this.employeesService.update(id, dto, user, context);
    }
    remove(id, user, context) {
        return this.employeesService.softDelete(id, user, context);
    }
    resetPassword(id, user, context) {
        return this.employeesService.resetPassword(id, user, context);
    }
    lockUser(id, user, context) {
        return this.employeesService.setUserActive(id, false, user, context);
    }
    unlockUser(id, user, context) {
        return this.employeesService.setUserActive(id, true, user, context);
    }
};
exports.EmployeesController = EmployeesController;
__decorate([
    (0, permissions_decorator_1.Permissions)("EMPLOYEE_READ_ALL"),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [employee_query_dto_1.EmployeeQueryDto]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "findAll", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("EMPLOYEE_READ_TEAM"),
    (0, common_1.Get)("team"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, employee_query_dto_1.EmployeeQueryDto]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "findTeam", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("EMPLOYEE_READ_SELF"),
    (0, common_1.Get)("me"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "me", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("EMPLOYEE_UPDATE_SELF"),
    (0, common_1.Patch)("me"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_self_employee_dto_1.UpdateSelfEmployeeDto, Object]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "updateMe", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("EMPLOYEE_READ_ALL", "EMPLOYEE_READ_TEAM", "EMPLOYEE_READ_SELF"),
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "findOne", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("EMPLOYEE_CREATE"),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_employee_dto_1.CreateEmployeeDto, Object, Object]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "create", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("EMPLOYEE_UPDATE_ALL"),
    (0, common_1.Patch)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_employee_dto_1.UpdateEmployeeDto, Object, Object]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "update", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("EMPLOYEE_DELETE"),
    (0, common_1.Delete)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "remove", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("EMPLOYEE_UPDATE_ALL"),
    (0, common_1.Post)(":id/reset-password"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "resetPassword", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("EMPLOYEE_UPDATE_ALL"),
    (0, common_1.Post)(":id/lock-user"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "lockUser", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("EMPLOYEE_UPDATE_ALL"),
    (0, common_1.Post)(":id/unlock-user"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "unlockUser", null);
exports.EmployeesController = EmployeesController = __decorate([
    (0, swagger_1.ApiTags)("employees"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)("employees"),
    __metadata("design:paramtypes", [employees_service_1.EmployeesService])
], EmployeesController);
//# sourceMappingURL=employees.controller.js.map