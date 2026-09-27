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


POLICY_FRAMING_PHRASES = (
    "chinh sach cua cong ty",
    "chinh sach cong ty",
    "chinh sach",
    "noi quy cong ty",
    "noi quy",
    "quy che",
    "cua cong ty",
    "cong ty minh",
    "cong ty",
    "quy dinh ve",
    "quy dinh cua",
    "quy dinh",
    "nhu the nao",
    "the nao",
    "ra sao",
    "la gi",
    "co gi",
    "cho toi biet",
    "cho toi hoi",
)

TASK_TITLE_END_MARKERS = (
    "sang trang thai",
    # "rút task X về đang làm": cut at the phrase, never at a bare "về",
    # which titles use too ("Tài liệu về API").
    "ve trang thai",
    "ve dang lam",
    "ve cho",
    "ve chua lam",
    # "task X đang chờ duyệt thành hoàn thành": the current status is not
    # part of the title either.
    "dang cho",
    "dang o ",
    "sang ",
    "thanh ",
    "da xong",
    "xong roi",
    "lam xong",
    "hoan thanh",
    "hoan tat",
    "dang lam",
    "cho duyet",
    "cho review",
    "chua lam",
    "chua bat dau",
    "giup toi",
    "gium toi",
    "nhe",
    "nha",
)


