"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskAssignmentsModule = void 0;
const common_1 = require("@nestjs/common");
const access_control_service_1 = require("../common/services/access-control.service");
const prisma_module_1 = require("../prisma/prisma.module");
const task_assignments_controller_1 = require("./task-assignments.controller");
const task_assignments_service_1 = require("./task-assignments.service");
let TaskAssignmentsModule = class TaskAssignmentsModule {
};
exports.TaskAssignmentsModule = TaskAssignmentsModule;
exports.TaskAssignmentsModule = TaskAssignmentsModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [task_assignments_controller_1.TaskAssignmentsController],
        providers: [task_assignments_service_1.TaskAssignmentsService, access_control_service_1.AccessControlService],
        exports: [task_assignments_service_1.TaskAssignmentsService]
    })
], TaskAssignmentsModule);
//# sourceMappingURL=task-assignments.module.js.map