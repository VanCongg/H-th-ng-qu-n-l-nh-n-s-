import re
import unicodedata
from datetime import date, timedelta
from uuid import uuid4

from app.schemas.chat import (
    ChatPlanRequest,
    ChatPlanResponse,
    Confirmation,
    ToolCall,
)


class _LegacyRuleBasedPlannerService:
    def plan(self, request: ChatPlanRequest) -> ChatPlanResponse:
        text = request.message.strip()
        normalized = self._normalize(text)
        available = {tool.name for tool in request.availableTools}

        if self._is_leave_request(normalized):
            return self._leave_request_plan(request, text, normalized, available)

        if self._has_any(normalized, "con bao nhieu ngay phep", "so phep", "phep con"):
            return self._tool_plan(
                "get_my_leave_balance",
                {"year": self._today(request).year},
                available,
                "Tôi sẽ kiểm tra số ngày phép còn lại của bạn.",
            )

        if self._has_any(
            normalized,
            "don nghi gan nhat",
            "trang thai don nghi",
            "don nghi cua toi",
            "duyet chua",
        ):
            return self._tool_plan(
                "get_my_leave_requests",
                {"limit": 5},
                available,
                "Tôi sẽ kiểm tra các đơn nghỉ gần đây của bạn.",
            )

        if self._has_any(normalized, "check-in", "check in", "cham cong chua", "di muon hom nay"):
            return self._tool_plan(
                "get_today_attendance",
                {},
                available,
                "Tôi sẽ kiểm tra chấm công hôm nay của bạn.",
            )

        if self._has_any(normalized, "di muon", "gio lam", "ban kinh cham cong", "quy dinh cham cong"):
            return self._tool_plan(
                "get_attendance_policy",
                {},
                available,
                "Tôi sẽ kiểm tra cấu hình chấm công hiện tại.",
            )

        if self._has_any(normalized, "phong ban", "manager", "quan ly", "ho so", "toi la ai"):
            return self._tool_plan(
                "get_my_profile",
                {},
                available,
                "Tôi sẽ kiểm tra hồ sơ nhân viên của bạn.",
            )

        if self._has_any(normalized, "task", "cong viec", "deadline", "den han"):
            return self._tool_plan(
                "get_my_tasks",
                {"status": ["TODO", "IN_PROGRESS"], "limit": 10},
                available,
                "Tôi sẽ kiểm tra các task đang mở của bạn.",
            )

        if self._has_any(normalized, "loai nghi", "nghi phep nam", "nghi om"):
            return self._tool_plan(
                "get_leave_types",
                {},
                available,
                "Tôi sẽ kiểm tra các loại nghỉ đang áp dụng.",
            )

        return ChatPlanResponse(
            type="answer",
            reply=(
                "Tôi có thể hỗ trợ bạn hỏi về chấm công, nghỉ phép, hồ sơ cá nhân "
                "hoặc task. Bạn muốn kiểm tra thông tin nào?"
            ),
            confidence=0.62,
        )

    def _leave_request_plan(
        self,
        request: ChatPlanRequest,
        original_text: str,
        normalized: str,
        available: set[str],
    ) -> ChatPlanResponse:
        if "create_leave_request_draft" not in available:
            return ChatPlanResponse(
                type="answer",
                reply="Bạn chưa có quyền tạo đơn nghỉ bằng HRGenie.",
                confidence=0.7,
            )

        start_date = self._extract_start_date(request, normalized)
        if start_date is None:
            return ChatPlanResponse(
                type="answer",
                reply="Bạn muốn nghỉ vào ngày nào?",
                confidence=0.76,
            )

        days = self._extract_days(normalized)
        end_date = start_date + timedelta(days=max(days - 1, 0))
        leave_type_code = self._leave_type_code(normalized)
        reason = self._extract_reason(original_text)
        arguments = {
            "leaveTypeCode": leave_type_code,
            "startDate": start_date.isoformat(),
            "endDate": end_date.isoformat(),
            "reason": reason,
        }

        return ChatPlanResponse(
            type="confirmation_required",
            reply="Tôi đã chuẩn bị nháp đơn nghỉ. Bạn xác nhận trước khi nộp nhé.",
            toolCalls=[
                ToolCall(
                    id=f"call_{uuid4().hex[:8]}",
                    toolName="create_leave_request_draft",
                    arguments=arguments,
                )
            ],
            needConfirmation=True,
            confirmation=Confirmation(
                title="Xác nhận nộp đơn nghỉ",
                summary=arguments,
            ),
            confidence=0.88,
        )

    def _tool_plan(
        self,
        tool_name: str,
        arguments: dict[str, object],
        available: set[str],
        reply: str,
    ) -> ChatPlanResponse:
        if tool_name not in available:
            return ChatPlanResponse(
                type="answer",
                reply="Bạn chưa có quyền dùng chức năng này trong HRGenie.",
                confidence=0.68,
            )

        return ChatPlanResponse(
            type="tool_plan",
            reply=reply,
            toolCalls=[
                ToolCall(
                    id=f"call_{uuid4().hex[:8]}",
                    toolName=tool_name,
                    arguments=arguments,
                )
            ],
            confidence=0.84,
        )

    def _is_leave_request(self, normalized: str) -> bool:
        return self._has_any(normalized, "muon nghi", "xin nghi", "nghi phep", "nghi om") and not self._has_any(
            normalized,
            "con bao nhieu",
            "la gi",
            "quy dinh",
            "loai nghi",
        )

    def _extract_start_date(self, request: ChatPlanRequest, normalized: str) -> date | None:
        today = self._today(request)
        if "ngay kia" in normalized:
            return today + timedelta(days=2)
        if "mai" in normalized:
            return today + timedelta(days=1)
        if "hom nay" in normalized:
            return today

        match = re.search(r"\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b", normalized)
        if not match:
            return None

        day = int(match.group(1))
        month = int(match.group(2))
        year_text = match.group(3)
        year = today.year if not year_text else int(year_text)
        if year < 100:
            year += 2000
        try:
            return date(year, month, day)
        except ValueError:
            return None

    def _extract_days(self, normalized: str) -> int:
        match = re.search(r"\b(\d{1,2})\s*ngay\b", normalized)
        if not match:
            return 1
        return max(1, min(int(match.group(1)), 30))

    def _leave_type_code(self, normalized: str) -> str:
        if "khong luong" in normalized:
            return "UNPAID_LEAVE"
        if "om" in normalized or "benh" in normalized:
            return "SICK_LEAVE"
        return "ANNUAL_LEAVE"

    def _extract_reason(self, text: str) -> str:
        match = re.search(r"\b(vì|vi)\s+(.+)$", text, re.IGNORECASE)
        if match:
            return match.group(2).strip().rstrip(".")
        return "Tạo từ HRGenie"

    def _today(self, request: ChatPlanRequest) -> date:
        try:
            return date.fromisoformat(request.today)
        except ValueError:
            return date.today()

    def _has_any(self, normalized: str, *phrases: str) -> bool:
        return any(phrase in normalized for phrase in phrases)

    def _normalize(self, value: str) -> str:
        without_accents = "".join(
            char
            for char in unicodedata.normalize("NFD", value)
            if unicodedata.category(char) != "Mn"
        )
        return re.sub(r"\s+", " ", without_accents.lower()).strip()


import logging

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
