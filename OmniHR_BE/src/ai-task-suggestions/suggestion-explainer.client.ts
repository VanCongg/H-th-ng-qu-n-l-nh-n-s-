import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type ExplainCandidateInput = {
  employeeId: number;
  fullName: string;
  score: number;
  skillScore: number;
  workloadScore: number;
  availabilityScore: number;
  eligible: boolean;
  matchedSkills: string[];
  missingRequiredSkills: string[];
  missingImportantSkills: string[];
  activeTaskCount: number;
  availableHours: number;
  warnings: string[];
};

/**
 * Asks the AI service to word the ranking the scorer already produced.
 *
 * Wording only: the order, the scores and the stored snapshot are fixed before
 * this runs, so every failure path returns an empty map and the caller keeps
 * the sentence it built itself. Nothing here can change who is suggested.
 */
@Injectable()
export class SuggestionExplainerClient {
  private readonly logger = new Logger(SuggestionExplainerClient.name);

  constructor(private readonly config: ConfigService) {}

  get enabled() {
    return (
      (this.config.get<string>("AI_SUGGESTION_EXPLANATIONS") ?? "true") !== "false"
    );
  }

  async explain(
    taskTitle: string,
    requiredSkills: string[],
    candidates: ExplainCandidateInput[]
  ): Promise<Map<number, string>> {
    if (!this.enabled || !candidates.length) {
      return new Map();
    }

    const token = this.config.get<string>("AI_INTERNAL_TOKEN");
    if (!token) {
      return new Map();
    }

    const baseUrl = this.cleanBaseUrl(
      this.config.get<string>("AI_SERVICE_URL") ?? "http://localhost:8000"
    );
    // Shorter than the chatbot's budget: a manager is waiting on a list that
    // is already correct without this call.
    const timeoutMs = Number(
      this.config.get<string>("AI_SUGGESTION_EXPLAIN_TIMEOUT_MS") ?? 8000
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/internal/suggestions/explain`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Internal-Service-Token": token
        },
        body: JSON.stringify({ taskTitle, requiredSkills, candidates }),
        signal: controller.signal
      });

      if (!response.ok) {
        this.logger.debug(`Explanation service returned ${response.status}`);
        return new Map();
      }

      return this.readExplanations(await response.json());
    } catch (error) {
      this.logger.debug(
        `Explanation service unavailable: ${error instanceof Error ? error.message : "unknown error"}`
      );
      return new Map();
    } finally {
      clearTimeout(timeout);
    }
  }

  private readExplanations(value: unknown): Map<number, string> {
    const explanations = new Map<number, string>();
    if (!isRecord(value) || !Array.isArray(value.explanations)) {
      return explanations;
    }

    for (const row of value.explanations) {
      if (!isRecord(row)) {
        continue;
      }
      const { employeeId, reason } = row;
      if (
        typeof employeeId === "number" &&
        typeof reason === "string" &&
        reason.trim()
      ) {
        explanations.set(employeeId, reason.trim());
      }
    }

    return explanations;
  }

  private cleanBaseUrl(value: string) {
    return value.replace(/\/+$/, "");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
