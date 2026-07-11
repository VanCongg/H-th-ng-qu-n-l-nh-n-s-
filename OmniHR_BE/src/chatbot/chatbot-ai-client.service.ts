import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiPlanResponse, AiToolCall } from "./types/chatbot.types";

@Injectable()
export class ChatbotAiClientService {
  constructor(private readonly config: ConfigService) {}

  async plan(payload: Record<string, unknown>): Promise<AiPlanResponse> {
    const baseUrl = this.cleanBaseUrl(
      this.config.get<string>("AI_SERVICE_URL") ?? "http://localhost:8000",
    );
    const token = this.config.get<string>("AI_INTERNAL_TOKEN") ?? "change-me";
    const timeoutMs = Number(this.config.get<string>("AI_TIMEOUT_MS") ?? 30000);
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
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizePlan(value: unknown): AiPlanResponse {
    if (!isRecord(value)) {
      throw new Error("AI service returned an invalid response");
    }

    const type = value.type;
    if (
      type !== "answer" &&
      type !== "tool_plan" &&
      type !== "confirmation_required"
    ) {
      throw new Error("AI service returned an unknown plan type");
    }

    const toolCalls = Array.isArray(value.toolCalls)
      ? value.toolCalls
          .filter(isRecord)
          .map((toolCall, index) => ({
            id:
              typeof toolCall.id === "string"
                ? toolCall.id
                : `call_${index + 1}`,
            toolName: String(toolCall.toolName ?? ""),
            arguments: isRecord(toolCall.arguments) ? toolCall.arguments : {},
          }))
          .filter((toolCall): toolCall is AiToolCall =>
            Boolean(toolCall.toolName),
          )
      : [];

    return {
      type,
      intent: typeof value.intent === "string" ? value.intent : undefined,
      reply: typeof value.reply === "string" ? value.reply : "",
      toolCalls,
      needConfirmation: value.needConfirmation === true,
      confirmation: isRecord(value.confirmation)
        ? {
            title:
              typeof value.confirmation.title === "string"
                ? value.confirmation.title
                : undefined,
            summary: isRecord(value.confirmation.summary)
              ? value.confirmation.summary
              : undefined,
          }
        : undefined,
      confidence:
        typeof value.confidence === "number" &&
        Number.isFinite(value.confidence)
          ? value.confidence
          : undefined,
      fallbackUsed:
        typeof value.fallbackUsed === "boolean" ? value.fallbackUsed : undefined,
      provider: typeof value.provider === "string" ? value.provider : undefined,
      model: typeof value.model === "string" ? value.model : undefined,
      citations: Array.isArray(value.citations)
        ? value.citations.filter(isRecord)
        : undefined,
    };
  }

  private cleanBaseUrl(value: string) {
    return value.trim().replace(/\/+$/, "");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
