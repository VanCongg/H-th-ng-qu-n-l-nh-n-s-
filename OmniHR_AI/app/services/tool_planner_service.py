import logging

from app.schemas.chat import ChatPlanRequest, ChatPlanResponse
from app.core.config import settings
from app.services.llm_planner_service import LlmPlannerService
from app.services.rule_based_planner_service import RuleBasedPlannerService

logger = logging.getLogger(__name__)


class ToolPlannerService:
    def __init__(
        self,
        rule_based: RuleBasedPlannerService | None = None,
        llm: LlmPlannerService | None = None,
    ):
        self.rule_based = rule_based or RuleBasedPlannerService()
        self.llm = llm

    def plan(self, request: ChatPlanRequest) -> ChatPlanResponse:
        mode = settings.ai_planner_mode.strip().lower()

        if mode == "rule_based":
            return self.rule_based.plan(request)

        if mode in {"llm", "hybrid"}:
            if self.llm is None:
                self.llm = LlmPlannerService(fallback=self.rule_based)
            return self.llm.plan(request)

        logger.info("Unknown AI_PLANNER_MODE=%s, using rule_based", mode)
        return self.rule_based.plan(request)
