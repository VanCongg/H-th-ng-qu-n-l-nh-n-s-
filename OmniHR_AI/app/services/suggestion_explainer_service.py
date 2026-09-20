import json
import logging
from typing import Any

from app.core.config import settings
from app.llm.base import LlmClient, LlmClientError
from app.llm.factory import build_llm_client
from app.schemas.explain import ExplainCandidate, ExplainRequest, ExplainResponse, Explanation

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Bạn là trợ lý nhân sự, viết lời giải thích cho quản lý về việc AI xếp hạng ứng viên nhận task.

Nguyên tắc:
- Mỗi ứng viên một câu tiếng Việt, tối đa 30 từ, giọng trung lập, không tâng bốc.
- CHỈ dùng số liệu có trong dữ liệu đầu vào. Tuyệt đối không suy đoán về tính cách, thái độ, giới tính hay hoàn cảnh cá nhân.
- Nêu lý do cụ thể nhất: kỹ năng khớp/thiếu, khối lượng việc đang mở, lịch nghỉ trùng thời gian task.
- Nếu ứng viên thiếu kỹ năng bắt buộc thì phải nói rõ điều đó trước.
- Không nhắc đến điểm tổng, không nhắc đến trọng số, không dùng từ "AI".

Trả về DUY NHẤT JSON hợp lệ dạng:
{"explanations": [{"employeeId": 1, "reason": "..."}]}"""

WARNING_LABELS = {
    "MISSING_REQUIRED_SKILLS": "thiếu kỹ năng bắt buộc",
    "REQUIRED_SKILL_BELOW_MINIMUM": "kỹ năng bắt buộc chưa đạt mức yêu cầu",
    "MISSING_IMPORTANT_SKILLS": "thiếu kỹ năng ưu tiên",
    "MISSING_NICE_TO_HAVE_SKILLS": "thiếu kỹ năng nên có",
    "NO_REQUIRED_SKILLS": "task chưa khai báo kỹ năng yêu cầu",
    "APPROVED_LEAVE_OVERLAP": "đã có đơn nghỉ được duyệt trùng thời gian task",
    "PENDING_LEAVE_OVERLAP": "có đơn nghỉ đang chờ duyệt trùng thời gian task",
    "TASK_DATE_RANGE_MISSING": "task chưa có mốc thời gian nên không xét lịch nghỉ",
    "TASK_HAS_NO_WORKDAYS": "khoảng thời gian task không có ngày làm việc nào",
    "NO_AVAILABLE_CAPACITY": "đã kín giờ làm trong tuần",
    "HAS_OVERDUE_TASKS": "đang có task quá hạn",
}


class SuggestionExplainerService:
    """
    Turns the scoring breakdown NestJS computed into one sentence per
    candidate. It never ranks and never decides: the order and the scores are
    already fixed by the time this runs, so a wrong or missing answer costs
    wording, not correctness.
    """

    def __init__(self, client: LlmClient | None = None):
        self._client = client

    def explain(self, request: ExplainRequest) -> ExplainResponse:
        if not request.candidates:
            return ExplainResponse(explanations=[], source="empty")

        client = self._client
        if client is None:
            try:
                client = build_llm_client()
            except LlmClientError as error:
                logger.info("suggestion explanation unavailable: %s", error)
                return ExplainResponse(explanations=[], source="unavailable")

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": self._user_message(request)},
        ]

        try:
            raw = client.complete_json(messages)
            parsed = json.loads(raw)
        except Exception as error:  # noqa: BLE001 - wording must never break ranking
            # Broad on purpose: this endpoint only rewrites a sentence NestJS
            # already has, so no provider failure is worth propagating.
            logger.warning("suggestion explanation failed: %s", error)
            return ExplainResponse(explanations=[], source="failed")

        return ExplainResponse(
            explanations=self._explanations(parsed, request), source="llm"
        )

    def _user_message(self, request: ExplainRequest) -> str:
        payload = {
            "task": request.taskTitle,
            "requiredSkills": request.requiredSkills,
            "candidates": [self._candidate(candidate) for candidate in request.candidates],
        }
        return json.dumps(payload, ensure_ascii=False)

    def _candidate(self, candidate: ExplainCandidate) -> dict[str, Any]:
        """Only the fields a reason may cite, so nothing else can leak into one."""
        fields: dict[str, Any] = {
            "employeeId": candidate.employeeId,
            "hoTen": candidate.fullName,
            "duDieuKien": candidate.eligible,
            "kyNangKhop": candidate.matchedSkills,
            "thieuKyNangBatBuoc": candidate.missingRequiredSkills,
            "thieuKyNangUuTien": candidate.missingImportantSkills,
        }
        if candidate.activeTaskCount is not None:
            fields["soTaskDangMo"] = candidate.activeTaskCount
        if candidate.availableHours is not None:
            fields["gioConTrongTuan"] = candidate.availableHours
        if candidate.availabilityScore is not None:
            fields["diemLichNghi"] = candidate.availabilityScore
        if candidate.warnings:
            fields["canhBao"] = [self._warning(code) for code in candidate.warnings]
        return fields

    def _warning(self, code: str) -> str:
        """
        Warning codes are NestJS internals. Spelling them out here keeps the
        model from guessing what one means - an approved leave and a pending
        request are not the same thing to a manager.
        """
        return WARNING_LABELS.get(code, code)

    def _explanations(
        self, parsed: Any, request: ExplainRequest
    ) -> list[Explanation]:
        rows = parsed.get("explanations") if isinstance(parsed, dict) else None
        if not isinstance(rows, list):
            return []

        allowed = {candidate.employeeId for candidate in request.candidates}
        explanations: list[Explanation] = []
        seen: set[int] = set()

        for row in rows:
            if not isinstance(row, dict):
                continue
            employee_id = row.get("employeeId")
            reason = row.get("reason")
            # An id the request never mentioned means the model invented a
            # person; dropping it is safer than showing it to a manager.
            if not isinstance(employee_id, int) or employee_id not in allowed:
                continue
            if employee_id in seen or not isinstance(reason, str) or not reason.strip():
                continue
            seen.add(employee_id)
            explanations.append(
                Explanation(employeeId=employee_id, reason=self._trim(reason))
            )

        return explanations

    def _trim(self, reason: str) -> str:
        cleaned = " ".join(reason.split())
        limit = settings.suggestion_reason_max_chars
        if len(cleaned) <= limit:
            return cleaned
        return cleaned[: limit - 1].rstrip() + "…"