class RuleBasedPlannerService:
    def __init__(self, rag_service: RagService | None = None):
        self.rag_service = rag_service or RagService()

    def plan(self, request: ChatPlanRequest) -> ChatPlanResponse:
        text = request.message.strip()
        normalized = normalize(text)
        available = {tool.name for tool in request.availableTools}

        # Before the cancel shortcut: "hủy đơn nghỉ của chị Linh" is a cancel
        # phrase too, and must be refused rather than drafted.
        forbidden = self._forbidden_plan(text, normalized)
        if forbidden is not None:
            return forbidden

        if self._is_cancel_leave_request(normalized):
            return self._cancel_leave_request_plan(request, normalized, available)

        paraphrase = self._paraphrase_plan(request, normalized, available)
        if paraphrase is not None:
            return paraphrase

        personal = self._personal_data_plan(request, text, normalized, available)
        if personal is not None:
            return personal

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

        if self._has_any(
            normalized,
            "manager cua toi",
            "quan ly cua toi",
            "ai duyet don",
            "nguoi duyet don",
            "ai phe duyet",
            "nguoi phe duyet",
        ):
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

        # Before the profile branch: "gửi task X cho quản lý duyệt" contains
        # "quản lý" but is a status change, not a question about the org chart.
        if self._is_task_status_update(normalized):
            return self._task_status_plan(text, normalized, available)

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
                {"status": ["TODO", "IN_PROGRESS", "IN_REVIEW"], "limit": 10},
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

        policy_answer = self._policy_plan(text, normalized)
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

    def _without_policy_framing(self, normalized: str) -> str:
        stripped = normalized
        for phrase in POLICY_FRAMING_PHRASES:
            stripped = stripped.replace(phrase, " ")
        return re.sub(r"\s+", " ", stripped).strip()

    _POLICY_SYNONYMS = (
        ("lam o nha", "lam viec tu xa"),
        ("lam tai nha", "lam viec tu xa"),
        ("lam them gio", "tang ca"),
        ("lam them", "tang ca"),
        ("dung khong het", "cong don phep nam sang nam sau"),
        ("khong dung het", "cong don phep nam sang nam sau"),
        ("om dau", "bao hiem"),
    )

    def _with_policy_synonyms(self, normalized: str) -> str:
        expanded = normalized
        for everyday, policy_term in self._POLICY_SYNONYMS:
            if everyday in expanded:
                expanded = expanded.replace(everyday, policy_term)
        return expanded

    def _policy_topics_answer(self, normalized: str) -> ChatPlanResponse | None:
        """A policy question we cannot pin down deserves the list of policies
        we do hold, not the generic "what can I help with" reply."""
        if not self._has_any(normalized, "chinh sach", "noi quy", "quy dinh", "quy che"):
            return None

        return ChatPlanResponse(
            type="answer",
            intent="GET_HR_POLICY_INFO",
            reply=(
                "Mình tra cứu được các nhóm chính sách sau: nghỉ phép, chấm công và "
                "làm việc từ xa, phúc lợi - bảo hiểm - lương thưởng, quy tắc ứng xử. "
                "Bạn muốn hỏi về nhóm nào?"
            ),
            confidence=0.7,
        )

    def _policy_plan(self, text: str, normalized: str) -> ChatPlanResponse | None:
        result = self.rag_service.search(RagSearchRequest(query=text, topK=1))
        if not result.items:
            # "chinh sach nghi phep cua cong ty" is the same question as
            # "nghi phep", wrapped in words every HR question shares. Retrieval
            # scores an overlap ratio, so that framing dilutes a real match
            # below the floor - ask again with it removed.
            stripped = self._without_policy_framing(normalized)
            if stripped and stripped != normalized:
                result = self.rag_service.search(
                    RagSearchRequest(query=stripped, topK=1)
                )

        if not result.items:
            # Everyday words for what the policies call something else.
            expanded = self._with_policy_synonyms(normalized)
            if expanded != normalized:
                result = self.rag_service.search(RagSearchRequest(query=expanded, topK=1))

        if not result.items:
            return self._policy_topics_answer(normalized)

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
        half_day = self._extract_half_day(normalized)
        if half_day == "ASK":
            return ChatPlanResponse(
                type="answer",
                intent="CREATE_LEAVE_REQUEST_DRAFT",
                reply="Bạn muốn nghỉ buổi sáng hay buổi chiều?",
                confidence=0.76,
            )
        if half_day:
            days = 1
        end_date = start_date + timedelta(days=max(days - 1, 0))
        leave_type_code = self._leave_type_code(normalized)
        reason = self._extract_reason(original_text)
        arguments: dict[str, object] = {
            "leaveTypeCode": leave_type_code,
            "startDate": start_date.isoformat(),
            "endDate": end_date.isoformat(),
            "reason": reason,
        }
        if half_day:
            arguments["halfDay"] = half_day

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
            reply="Tôi sẽ tìm đơn nghỉ phù hợp để hủy; đơn đã duyệt sẽ được gửi quản lý duyệt yêu cầu hủy.",
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
                {"status": ["TODO", "IN_PROGRESS", "IN_REVIEW"], "limit": 10},
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

    def _forbidden_plan(self, text: str, normalized: str) -> ChatPlanResponse | None:
        """Other people's pay or reviews, or editing recorded data."""
        edits = (
            "sua luong", "chinh luong", "doi luong", "tang luong", "giam luong",
            "sua diem", "chinh diem", "doi diem",
            "sua gio", "chinh gio", "doi gio",
            "doi muc ky nang", "sua ky nang", "doi ky nang", "chinh ky nang",
        )
        if self._has_any(normalized, *edits):
            return self._forbidden("Tôi không thể tự sửa lương, điểm đánh giá, kỹ năng hay giờ chấm công. "
                                   "Bạn vui lòng liên hệ quản lý hoặc phòng nhân sự để được điều chỉnh.")

        private = self._has_any(normalized, "luong", "danh gia", "diem")
        someone_else = self._has_any(
            normalized,
            "cua anh", "cua chi", "cua em", "cua ban ", "cua dong nghiep", "cua truong",
            "cua sep", "cua ca ", "cua moi nguoi", "cua nhan vien", "ca phong", "ca team",
        ) or re.search(r"của\s+[A-ZĐ]", text) is not None
        if private and someone_else:
            return self._forbidden("Lương và kết quả đánh giá là thông tin riêng của từng người, "
                                   "tôi chỉ có thể cho bạn xem thông tin của chính bạn.")

        # The backend only ever resolves a task among the caller's own, so this
        # could not change someone else's work anyway - but drafting the change
        # and asking for confirmation would still promise something untrue.
        others_work = self._has_any(normalized, "task", "cong viec", "viec")
        if others_work and someone_else and self._is_task_status_update(normalized):
            return self._forbidden(
                "Tôi chỉ có thể cập nhật trạng thái công việc của chính bạn. "
                "Công việc của người khác thì quản lý hoặc chính người đó cập nhật nhé."
            )

        # Leave is filed and cancelled by the person taking it. The draft would
        # be created for the caller anyway, so going ahead would quietly do
        # something other than what was asked.
        if self._is_leave_action(normalized) and self._is_on_behalf_of_others(text, normalized):
            return self._forbidden(
                "Tôi chỉ có thể tạo hoặc hủy đơn nghỉ của chính bạn. "
                "Người khác cần tự gửi đơn, hoặc liên hệ quản lý của họ nhé."
            )
        return None

    def _is_leave_action(self, normalized: str) -> bool:
        if re.search(r"\bai\b", normalized) or self._is_leave_today_query(normalized):
            return False  # "ai nghỉ phép hôm nay" asks about others, it files nothing
        return self._is_leave_request(normalized) or self._is_cancel_leave_request(normalized)

    def _is_on_behalf_of_others(self, text: str, normalized: str) -> bool:
        # Unlike the salary check, "của em" / "cho em" stay out: employees often
        # call themselves "em" when talking to the assistant.
        return self._has_any(
            normalized,
            "cho anh ", "cho chi ", "ho anh ", "ho chi ", "giup anh ", "giup chi ",
            "thay anh ", "thay chi ", "thay cho", "cho dong nghiep", "cho nhan vien",
            "cho ca ", "cho moi nguoi", "cua anh ", "cua chi ", "cua dong nghiep",
            "cua nhan vien", "cua truong", "cua sep", "cua ca ", "cua moi nguoi",
            "ca phong", "ca team",
        ) or re.search(r"(của|cho|hộ|giúp|thay)\s+[A-ZĐ]", text) is not None

    def _out_of_scope(self, reply: str) -> ChatPlanResponse:
        return ChatPlanResponse(type="answer", intent="OUT_OF_SCOPE", reply=reply, confidence=0.8)

    def _forbidden(self, reply: str) -> ChatPlanResponse:
        return ChatPlanResponse(type="answer", intent="FORBIDDEN_REQUEST", reply=reply, confidence=0.8)

    def _paraphrase_plan(
        self,
        request: ChatPlanRequest,
        normalized: str,
        available: set[str],
    ) -> ChatPlanResponse | None:
        """Everyday wordings the keyword branches below miss. This is the
        planner's fallback when the LLM is down, so it needs to cope with how
        people actually ask, not only with the canonical phrasing. Runs before
        those branches because some of them grab these questions wrongly:
        "ai vang mat vi nghi phep" contains "nghi phep", which reads as a
        leave request."""
        who = re.search(r"\bai\b", normalized) is not None
        today = self._has_any(normalized, "hom nay", "hnay", "sang nay", "chieu nay")
        leave_word = self._has_any(normalized, "nghi", "vang")

        # Who is away: today, or in the days ahead.
        if who and leave_word and self._has_any(normalized, "tuan nay", "tuan sau", "sap toi"):
            return self._upcoming_leaves_plan(request, normalized, available)
        if self._has_any(normalized, "lich nghi") and self._has_any(normalized, "team", "nhom", "phong"):
            return self._upcoming_leaves_plan(request, normalized, available)
        if who and leave_word and (today or "dang nghi" in normalized):
            return self._tool_plan(
                "get_who_is_on_leave_today",
                {"date": self._today(request).isoformat(), "scope": self._scope(normalized)},
                available,
                "Tôi sẽ kiểm tra nhân viên nghỉ phép hôm nay trong phạm vi bạn được xem.",
            )

        # The team's attendance: who came in late.
        if who and self._has_any(normalized, "di lam muon", "den muon", "di muon", "di tre", "den tre"):
            return self._tool_plan(
                "get_team_attendance_summary",
                {"date": self._today(request).isoformat(), "scope": self._scope(normalized)},
                available,
                "Tôi sẽ tổng hợp tình hình chấm công trong phạm vi bạn được xem.",
            )

        # How many people.
        if self._has_any(normalized, "bao nhieu", "may") and self._has_any(
            normalized, "nhan su", "nhan vien", "nguoi"
        ) and not self._has_any(normalized, "ngay", "gio"):
            return self._tool_plan(
                "get_department_headcount",
                {"scope": self._scope(normalized)},
                available,
                "Tôi sẽ đếm số nhân viên đang làm việc trong phạm vi bạn được xem.",
            )

        # The team's open work.
        if self._has_any(normalized, "nhom toi", "nhom minh", "team toi", "team minh", "phong toi", "phong minh") and \
                self._has_any(normalized, "viec", "task") and \
                self._has_any(normalized, "chua xong", "con bao nhieu", "qua han", "dang mo", "con lai"):
            return self._tool_plan(
                "get_team_task_summary",
                {"scope": self._scope(normalized), "includeOverdue": "qua han" in normalized},
                available,
                "Tôi sẽ tổng hợp task trong phạm vi nhóm/phòng ban bạn được xem.",
            )

        # My leave balance - but not the carry-over rule, which is policy.
        if self._has_any(normalized, "ngay phep", "ngay nghi phep", "quy phep", "phep nam") and self._has_any(
            normalized, "con", "bao nhieu", "may ngay", "da dung"
        ) and not self._has_any(normalized, "khong het", "co mat", "quy dinh", "chinh sach", "cong don"):
            return self._tool_plan(
                "get_my_leave_balance",
                {"year": self._today(request).year},
                available,
                "Tôi sẽ kiểm tra số ngày phép còn lại của bạn.",
            )

        # The leave requests I sent.
        # ("Who approves my leave?" asks about a person, not the list.)
        if "don nghi" in normalized and self._has_any(
            normalized, "liet ke", "da gui", "cua minh", "cua toi", "danh sach", "xem lai"
        ) and not self._has_any(normalized, "ai phe duyet", "ai duyet", "do ai"):
            return self._tool_plan(
                "get_my_leave_requests",
                {"limit": 5},
                available,
                "Tôi sẽ kiểm tra các đơn nghỉ gần đây của bạn.",
            )

        # Attendance rules (shift times, radius) versus today's own punches.
        shift_rule = self._has_any(
            normalized, "bat dau luc", "may gio", "tan lam", "bao xa", "cach van phong", "gio vao lam"
        )
        today_punch = self._has_any(
            normalized, "quet van tay", "vao ca", "check out", "checkout", "check in", "bi tinh di tre",
            "bi tinh tre", "da cham cong",
        )
        if shift_rule and not today and not today_punch:
            return self._tool_plan(
                "get_attendance_policy",
                {},
                available,
                "Tôi sẽ kiểm tra cấu hình chấm công hiện tại.",
            )
        # Someone else's punches ("team minh co ai chua check in") are the
        # team branch's, further down.
        about_others = who or self._has_any(normalized, "team", "nhom", "phong")
        if not about_others and (
            today_punch or (today and self._has_any(normalized, "di tre", "di muon", "gio vao"))
        ):
            return self._tool_plan(
                "get_today_attendance",
                {},
                available,
                "Tôi sẽ kiểm tra chấm công hôm nay của bạn.",
            )

        # My work that is due, late or urgent; then my work at all.
        if self._has_any(normalized, "viec", "task") and self._has_any(
            normalized, "toi han", "het han", "tre deadline", "tre han", "gap nhat", "uu tien"
        ):
            return self._upcoming_tasks_plan(normalized, available)
        if self._has_any(normalized, "duoc giao") and self._has_any(normalized, "viec", "task", "gi"):
            return self._tool_plan(
                "get_my_tasks",
                {"status": ["TODO", "IN_PROGRESS", "IN_REVIEW"], "limit": 10},
                available,
                "Tôi sẽ kiểm tra các task đang mở của bạn.",
            )

        # My profile and my manager. "Has my boss approved my leave?" is about
        # the leave, so a sentence about a request is left to that branch.
        if self._has_any(normalized, "sep", "cap tren") and "don" not in normalized:
            return self._tool_plan(
                "get_my_manager",
                {},
                available,
                "Tôi sẽ kiểm tra quản lý và phòng ban của bạn.",
            )
        if self._has_any(normalized, "ma nhan vien", "phong ban nao", "phong nao", "chuc danh cua"):
            return self._tool_plan(
                "get_my_profile",
                {},
                available,
                "Tôi sẽ kiểm tra hồ sơ nhân viên của bạn.",
            )
        return None

    def _personal_data_plan(
        self,
        request: ChatPlanRequest,
        text: str,
        normalized: str,
        available: set[str],
    ) -> ChatPlanResponse | None:
        month_args = self._month_args(request, normalized)
        has_month = bool(month_args) or "thang nay" in normalized
        is_self = self._mentions_self(text, normalized)
        policy_question = self._has_any(
            normalized, "the nao", "co khong", "quy dinh", "co bi", "co duoc", "tinh sao", "cach tinh",
            "xu ly", "bi phat", "duoc tra",
        )
        if policy_question and not is_self:
            return None

        if (
            is_self
            and not policy_question
            and not self._has_any(normalized, "nghi", "phep")
            and self._has_any(normalized, "luong", "thuc linh", "tien tang ca", "tien lam them", "lam them gio")
        ):
            return self._out_of_scope(
                "Hệ thống không quản lý bảng lương nên tôi không tra cứu được thông tin lương. "
                "Bạn vui lòng liên hệ phòng nhân sự."
            )

        if self._has_any(normalized, "danh gia", "performance review", "cham diem", "diem cuoi"):
            return self._out_of_scope(
                "Hệ thống không có chức năng đánh giá hiệu suất. "
                "Bạn vui lòng liên hệ quản lý hoặc phòng nhân sự."
            )

        task_words = self._has_any(normalized, "task", "cong viec", "viec")
        stats_words = self._has_any(
            normalized, "hoan thanh", "xong", "dung han", "tre han", "log", "so gio", "hieu suat", "ti le"
        )
        if task_words and stats_words and (has_month or "hieu suat" in normalized or "ti le" in normalized):
            return self._tool_plan("get_my_task_stats", month_args, available,
                                   "Tôi sẽ thống kê task của bạn trong tháng.")

        attendance_words = self._has_any(
            normalized, "di muon", "di tre", "tre gio", "ve som", "cham cong", "check-out", "check out",
            "di lam", "vang", "quen",
        )
        if (has_month or self._has_any(normalized, "thong ke cham cong", "tong ket cham cong")) and attendance_words:
            return self._tool_plan("get_my_attendance_summary", month_args, available,
                                   "Tôi sẽ tổng hợp chấm công trong tháng của bạn.")

        if self._has_any(normalized, "du an", "project"):
            return self._tool_plan("get_my_projects", {}, available,
                                   "Tôi sẽ kiểm tra các dự án bạn đang tham gia.")

        if self._has_any(normalized, "ky nang", "skill", "trinh do", "nam kinh nghiem", "thanh thao"):
            return self._tool_plan("get_my_skills", {}, available,
                                   "Tôi sẽ kiểm tra kỹ năng trong hồ sơ của bạn.")

        team_words = self._has_any(
            normalized, "thanh vien", "dong nghiep", "cung nhom", "cung team", "trong nhom",
            "team toi gom", "team minh co", "nhom toi co", "nhom cua minh", "nhom toi gom",
        )
        other_topic = re.search(
            r"\b(task|viec|nghi|cham cong|check|sinh nhat|bao nhieu nguoi)\b", normalized
        ) is not None
        if team_words and not other_topic:
            return self._tool_plan("get_my_team_members", {}, available,
                                   "Tôi sẽ kiểm tra thành viên trong nhóm của bạn.")
        return None

    def _mentions_self(self, text: str, normalized: str) -> bool:
        # Without diacritics "toi" is both "tôi" (I) and "tối" (evening), so
        # trust the accented words when the user typed accents.
        lowered = text.lower()
        if lowered != normalized:
            return re.search(r"\b(tôi|mình|tui|em)\b", lowered) is not None
        return re.search(r"\b(toi|minh|tui)\b", normalized) is not None

    def _month_args(self, request: ChatPlanRequest, normalized: str) -> dict[str, int]:
        today = self._today(request)
        if "thang truoc" in normalized:
            year, month = (today.year, today.month - 1) if today.month > 1 else (today.year - 1, 12)
            return {"month": month, "year": year}
        match = re.search(r"\bthang (\d{1,2})\b", normalized)
        if match and 1 <= int(match.group(1)) <= 12:
            month = int(match.group(1))
            return {"month": month, "year": today.year if month <= today.month else today.year - 1}
        return {}

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
            "get_my_attendance_summary": "GET_MY_ATTENDANCE_SUMMARY",
            "get_my_projects": "GET_MY_PROJECTS",
            "get_my_skills": "GET_MY_SKILLS",
            "get_my_team_members": "GET_MY_TEAM_MEMBERS",
            "get_my_task_stats": "GET_MY_TASK_STATS",
            "update_task_status_draft": "UPDATE_TASK_STATUS_DRAFT",
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

    def _is_task_status_update(self, normalized: str) -> bool:
        if not self._has_any(normalized, "task", "cong viec"):
            return False

        # "cac task dang lam cua toi" names the same states as an update but is
        # a question, so a status word alone is never enough to write anything.
        if self._has_any(
            normalized,
            "cac task",
            "nhung task",
            "task nao",
            "cong viec nao",
            "danh sach",
            "liet ke",
            "bao nhieu",
            "sap den han",
            "qua han",
        ):
            return False
        # "đã hoàn thành task X chưa?" asks, it does not report.
        if normalized.rstrip(" ?.!").endswith(" chua"):
            return False

        if self._has_any(
            normalized,
            "danh dau",
            "cap nhat trang thai",
            "chuyen trang thai",
            "doi trang thai",
            "bat dau lam",
            "da xong",
            "xong roi",
            "lam xong",
            "gui duyet",
            "cho quan ly duyet",
            "nop task",
            "nop cong viec",
            "hoan thanh task",
            "hoan thanh cong viec",
            "hoan tat task",
            "hoan tat cong viec",
            "rut task",
            "rut cong viec",
            "rut lai task",
            "rut lai cong viec",
        ):
            return True

        if self._has_any(normalized, "chuyen", "doi", "cap nhat", "sua") and (
            " sang " in f" {normalized} " or self._target_status_segment(normalized) is not None
        ):
            return True
        return False

    @staticmethod
    def _target_status_segment(normalized: str) -> str | None:
        """The words after "sang", "thành" or "về": where the task is going,
        as opposed to where it is now ("task X đang chờ duyệt thành hoàn
        thành"). The "thành" of "hoàn thành" is a status, not a marker."""
        for pattern in (r"\bsang\s+(.+)$", r"(?<!hoan )\bthanh\s+(.+)$", r"\bve\s+(.+)$"):
            match = re.search(pattern, normalized)
            if match:
                return match.group(1)
        return None

    def _task_status_plan(
        self,
        original_text: str,
        normalized: str,
        available: set[str],
    ) -> ChatPlanResponse:
        if "update_task_status_draft" not in available:
            return ChatPlanResponse(
                type="answer",
                intent="UPDATE_TASK_STATUS_DRAFT",
                reply="Bạn chưa có quyền cập nhật trạng thái công việc bằng HRGenie.",
                confidence=0.7,
            )

        status = self._task_status_from_text(normalized)
        if status is None:
            return ChatPlanResponse(
                type="answer",
                intent="UPDATE_TASK_STATUS_DRAFT",
                reply=(
                    "Bạn muốn chuyển công việc sang trạng thái nào: "
                    "chưa làm, đang làm, chờ duyệt hay hoàn thành?"
                ),
                confidence=0.76,
            )

        task_id = self._extract_task_id(normalized)
        task_title = None if task_id else self._extract_task_title(original_text)
        if task_id is None and not task_title:
            return ChatPlanResponse(
                type="answer",
                intent="UPDATE_TASK_STATUS_DRAFT",
                reply="Bạn muốn cập nhật công việc nào? Bạn cho mình biết tên hoặc mã công việc nhé.",
                confidence=0.76,
            )

        arguments: dict[str, object] = {"status": status}
        if task_id is not None:
            arguments["taskId"] = task_id
        else:
            arguments["taskTitle"] = task_title

        return ChatPlanResponse(
            type="confirmation_required",
            intent="UPDATE_TASK_STATUS_DRAFT",
            reply="Tôi đã chuẩn bị cập nhật trạng thái công việc. Bạn xác nhận nhé.",
            toolCalls=[
                ToolCall(
                    id=f"call_{uuid4().hex[:8]}",
                    toolName="update_task_status_draft",
                    arguments=arguments,
                )
            ],
            needConfirmation=True,
            confirmation=Confirmation(
                title="Xác nhận cập nhật công việc",
                summary=arguments,
            ),
            confidence=0.88,
        )

    def _task_status_from_text(self, normalized: str) -> str | None:
        # The target named after "sang/thành/về" wins over a status the
        # message mentions as the current one.
        segment = self._target_status_segment(normalized)
        if segment is not None:
            status = self._status_in(segment)
            if status is not None:
                return status
        if self._has_any(normalized, "rut task", "rut cong viec", "rut lai"):
            return "IN_PROGRESS"
        return self._status_in(normalized)

    def _status_in(self, normalized: str) -> str | None:
        # Ordered so the more specific wording wins: "xong" also appears in
        # "chua xong", and "cho duyet" contains "duyet".
        if self._has_any(
            normalized,
            "cho duyet",
            "cho review",
            "can review",
            "review",
            "gui duyet",
            "duyet",
            "nop",
        ):
            return "IN_REVIEW"
        if self._has_any(
            normalized, "hoan thanh", "da xong", "xong roi", "lam xong", "done", "hoan tat"
        ):
            return "DONE"
        if self._has_any(
            normalized, "dang lam", "bat dau lam", "bat tay vao", "in progress", "dang xu ly"
        ):
            return "IN_PROGRESS"
        if self._has_any(normalized, "chua lam", "to do", "todo", "chua bat dau"):
            return "TODO"
        return None

    def _extract_task_id(self, normalized: str) -> int | None:
        match = re.search(r"(?:task|cong viec|cv|ma)\s*#?\s*(\d{1,6})\b", normalized)
        if not match:
            match = re.search(r"#(\d{1,6})\b", normalized)
        return int(match.group(1)) if match else None

    def _extract_task_title(self, original_text: str) -> str | None:
        """Keep the employee's own wording - the backend matches it against the
        titles of their open tasks, which still carry Vietnamese diacritics."""
        quoted = re.search(r"[\"'\u201c\u2018](.+?)[\"'\u201d\u2019]", original_text)
        if quoted:
            return quoted.group(1).strip() or None

        match = re.search(
            r"(?:task|c\u00f4ng vi\u1ec7c|cong viec)\s+(.+)",
            original_text,
            flags=re.IGNORECASE,
        )
        if not match:
            return None

        rest = match.group(1).strip()
        cut_at = len(rest)
        for marker in TASK_TITLE_END_MARKERS:
            found = normalize(rest).find(marker)
            if found != -1:
                cut_at = min(cut_at, found)
        title = rest[:cut_at].strip(" ,.:;-\u2013")
        return title or None

    def _is_leave_request(self, normalized: str) -> bool:
        asks = self._has_any(
            normalized, "muon nghi", "xin nghi", "nghi phep", "nghi om", "cho toi nghi", "cho minh nghi",
            "toi nghi mot buoi", "toi nghi 1 buoi",
        ) or re.search(r"\bnghi \d+ ngay\b", normalized) is not None
        return asks and not self._has_any(
            normalized,
            "huy",
            "con bao nhieu",
            "la gi",
            "quy dinh",
            "chinh sach",
            "noi quy",
            "loai nghi",
            "co duoc",
            "cong don",
        )

    def _is_cancel_leave_request(self, normalized: str) -> bool:
        # The only request an employee can cancel here is a leave request.
        return self._has_any(
            normalized, "huy don", "huy nghi", "huy phep", "khong nghi nua", "rut lai don", "rut don nghi"
        ) or (
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

        weekday = self._weekday_in(normalized)
        if weekday is not None:
            monday = today - timedelta(days=today.weekday())
            if "tuan sau" in normalized:
                monday += timedelta(days=7)
                return monday + timedelta(days=weekday)
            day = monday + timedelta(days=weekday)
            # "thu 6" alone means the coming one, never a day already past.
            return day if day >= today or "tuan nay" in normalized else day + timedelta(days=7)

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

    _WEEKDAYS = {
        "2": 0, "hai": 0, "3": 1, "ba": 1, "4": 2, "tu": 2,
        "5": 3, "nam": 3, "6": 4, "sau": 4, "7": 5, "bay": 5,
    }

    def _weekday_in(self, normalized: str) -> int | None:
        """Monday = 0 for "thu 2/hai" ... "thu 7/bay", 6 for "chu nhat"."""
        if "chu nhat" in normalized:
            return 6
        match = re.search(r"\bthu (2|3|4|5|6|7|hai|ba|tu|nam|sau|bay)\b", normalized)
        return self._WEEKDAYS[match.group(1)] if match else None

    def _extract_days(self, normalized: str) -> int:
        match = re.search(r"\b(\d{1,2})\s*ngay\b", normalized)
        if not match:
            return 1
        return max(1, min(int(match.group(1)), 30))

    def _extract_half_day(self, normalized: str) -> str | None:
        """MORNING / AFTERNOON for one shift off, "ASK" for "nửa ngày" with
        no shift named. Only unmistakable phrases count: "sang" alone is also
        "next" ("sang tuần sau")."""
        if re.search(r"\bbuoi sang\b|\bsang (nay|mai|thu|ngay)\b|\bnghi sang\b", normalized):
            return "MORNING"
        if re.search(r"\bbuoi chieu\b|\bchieu (nay|mai|thu|ngay)\b|\bnghi chieu\b", normalized):
            return "AFTERNOON"
        if "nua ngay" in normalized:
            return "ASK"
        return None

    def _leave_type_code(self, normalized: str) -> str:
        if "khong luong" in normalized:
            return "UNPAID_LEAVE"
        # Whole words only: "om" is also inside "hom nay" (today).
        if re.search(r"\b(om|benh)\b", normalized):
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
