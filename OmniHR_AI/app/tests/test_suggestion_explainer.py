import json

from app.schemas.explain import ExplainCandidate, ExplainRequest
from app.services.suggestion_explainer_service import SuggestionExplainerService


class FakeLlmClient:
    def __init__(self, payload: str):
        self.payload = payload
        self.messages: list[dict[str, str]] | None = None

    def complete_json(self, messages: list[dict[str, str]]) -> str:
        self.messages = messages
        return self.payload


class FailingLlmClient:
    def complete_json(self, messages: list[dict[str, str]]) -> str:
        raise RuntimeError("provider is down")


def request_with(*candidates: ExplainCandidate) -> ExplainRequest:
    return ExplainRequest(
        taskTitle="Viết API báo cáo chấm công",
        requiredSkills=["NESTJS", "POSTGRESQL"],
        candidates=list(candidates),
    )


def candidate(employee_id: int, name: str, **overrides) -> ExplainCandidate:
    fields = {
        "employeeId": employee_id,
        "fullName": name,
        "score": 84.0,
        "skillScore": 90.0,
        "workloadScore": 70.0,
        "availabilityScore": 100.0,
        "matchedSkills": ["NESTJS"],
        "activeTaskCount": 2,
        "availableHours": 18.0,
    }
    fields.update(overrides)
    return ExplainCandidate(**fields)


def test_keeps_one_reason_per_known_candidate():
    client = FakeLlmClient(
        json.dumps(
            {
                "explanations": [
                    {"employeeId": 10, "reason": "Khớp   NESTJS, còn 18h trong tuần."},
                    {"employeeId": 11, "reason": "Thiếu kỹ năng bắt buộc POSTGRESQL."},
                ]
            },
            ensure_ascii=False,
        )
    )
    service = SuggestionExplainerService(client=client)

    result = service.explain(
        request_with(candidate(10, "Lê Bảo Ngọc"), candidate(11, "Vũ Anh Tuấn"))
    )

    assert result.source == "llm"
    assert [item.employeeId for item in result.explanations] == [10, 11]
    # Whitespace from the model is normalised before it reaches a table cell.
    assert result.explanations[0].reason == "Khớp NESTJS, còn 18h trong tuần."


def test_drops_candidates_the_request_never_mentioned():
    client = FakeLlmClient(
        json.dumps(
            {
                "explanations": [
                    {"employeeId": 10, "reason": "Khớp NESTJS."},
                    {"employeeId": 999, "reason": "Người này không có trong danh sách."},
                    {"employeeId": 10, "reason": "Câu thứ hai cho cùng một người."},
                ]
            },
            ensure_ascii=False,
        )
    )
    service = SuggestionExplainerService(client=client)

    result = service.explain(request_with(candidate(10, "Lê Bảo Ngọc")))

    assert [item.employeeId for item in result.explanations] == [10]
    assert result.explanations[0].reason == "Khớp NESTJS."


def test_a_broken_provider_returns_nothing_instead_of_raising():
    service = SuggestionExplainerService(client=FailingLlmClient())

    result = service.explain(request_with(candidate(10, "Lê Bảo Ngọc")))

    assert result.explanations == []
    assert result.source == "failed"


def test_invalid_json_returns_nothing():
    service = SuggestionExplainerService(client=FakeLlmClient("không phải JSON"))

    result = service.explain(request_with(candidate(10, "Lê Bảo Ngọc")))

    assert result.explanations == []
    assert result.source == "failed"


def test_prompt_carries_only_fields_a_reason_may_cite():
    client = FakeLlmClient(json.dumps({"explanations": []}))
    service = SuggestionExplainerService(client=client)

    service.explain(
        request_with(
            candidate(
                10,
                "Lê Bảo Ngọc",
                score=91.5,
                skillScore=95.0,
                missingRequiredSkills=["POSTGRESQL"],
            )
        )
    )

    assert client.messages is not None
    payload = json.loads(client.messages[1]["content"])
    sent = payload["candidates"][0]
    # The total score and the component scores are the ranking's business; a
    # sentence that quotes them invites the manager to argue with the number.
    assert "score" not in sent
    assert "skillScore" not in sent
    assert sent["thieuKyNangBatBuoc"] == ["POSTGRESQL"]


def test_warning_codes_reach_the_model_as_words():
    client = FakeLlmClient(json.dumps({"explanations": []}))
    service = SuggestionExplainerService(client=client)

    service.explain(
        request_with(
            candidate(
                10,
                "Lê Bảo Ngọc",
                warnings=["PENDING_LEAVE_OVERLAP", "SOMETHING_NEW"],
            )
        )
    )

    assert client.messages is not None
    sent = json.loads(client.messages[1]["content"])["candidates"][0]
    # A pending request is not an approved day off, and the model should not
    # have to guess that from a code. An unknown code passes through as-is.
    assert sent["canhBao"] == [
        "có đơn nghỉ đang chờ duyệt trùng thời gian task",
        "SOMETHING_NEW",
    ]


def test_the_name_never_reaches_the_model():
    client = FakeLlmClient(json.dumps({"explanations": []}))
    service = SuggestionExplainerService(client=client)

    service.explain(request_with(candidate(10, "Lê Bảo Ngọc")))

    assert client.messages is not None
    assert "Lê Bảo Ngọc" not in client.messages[1]["content"]


def test_track_record_and_fair_share_reach_the_model_as_words():
    client = FakeLlmClient(json.dumps({"explanations": []}))
    service = SuggestionExplainerService(client=client)

    service.explain(
        request_with(
            candidate(
                10,
                "Lê Bảo Ngọc",
                historyScore=86.4,
                historySampleSize=12,
                fairShare=1.8,
                fairSharePenalty=8.0,
            ),
            candidate(11, "Vũ Anh Tuấn", historyScore=55.0, historySampleSize=0),
        )
    )

    assert client.messages is not None
    sent = json.loads(client.messages[1]["content"])["candidates"]
    assert sent[0]["thanhTich"] == "thành tích đúng hạn và đúng giờ cao trên 12 task đã hoàn thành"
    assert "1.8 lần" in sent[0]["canBangTai"]
    assert "đồng nghiệp cùng cấp" in sent[1]["thanhTich"]
    assert "canBangTai" not in sent[1]
    # Words, not the number the ranking used.
    assert "86.4" not in client.messages[1]["content"]
