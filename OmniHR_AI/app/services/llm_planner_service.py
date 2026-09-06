import json
import logging
import time
from typing import Any

from pydantic import ValidationError

from app.core.config import settings
from app.llm.base import LlmClient
from app.llm.factory import build_llm_client
from app.prompts.hrgenie_planner_prompt import HRGENIE_PLANNER_SYSTEM_PROMPT
from app.schemas.chat import ChatPlanRequest, ChatPlanResponse
from app.schemas.planner import (
    PlannerResponse,
    PlannerValidationError,
    planner_to_chat_response,
    validate_planner_response,
)
from app.schemas.rag import RagSearchRequest
from app.services.rag_service import RagService
from app.services.rule_based_planner_service import RuleBasedPlannerService

logger = logging.getLogger(__name__)


class LlmPlannerService:
    def __init__(
        self,
        client: LlmClient | None = None,
        fallback: RuleBasedPlannerService | None = None,
        fallback_enabled: bool | None = None,
        confidence_threshold: float | None = None,
        rag_service: RagService | None = None,
    ):
        self.client = client
        self.fallback = fallback or RuleBasedPlannerService()
        # Reuse the fallback's RagService instance by default so the same
        # seed documents aren't parsed twice per ToolPlannerService.
        self.rag_service = rag_service or self.fallback.rag_service
        self.fallback_enabled = (
            settings.llm_fallback_to_rule_based
            if fallback_enabled is None
            else fallback_enabled
        )
        self.confidence_threshold = (
            settings.llm_confidence_threshold
            if confidence_threshold is None
            else confidence_threshold
        )

    def plan(self, request: ChatPlanRequest) -> ChatPlanResponse:
        started_at = time.perf_counter()
        try:
            client = self.client or build_llm_client()
            raw_output = client.complete_json(self._messages(request))
            planner_response = PlannerResponse.model_validate(
                self._parse_json_object(raw_output)
            )
            planner_response = validate_planner_response(
                planner_response,
                {tool.name for tool in request.availableTools},
            )
            if planner_response.confidence < self.confidence_threshold:
                raise PlannerValidationError("Planner confidence is below threshold")

            response = planner_to_chat_response(planner_response)
            response.provider = settings.llm_provider
            response.model = settings.llm_model
            response.fallbackUsed = False
            self._log_plan(request, response, started_at)
            return response
        except (ValidationError, PlannerValidationError, ValueError, RuntimeError) as error:
            logger.info(
                "LLM planner fallback used conversationId=%s error=%s",
                request.conversationId,
                str(error),
            )
            if self.fallback_enabled:
                response = self.fallback.plan(request)
                response.provider = settings.llm_provider
                response.model = settings.llm_model
                response.fallbackUsed = True
                self._log_plan(request, response, started_at)
                return response
            response = ChatPlanResponse(
                type="answer",
                intent="UNKNOWN",
                reply=(
                    "Xin lỗi, tôi chưa hiểu rõ yêu cầu. "
                    "Bạn có thể hỏi lại ngắn gọn hơn không?"
                ),
                confidence=0.2,
                provider=settings.llm_provider,
                model=settings.llm_model,
                fallbackUsed=False,
            )
            self._log_plan(request, response, started_at)
            return response

    def _messages(self, request: ChatPlanRequest) -> list[dict[str, str]]:
        payload = {
            "conversationId": request.conversationId,
            "message": request.message,
            "locale": request.locale,
            "timezone": request.timezone,
            "currentDate": request.today,
            "userContext": request.userContext.model_dump(),
            "availableTools": [
                tool.model_dump()
                for tool in request.availableTools
            ],
            "history": self._history_payload(request),
        }
        policy_context = self._policy_context(request.message)
        if policy_context:
            payload["policyContext"] = policy_context
        return [
            {
                "role": "system",
                "content": HRGENIE_PLANNER_SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": json.dumps(payload, ensure_ascii=False),
            },
        ]

    def _policy_context(self, message: str) -> list[dict[str, str]]:
        result = self.rag_service.search(RagSearchRequest(query=message, topK=3))
        return [
            {"title": item.title, "content": item.content}
            for item in result.items
        ]

    def _history_payload(self, request: ChatPlanRequest) -> list[dict[str, str]]:
        items = []
        for message in request.history[-6:]:
            content = message.content.strip()
            if len(content) > 1000:
                content = f"{content[:1000]}..."
            items.append({"role": message.role, "content": content})
        return items

    def _parse_json_object(self, value: str) -> dict[str, Any]:
        text = value.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines).strip()

        if not text.startswith("{"):
            start = text.find("{")
            end = text.rfind("}")
            if start >= 0 and end > start:
                text = text[start : end + 1]

        parsed = json.loads(text)
        if not isinstance(parsed, dict):
            raise ValueError("LLM output must be a JSON object")
        return parsed

    def _log_plan(
        self,
        request: ChatPlanRequest,
        response: ChatPlanResponse,
        started_at: float,
    ) -> None:
        latency_ms = round((time.perf_counter() - started_at) * 1000)
        logger.info(
            "chat_plan conversationId=%s userId=%s provider=%s model=%s intent=%s tools=%s latencyMs=%s fallbackUsed=%s success=true",
            request.conversationId,
            request.userContext.userId,
            response.provider or settings.llm_provider,
            response.model or settings.llm_model,
            response.intent or "UNKNOWN",
            ",".join(call.toolName for call in response.toolCalls) or "-",
            latency_ms,
            response.fallbackUsed,
        )
