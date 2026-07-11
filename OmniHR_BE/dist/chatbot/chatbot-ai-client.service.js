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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatbotAiClientService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let ChatbotAiClientService = class ChatbotAiClientService {
    config;
    constructor(config) {
        this.config = config;
    }
    async plan(payload) {
        const baseUrl = this.cleanBaseUrl(this.config.get("AI_SERVICE_URL") ?? "http://localhost:8000");
        const token = this.config.get("AI_INTERNAL_TOKEN") ?? "change-me";
        const timeoutMs = Number(this.config.get("AI_TIMEOUT_MS") ?? 30000);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(`${baseUrl}/internal/chat/plan`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "X-Internal-Service-Token": token,
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            if (!response.ok) {
                throw new Error(`AI service returned ${response.status}`);
            }
            return this.normalizePlan(await response.json());
        }
        finally {
            clearTimeout(timeout);
        }
    }
    normalizePlan(value) {
        if (!isRecord(value)) {
            throw new Error("AI service returned an invalid response");
        }
        const type = value.type;
        if (type !== "answer" &&
            type !== "tool_plan" &&
            type !== "confirmation_required") {
            throw new Error("AI service returned an unknown plan type");
        }
        const toolCalls = Array.isArray(value.toolCalls)
            ? value.toolCalls
                .filter(isRecord)
                .map((toolCall, index) => ({
                id: typeof toolCall.id === "string"
                    ? toolCall.id
                    : `call_${index + 1}`,
                toolName: String(toolCall.toolName ?? ""),
                arguments: isRecord(toolCall.arguments) ? toolCall.arguments : {},
            }))
                .filter((toolCall) => Boolean(toolCall.toolName))
            : [];
        return {
            type,
            intent: typeof value.intent === "string" ? value.intent : undefined,
            reply: typeof value.reply === "string" ? value.reply : "",
            toolCalls,
            needConfirmation: value.needConfirmation === true,
            confirmation: isRecord(value.confirmation)
                ? {
                    title: typeof value.confirmation.title === "string"
                        ? value.confirmation.title
                        : undefined,
                    summary: isRecord(value.confirmation.summary)
                        ? value.confirmation.summary
                        : undefined,
                }
                : undefined,
            confidence: typeof value.confidence === "number" &&
                Number.isFinite(value.confidence)
                ? value.confidence
                : undefined,
            fallbackUsed: typeof value.fallbackUsed === "boolean" ? value.fallbackUsed : undefined,
            provider: typeof value.provider === "string" ? value.provider : undefined,
            model: typeof value.model === "string" ? value.model : undefined,
            citations: Array.isArray(value.citations)
                ? value.citations.filter(isRecord)
                : undefined,
        };
    }
    cleanBaseUrl(value) {
        return value.trim().replace(/\/+$/, "");
    }
};
exports.ChatbotAiClientService = ChatbotAiClientService;
exports.ChatbotAiClientService = ChatbotAiClientService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ChatbotAiClientService);
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=chatbot-ai-client.service.js.map