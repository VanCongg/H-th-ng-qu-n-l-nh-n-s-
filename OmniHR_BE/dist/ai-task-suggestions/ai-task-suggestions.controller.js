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
exports.AiTaskSuggestionsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const permissions_decorator_1 = require("../common/decorators/permissions.decorator");
const request_context_decorator_1 = require("../common/decorators/request-context.decorator");
const ai_task_suggestions_service_1 = require("./ai-task-suggestions.service");
const ai_task_suggestion_query_dto_1 = require("./dto/ai-task-suggestion-query.dto");
const cancel_ai_task_suggestion_dto_1 = require("./dto/cancel-ai-task-suggestion.dto");
const generate_ai_task_suggestion_dto_1 = require("./dto/generate-ai-task-suggestion.dto");
const select_ai_task_suggestion_dto_1 = require("./dto/select-ai-task-suggestion.dto");
let AiTaskSuggestionsController = class AiTaskSuggestionsController {
    suggestionsService;
    constructor(suggestionsService) {
        this.suggestionsService = suggestionsService;
    }
    generate(taskId, dto, user, context) {
        return this.suggestionsService.generate(taskId, dto, user, context);
    }
    findByTask(taskId, user) {
        return this.suggestionsService.findByTask(taskId, user);
    }
    findAll(query, user) {
        return this.suggestionsService.findAll(query, user);
    }
    findOne(id, user) {
        return this.suggestionsService.findOne(id, user);
    }
    select(id, dto, user, context) {
        return this.suggestionsService.select(id, dto, user, context);
    }
    cancel(id, dto, user, context) {
        return this.suggestionsService.cancel(id, dto, user, context);
    }
};
exports.AiTaskSuggestionsController = AiTaskSuggestionsController;
__decorate([
    (0, permissions_decorator_1.Permissions)("AI_TASK_SUGGEST"),
    (0, common_1.Post)("tasks/:taskId/ai-suggestions"),
    __param(0, (0, common_1.Param)("taskId", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, generate_ai_task_suggestion_dto_1.GenerateAiTaskSuggestionDto, Object, Object]),
    __metadata("design:returntype", void 0)
], AiTaskSuggestionsController.prototype, "generate", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("AI_TASK_SUGGEST", "AI_TASK_SELECT", "TASK_ASSIGNMENT_READ"),
    (0, common_1.Get)("tasks/:taskId/ai-suggestions"),
    __param(0, (0, common_1.Param)("taskId", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AiTaskSuggestionsController.prototype, "findByTask", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("AI_TASK_SUGGEST", "AI_TASK_SELECT", "TASK_ASSIGNMENT_READ"),
    (0, common_1.Get)("ai-task-suggestions"),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ai_task_suggestion_query_dto_1.AiTaskSuggestionQueryDto, Object]),
    __metadata("design:returntype", void 0)
], AiTaskSuggestionsController.prototype, "findAll", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("AI_TASK_SUGGEST", "AI_TASK_SELECT", "TASK_ASSIGNMENT_READ"),
    (0, common_1.Get)("ai-task-suggestions/:id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], AiTaskSuggestionsController.prototype, "findOne", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("AI_TASK_SELECT"),
    (0, common_1.Post)("ai-task-suggestions/:id/select"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, select_ai_task_suggestion_dto_1.SelectAiTaskSuggestionDto, Object, Object]),
    __metadata("design:returntype", void 0)
], AiTaskSuggestionsController.prototype, "select", null);
__decorate([
    (0, permissions_decorator_1.Permissions)("AI_TASK_SELECT"),
    (0, common_1.Post)("ai-task-suggestions/:id/cancel"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, cancel_ai_task_suggestion_dto_1.CancelAiTaskSuggestionDto, Object, Object]),
    __metadata("design:returntype", void 0)
], AiTaskSuggestionsController.prototype, "cancel", null);
exports.AiTaskSuggestionsController = AiTaskSuggestionsController = __decorate([
    (0, swagger_1.ApiTags)("ai-task-suggestions"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [ai_task_suggestions_service_1.AiTaskSuggestionsService])
], AiTaskSuggestionsController);
//# sourceMappingURL=ai-task-suggestions.controller.js.map