"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeSkillsModule = void 0;
const common_1 = require("@nestjs/common");
const access_control_service_1 = require("../common/services/access-control.service");
const audit_service_1 = require("../common/services/audit.service");
const prisma_module_1 = require("../prisma/prisma.module");
const employee_skills_controller_1 = require("./employee-skills.controller");
const employee_skills_service_1 = require("./employee-skills.service");
let EmployeeSkillsModule = class EmployeeSkillsModule {
};
exports.EmployeeSkillsModule = EmployeeSkillsModule;
exports.EmployeeSkillsModule = EmployeeSkillsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [employee_skills_controller_1.EmployeeSkillsController],
        providers: [employee_skills_service_1.EmployeeSkillsService, audit_service_1.AuditService, access_control_service_1.AccessControlService],
        exports: [employee_skills_service_1.EmployeeSkillsService]
    })
], EmployeeSkillsModule);
//# sourceMappingURL=employee-skills.module.js.map