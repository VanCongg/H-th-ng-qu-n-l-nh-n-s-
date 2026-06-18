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
exports.TasksController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const permissions_decorator_1 = require("../common/decorators/permissions.decorator");
const request_context_decorator_1 = require("../common/decorators/request-context.decorator");
const assign_task_dto_1 = require("./dto/assign-task.dto");
const create_task_dto_1 = require("./dto/create-task.dto");
const task_query_dto_1 = require("./dto/task-query.dto");
const update_task_dto_1 = require("./dto/update-task.dto");
const update_task_status_dto_1 = require("./dto/update-task-status.dto");
const tasks_service_1 = require("./tasks.service");
let TasksController = class TasksController {
    tasksService;
    constructor(tasksService) {
        this.tasksService = tasksService;
    }
    findAll(query, user) {
        return this.tasksService.findAll(query, user);
    }
    findTeam(query, user) {
        return this.tasksService.findTeam(query, user);
    }
    findSelf(query, user) {
        return this.tasksService.findSelf(query, user);
    }
    findOne(id, user) {
        return this.tasksService.findOne(id, user);
    }
    create(dto, user, context) {
        return this.tasksService.create(dto, user, context);
    }
    update(id, dto, user, context) {
        return this.tasksService.update(id, dto, user, context);
    }
    remove(id, user, context) {
        return this.tasksService.softDelete(id, user, context);
    }
    assign(id, dto, user, context) {
        return this.tasksService.assign(id, dto, user, context);
    }
    updateStatus(id, dto, user, context) {
        return this.tasksService.updateStatus(id, dto, user, context);
    }
};
exports.TasksController = TasksController;
__decorate([
    (0, permissions_decorator_1.Permissions)("TASK_READ_ALL"),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [task_query_dto_1.TaskQueryDto, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "findAll", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("TASK_READ_TEAM"),
    (0, common_1.Get)("team"),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [task_query_dto_1.TaskQueryDto, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "findTeam", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("TASK_READ_SELF"),
    (0, common_1.Get)("me"),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [task_query_dto_1.TaskQueryDto, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "findSelf", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("TASK_READ_ALL", "TASK_READ_TEAM", "TASK_READ_SELF"),
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "findOne", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("TASK_CREATE"),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_task_dto_1.CreateTaskDto, Object, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "create", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("TASK_UPDATE"),
    (0, common_1.Patch)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_task_dto_1.UpdateTaskDto, Object, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "update", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("TASK_DELETE"),
    (0, common_1.Delete)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "remove", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("TASK_ASSIGN"),
    (0, common_1.Post)(":id/assign"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, assign_task_dto_1.AssignTaskDto, Object, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "assign", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("TASK_UPDATE_STATUS"),
    (0, common_1.Patch)(":id/status"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_task_status_dto_1.UpdateTaskStatusDto, Object, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "updateStatus", null);
exports.TasksController = TasksController = __decorate([
    (0, swagger_1.ApiTags)("tasks"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)("tasks"),
    __metadata("design:paramtypes", [tasks_service_1.TasksService])
], TasksController);
//# sourceMappingURL=tasks.controller.js.map