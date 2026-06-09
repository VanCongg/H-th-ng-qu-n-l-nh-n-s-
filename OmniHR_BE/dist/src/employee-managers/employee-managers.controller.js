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
exports.EmployeeManagersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const permissions_decorator_1 = require("../common/decorators/permissions.decorator");
const request_context_decorator_1 = require("../common/decorators/request-context.decorator");
const assign_manager_dto_1 = require("./dto/assign-manager.dto");
const end_manager_dto_1 = require("./dto/end-manager.dto");
const employee_managers_service_1 = require("./employee-managers.service");
let EmployeeManagersController = class EmployeeManagersController {
    employeeManagersService;
    constructor(employeeManagersService) {
        this.employeeManagersService = employeeManagersService;
    }
    findAll() {
        return this.employeeManagersService.findAll();
    }
    findByEmployee(employeeId) {
        return this.employeeManagersService.findByEmployee(employeeId);
    }
    findSubordinates(managerId) {
        return this.employeeManagersService.findSubordinates(managerId);
    }
    assign(dto, user, context) {
        return this.employeeManagersService.assign(dto, user, context);
    }
    end(id, dto, user, context) {
        return this.employeeManagersService.end(id, dto, user, context);
    }
};
exports.EmployeeManagersController = EmployeeManagersController;
__decorate([
    (0, permissions_decorator_1.Permissions)("MANAGER_READ"),
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EmployeeManagersController.prototype, "findAll", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("MANAGER_READ"),
    (0, common_1.Get)("employee/:employeeId"),
    __param(0, (0, common_1.Param)("employeeId", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EmployeeManagersController.prototype, "findByEmployee", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("MANAGER_READ"),
    (0, common_1.Get)("manager/:managerId/subordinates"),
    __param(0, (0, common_1.Param)("managerId", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], EmployeeManagersController.prototype, "findSubordinates", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("MANAGER_ASSIGN"),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [assign_manager_dto_1.AssignManagerDto, Object, Object]),
    __metadata("design:returntype", void 0)
], EmployeeManagersController.prototype, "assign", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("MANAGER_REMOVE"),
    (0, common_1.Patch)(":id/end"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, end_manager_dto_1.EndManagerDto, Object, Object]),
    __metadata("design:returntype", void 0)
], EmployeeManagersController.prototype, "end", null);
exports.EmployeeManagersController = EmployeeManagersController = __decorate([
    (0, swagger_1.ApiTags)("employee-managers"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)("employee-managers"),
    __metadata("design:paramtypes", [employee_managers_service_1.EmployeeManagersService])
], EmployeeManagersController);
//# sourceMappingURL=employee-managers.controller.js.map