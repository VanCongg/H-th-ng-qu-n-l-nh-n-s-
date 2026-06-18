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
exports.TaskAssignmentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const permissions_decorator_1 = require("../common/decorators/permissions.decorator");
const task_assignment_query_dto_1 = require("./dto/task-assignment-query.dto");
const task_assignments_service_1 = require("./task-assignments.service");
let TaskAssignmentsController = class TaskAssignmentsController {
    assignmentsService;
    constructor(assignmentsService) {
        this.assignmentsService = assignmentsService;
    }
    findAll(query, user) {
        return this.assignmentsService.findAll(query, user);
    }
};
exports.TaskAssignmentsController = TaskAssignmentsController;
__decorate([
    (0, permissions_decorator_1.Permissions)("TASK_ASSIGNMENT_READ"),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [task_assignment_query_dto_1.TaskAssignmentQueryDto, Object]),
    __metadata("design:returntype", void 0)
], TaskAssignmentsController.prototype, "findAll", null);
exports.TaskAssignmentsController = TaskAssignmentsController = __decorate([
    (0, swagger_1.ApiTags)("task-assignments"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)("task-assignments"),
    __metadata("design:paramtypes", [task_assignments_service_1.TaskAssignmentsService])
], TaskAssignmentsController);
//# sourceMappingURL=task-assignments.controller.js.map