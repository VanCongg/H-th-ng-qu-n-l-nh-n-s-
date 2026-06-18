"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskWorkloadModule = void 0;
const common_1 = require("@nestjs/common");
const access_control_service_1 = require("../common/services/access-control.service");
const prisma_module_1 = require("../prisma/prisma.module");
const task_workload_controller_1 = require("./task-workload.controller");
const task_workload_service_1 = require("./task-workload.service");
let TaskWorkloadModule = class TaskWorkloadModule {
};
exports.TaskWorkloadModule = TaskWorkloadModule;
exports.TaskWorkloadModule = TaskWorkloadModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [task_workload_controller_1.TaskWorkloadController],
        providers: [task_workload_service_1.TaskWorkloadService, access_control_service_1.AccessControlService],
        exports: [task_workload_service_1.TaskWorkloadService]
    })
], TaskWorkloadModule);
//# sourceMappingURL=task-workload.module.js.map