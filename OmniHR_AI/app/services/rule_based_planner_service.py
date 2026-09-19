import re
from datetime import date, timedelta
from uuid import uuid4

from app.schemas.chat import (
    ChatPlanRequest,
    ChatPlanResponse,
    Confirmation,
    ToolCall,
)
from app.schemas.rag import RagSearchRequest
from app.services.rag_service import RagService
from app.services.text_normalize import normalize


class RuleBasedPlannerService:
    def __init__(self, rag_service: RagService | None = None):
        self.rag_service = rag_service or RagService()

    def plan(self, request: ChatPlanRequest) -> ChatPlanResponse:
        text = request.message.strip()
        normalized = normalize(text)
        available = {tool.name for tool in request.availableTools}

        if self._is_cancel_leave_request(normalized):
            return self._cancel_leave_request_plan(request, normalized, available)

        if self._has_any(normalized, "sinh nhat", "birthday"):
            return self._birthdays_plan(request, normalized, available)

        if self._is_leave_today_query(normalized):
            return self._tool_plan(
                "get_who_is_on_leave_today",
                {"date": self._today(request).isoformat(), "scope": self._scope(normalized)},
                available,
                "Tôi sẽ kiểm tra nhân viên nghỉ phép hôm nay trong phạm vi bạn được xem.",
            )

        if self._is_upcoming_leaves_query(normalized):
            return self._upcoming_leaves_plan(request, normalized, available)

        if self._is_team_attendance_query(normalized):
            return self._tool_plan(
                "get_team_attendance_summary",
                {"date": self._today(request).isoformat(), "scope": self._scope(normalized)},
                available,
                "Tôi sẽ tổng hợp tình hình chấm công trong phạm vi bạn được xem.",
            )

        if self._has_any(normalized, "manager cua toi", "quan ly cua toi", "ai duyet don", "nguoi duyet don"):
            return self._tool_plan(
                "get_my_manager",
                {},
                available,
                "Tôi sẽ kiểm tra quản lý và phòng ban của bạn.",
            )

        if self._is_headcount_query(normalized):
            return self._tool_plan(
                "get_department_headcount",
                {"scope": self._scope(normalized)},
                available,
                "Tôi sẽ đếm số nhân viên đang làm việc trong phạm vi bạn được xem.",
            )

        if self._is_team_task_query(normalized):
            return self._tool_plan(
                "get_team_task_summary",
                {
                    "scope": self._scope(normalized),
                    "includeOverdue": self._has_any(normalized, "qua han", "tre han", "deadline"),
                },
                available,
                "Tôi sẽ tổng hợp task trong phạm vi nhóm/phòng ban bạn được xem.",
            )

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
            "don xin nghi",
            "duyet chua",
        ):
            return self._tool_plan(
                "get_my_leave_requests",
                {"limit": 5},
                available,
                "Tôi sẽ kiểm tra các đơn nghỉ gần đây của bạn.",
            )

        if self._is_leave_request(normalized):
            return self._leave_request_plan(request, text, normalized, available)

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

        if self._has_any(normalized, "sap den han", "qua han", "hom nay can lam", "can lam gi"):
            return self._upcoming_tasks_plan(normalized, available)

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

        if self._has_any(normalized, "xin chao", "chao", "cam on", "thanks"):
            return ChatPlanResponse(
                type="answer",
                intent="SMALL_TALK",
                reply="Chào bạn, tôi là HRGenie. Bạn muốn hỏi về chấm công, nghỉ phép hay task?",
                confidence=0.78,
            )

        policy_answer = self._policy_plan(text)
        if policy_answer is not None:
            return policy_answer

        return ChatPlanResponse(
            type="answer",
            intent="UNKNOWN",
            reply=(
                "Tôi có thể hỗ trợ bạn hỏi về chấm công, nghỉ phép, hồ sơ cá nhân "
                "hoặc task. Bạn muốn kiểm tra thông tin nào?"
            ),
            confidence=0.62,
        )

    def _policy_plan(self, text: str) -> ChatPlanResponse | None:
        result = self.rag_service.search(RagSearchRequest(query=text, topK=1))
        if not result.items:
            return None

        top = result.items[0]
        reply = f"{top.title}: {top.content}"
        if len(reply) > 600:
            reply = f"{reply[:600].rstrip()}..."

        return ChatPlanResponse(
            type="answer",
            intent="GET_HR_POLICY_INFO",
            reply=reply,
            confidence=round(min(0.6 + top.score * 0.3, 0.9), 2),
            citations=[
                {
                    "documentId": top.documentId,
                    "chunkId": top.chunkId,
                    "title": top.title,
                }
            ],
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
                intent="CREATE_LEAVE_REQUEST_DRAFT",
                reply="Bạn chưa có quyền tạo đơn nghỉ bằng HRGenie.",
                confidence=0.7,
            )

        start_date = self._extract_start_date(request, normalized)
        if start_date is None:
            return ChatPlanResponse(
                type="answer",
                intent="CREATE_LEAVE_REQUEST_DRAFT",
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
            intent="CREATE_LEAVE_REQUEST_DRAFT",
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

    def _cancel_leave_request_plan(
        self,
        request: ChatPlanRequest,
        normalized: str,
        available: set[str],
    ) -> ChatPlanResponse:
        if "cancel_my_pending_leave_request" not in available:
            return ChatPlanResponse(
                type="answer",
                intent="CANCEL_MY_PENDING_LEAVE_REQUEST",
                reply="Bạn chưa có quyền hủy đơn nghỉ bằng HRGenie.",
                confidence=0.7,
            )

        arguments: dict[str, object] = {}
        start_date = self._extract_start_date(request, normalized)
        if start_date is not None:
            arguments["startDate"] = start_date.isoformat()

        return ChatPlanResponse(
            type="confirmation_required",
            intent="CANCEL_MY_PENDING_LEAVE_REQUEST",
            reply="Tôi sẽ tìm đơn nghỉ đang chờ duyệt phù hợp và tạo xác nhận hủy.",
            toolCalls=[
                ToolCall(
                    id=f"call_{uuid4().hex[:8]}",
                    toolName="cancel_my_pending_leave_request",
                    arguments=arguments,
                )
            ],
            needConfirmation=True,
            confirmation=Confirmation(
                title="Xác nhận hủy đơn nghỉ",
                summary=arguments,
            ),
            confidence=0.86,
        )

    def _upcoming_tasks_plan(
        self,
        normalized: str,
        available: set[str],
    ) -> ChatPlanResponse:
        mode = "upcoming"
        if self._has_any(normalized, "qua han", "tre han"):
            mode = "overdue"
        elif self._has_any(normalized, "hom nay"):
            mode = "today"

        if "get_my_upcoming_tasks" not in available and "get_my_tasks" in available:
            return self._tool_plan(
                "get_my_tasks",
                {"status": ["TODO", "IN_PROGRESS"], "limit": 10},
                available,
                "Tôi sẽ kiểm tra các task đang mở của bạn.",
            )

        return self._tool_plan(
            "get_my_upcoming_tasks",
            {
                "mode": mode,
                "days": 7,
                "limit": 10,
                "includeOverdue": self._has_any(normalized, "qua han", "tre han"),
            },
            available,
            "Tôi sẽ kiểm tra các task sắp đến hạn của bạn.",
        )

    def _birthdays_plan(
        self,
        request: ChatPlanRequest,
        normalized: str,
        available: set[str],
    ) -> ChatPlanResponse:
        today = self._today(request)
        arguments: dict[str, object] = {"scope": self._scope(normalized)}
        week_range = self._week_range_for_text(today, normalized)
        if week_range is not None:
            arguments["fromDate"] = week_range[0].isoformat()
            arguments["toDate"] = week_range[1].isoformat()
        else:
            month = self._extract_month(normalized)
            if month is not None:
                arguments["month"] = month
                arguments["year"] = today.year
            elif "thang sau" in normalized:
                next_month = today.month + 1
                year = today.year
                if next_month > 12:
                    next_month = 1
                    year += 1
                arguments["month"] = next_month
                arguments["year"] = year
            else:
                arguments["month"] = today.month
                arguments["year"] = today.year

        return self._tool_plan(
            "get_employee_birthdays",
            arguments,
            available,
            "Tôi sẽ kiểm tra danh sách sinh nhật trong phạm vi bạn được xem.",
        )

    def _upcoming_leaves_plan(
        self,
        request: ChatPlanRequest,
        normalized: str,
        available: set[str],
    ) -> ChatPlanResponse:
        today = self._today(request)
        week_range = self._week_range_for_text(today, normalized)
        if week_range is None:
            week_range = (today, today + timedelta(days=6))
        return self._tool_plan(
            "get_upcoming_leaves",
            {
                "fromDate": week_range[0].isoformat(),
                "toDate": week_range[1].isoformat(),
                "scope": self._scope(normalized),
            },
            available,
            "Tôi sẽ kiểm tra lịch nghỉ sắp tới trong phạm vi bạn được xem.",
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
                intent=self._intent_for_tool(tool_name),
                reply="Bạn chưa có quyền dùng chức năng này trong HRGenie.",
                confidence=0.68,
            )

        return ChatPlanResponse(
            type="tool_plan",
            intent=self._intent_for_tool(tool_name),
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

    def _intent_for_tool(self, tool_name: str) -> str:
        return {
            "get_my_profile": "GET_MY_PROFILE",
            "get_today_attendance": "GET_TODAY_ATTENDANCE",
            "get_attendance_policy": "GET_ATTENDANCE_POLICY",
            "get_my_leave_balance": "GET_MY_LEAVE_BALANCE",
            "get_my_leave_requests": "GET_MY_LEAVE_REQUESTS",
            "get_leave_types": "GET_LEAVE_TYPES",
            "create_leave_request_draft": "CREATE_LEAVE_REQUEST_DRAFT",
            "cancel_my_pending_leave_request": "CANCEL_MY_PENDING_LEAVE_REQUEST",
            "get_my_tasks": "GET_MY_TASKS",
            "get_my_upcoming_tasks": "GET_MY_UPCOMING_TASKS",
            "get_employee_birthdays": "GET_EMPLOYEE_BIRTHDAYS",
            "get_who_is_on_leave_today": "GET_WHO_IS_ON_LEAVE_TODAY",
            "get_upcoming_leaves": "GET_UPCOMING_LEAVES",
            "get_team_attendance_summary": "GET_TEAM_ATTENDANCE_SUMMARY",
            "get_team_task_summary": "GET_TEAM_TASK_SUMMARY",
            "get_department_headcount": "GET_DEPARTMENT_HEADCOUNT",
            "get_my_manager": "GET_MY_MANAGER",
        }.get(tool_name, "UNKNOWN")

    def _is_leave_today_query(self, normalized: str) -> bool:
        return self._has_any(
            normalized,
            "hom nay ai nghi",
            "ai nghi hom nay",
            "hom nay team toi co ai nghi",
            "hom nay phong toi co ai nghi",
        )

    def _is_upcoming_leaves_query(self, normalized: str) -> bool:
        return self._has_any(
            normalized,
            "tuan nay ai nghi",
            "tuan sau ai nghi",
            "sap toi ai nghi",
            "lich nghi sap toi",
        ) or (
            self._has_any(normalized, "ai nghi")
            and self._has_any(normalized, "tuan nay", "tuan sau", "sap toi")
        )

    def _is_team_attendance_query(self, normalized: str) -> bool:
        return self._has_any(
            normalized,
            "chua check-in",
            "chua check in",
            "tinh hinh cham cong",
            "cham cong team",
        ) or (
            self._has_any(normalized, "di muon")
            and self._has_any(normalized, "team", "phong", "ai")
        )

    def _is_team_task_query(self, normalized: str) -> bool:
        return self._has_any(normalized, "team", "phong") and self._has_any(
            normalized,
            "task",
            "cong viec",
            "qua han",
            "deadline",
            "dang lam",
            "nhieu task",
        )

    def _is_headcount_query(self, normalized: str) -> bool:
        return self._has_any(
            normalized,
            "bao nhieu nguoi",
            "may nguoi",
            "headcount",
            "bao nhieu nhan vien",
        )

    def _scope(self, normalized: str) -> str:
        if self._has_any(normalized, "cong ty", "toan cong ty"):
            return "company"
        if self._has_any(normalized, "team"):
            return "my_team"
        if self._has_any(normalized, "phong", "phong ban", "department"):
            return "my_department"
        return "allowed"

    def _extract_month(self, normalized: str) -> int | None:
        match = re.search(r"\bthang\s+(\d{1,2})\b", normalized)
        if not match:
            return None
        month = int(match.group(1))
        return month if 1 <= month <= 12 else None

    def _week_range_for_text(self, today: date, normalized: str) -> tuple[date, date] | None:
        if "tuan sau" in normalized:
            start = today + timedelta(days=(7 - today.weekday()))
            return start, start + timedelta(days=6)
        if "tuan nay" in normalized:
            start = today - timedelta(days=today.weekday())
            return start, start + timedelta(days=6)
        return None

    def _is_leave_request(self, normalized: str) -> bool:
        return self._has_any(normalized, "muon nghi", "xin nghi", "nghi phep", "nghi om") and not self._has_any(
            normalized,
            "huy",
            "con bao nhieu",
            "la gi",
            "quy dinh",
            "loai nghi",
            "co duoc",
            "cong don",
        )

    def _is_cancel_leave_request(self, normalized: str) -> bool:
        return self._has_any(normalized, "huy don nghi", "huy nghi", "huy phep") or (
            self._has_any(normalized, "huy") and self._has_any(normalized, "don nghi", "nghi phep")
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
