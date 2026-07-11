import { ConfigService } from "@nestjs/config";
import { AiPlanResponse } from "./types/chatbot.types";
export declare class ChatbotAiClientService {
    private readonly config;
    constructor(config: ConfigService);
    plan(payload: Record<string, unknown>): Promise<AiPlanResponse>;
    private normalizePlan;
    private cleanBaseUrl;
}
