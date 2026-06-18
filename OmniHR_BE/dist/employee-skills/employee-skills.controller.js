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
exports.EmployeeSkillsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const permissions_decorator_1 = require("../common/decorators/permissions.decorator");
const request_context_decorator_1 = require("../common/decorators/request-context.decorator");
const create_employee_skill_dto_1 = require("./dto/create-employee-skill.dto");
const update_employee_skill_dto_1 = require("./dto/update-employee-skill.dto");
const employee_skills_service_1 = require("./employee-skills.service");
let EmployeeSkillsController = class EmployeeSkillsController {
    employeeSkillsService;
    constructor(employeeSkillsService) {
        this.employeeSkillsService = employeeSkillsService;
    }
    findByEmployee(employeeId, user) {
        return this.employeeSkillsService.findByEmployee(employeeId, user);
    }
    create(employeeId, dto, user, context) {
        return this.employeeSkillsService.create(employeeId, dto, user, context);
    }
    update(id, dto, user, context) {
        return this.employeeSkillsService.update(id, dto, user, context);
    }
    remove(id, user, context) {
        return this.employeeSkillsService.remove(id, user, context);
    }
};
exports.EmployeeSkillsController = EmployeeSkillsController;
__decorate([
    (0, permissions_decorator_1.Permissions)("EMPLOYEE_SKILL_READ"),
    (0, common_1.Get)("employees/:employeeId/skills"),
    __param(0, (0, common_1.Param)("employeeId", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], EmployeeSkillsController.prototype, "findByEmployee", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("EMPLOYEE_SKILL_CREATE"),
    (0, common_1.Post)("employees/:employeeId/skills"),
    __param(0, (0, common_1.Param)("employeeId", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, create_employee_skill_dto_1.CreateEmployeeSkillDto, Object, Object]),
    __metadata("design:returntype", void 0)
], EmployeeSkillsController.prototype, "create", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("EMPLOYEE_SKILL_UPDATE"),
    (0, common_1.Patch)("employee-skills/:id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_employee_skill_dto_1.UpdateEmployeeSkillDto, Object, Object]),
    __metadata("design:returntype", void 0)
], EmployeeSkillsController.prototype, "update", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("EMPLOYEE_SKILL_DELETE"),
    (0, common_1.Delete)("employee-skills/:id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], EmployeeSkillsController.prototype, "remove", null);
exports.EmployeeSkillsController = EmployeeSkillsController = __decorate([
    (0, swagger_1.ApiTags)("employee-skills"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [employee_skills_service_1.EmployeeSkillsService])
], EmployeeSkillsController);
//# sourceMappingURL=employee-skills.controller.js.map