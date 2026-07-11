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
exports.ChatbotController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const request_context_decorator_1 = require("../common/decorators/request-context.decorator");
const chatbot_service_1 = require("./chatbot.service");
const chatbot_cancel_action_dto_1 = require("./dto/chatbot-cancel-action.dto");
const chatbot_message_dto_1 = require("./dto/chatbot-message.dto");
let ChatbotController = class ChatbotController {
    chatbotService;
    constructor(chatbotService) {
        this.chatbotService = chatbotService;
    }
    sendMessage(dto, user, context) {
        return this.chatbotService.sendMessage(dto, user, context);
    }
    listConversations(user) {
        return this.chatbotService.listConversations(user);
    }
    listMessages(id, user) {
        return this.chatbotService.listMessages(user, id);
    }
    confirmAction(actionId, user, context) {
        return this.chatbotService.confirmAction(actionId, user, context);
    }
    cancelAction(actionId, dto, user, context) {
        return this.chatbotService.cancelAction(actionId, dto, user, context);
    }
};
exports.ChatbotController = ChatbotController;
__decorate([
    (0, common_1.Post)("message"),
    (0, throttler_1.Throttle)({ default: { limit: 20, ttl: 60000 } }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatbot_message_dto_1.ChatbotMessageDto, Object, Object]),
    __metadata("design:returntype", void 0)
], ChatbotController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Get)("conversations"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatbotController.prototype, "listConversations", null);
__decorate([
    (0, common_1.Get)("conversations/:id/messages"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], ChatbotController.prototype, "listMessages", null);
__decorate([
    (0, common_1.Post)("actions/:actionId/confirm"),
    __param(0, (0, common_1.Param)("actionId", common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], ChatbotController.prototype, "confirmAction", null);
__decorate([
    (0, common_1.Post)("actions/:actionId/cancel"),
    __param(0, (0, common_1.Param)("actionId", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, request_context_decorator_1.ReqContext)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, chatbot_cancel_action_dto_1.ChatbotCancelActionDto, Object, Object]),
    __metadata("design:returntype", void 0)
], ChatbotController.prototype, "cancelAction", null);
exports.ChatbotController = ChatbotController = __decorate([
    (0, swagger_1.ApiTags)("chatbot"),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)("chatbot"),
    __metadata("design:paramtypes", [chatbot_service_1.ChatbotService])
], ChatbotController);
//# sourceMappingURL=chatbot.controller.js.map