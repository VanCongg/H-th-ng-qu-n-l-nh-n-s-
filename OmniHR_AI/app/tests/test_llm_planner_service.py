import json
import unittest

from app.schemas.chat import ChatPlanRequest, ToolDefinition, UserContext
from app.services.llm_planner_service import LlmPlannerService
from app.services.rule_based_planner_service import RuleBasedPlannerService


class FakeLlmClient:
    def __init__(self, output: str | Exception):
        self.output = output

    def complete_json(self, messages: list[dict[str, str]]) -> str:
        if isinstance(self.output, Exception):
            raise self.output
        return self.output


class LlmPlannerServiceTest(unittest.TestCase):
    def request(self, message: str) -> ChatPlanRequest:
        return ChatPlanRequest(
            conversationId="1",
            message=message,
            locale="vi",
            timezone="Asia/Ho_Chi_Minh",
            today="2026-07-07",
            userContext=UserContext(
                userId=1,
                employeeId=10,
                roles=["EMPLOYEE"],
                permissions=[
                    "ATTENDANCE_READ_SELF",
                    "LEAVE_CREATE",
                    "LEAVE_READ_SELF",
                    "TASK_READ_SELF",
                ],
            ),
            availableTools=[
                ToolDefinition(name="get_today_attendance"),
                ToolDefinition(name="get_my_leave_balance"),
                ToolDefinition(name="create_leave_request_draft"),
                ToolDefinition(name="get_my_tasks"),
            ],
            history=[],
        )

    def service(self, output: str | Exception) -> LlmPlannerService:
        return LlmPlannerService(
            client=FakeLlmClient(output),
            fallback=RuleBasedPlannerService(),
            fallback_enabled=True,
            confidence_threshold=0.6,
        )

    def test_valid_llm_plan_maps_to_chat_plan_response(self):
        output = json.dumps(
            {
                "intent": "GET_TODAY_ATTENDANCE",
                "reply": "Toi se kiem tra cham cong hom nay cua ban.",
                "toolCalls": [
                    {
                        "toolName": "get_today_attendance",
                        "arguments": {"employeeId": 999},
                    }
                ],
                "confirmationRequired": False,
                "missingFields": [],
                "confidence": 0.92,
                "safety": {"allowed": True, "reason": None},
            }
        )

        response = self.service(output).plan(
            self.request("Hom nay toi da check-in chua?")
        )

        self.assertEqual(response.type, "tool_plan")
        self.assertEqual(response.toolCalls[0].toolName, "get_today_attendance")
        self.assertEqual(response.toolCalls[0].arguments, {})

    def test_invalid_json_falls_back_to_rule_based(self):
        response = self.service("not-json").plan(
            self.request("Toi con bao nhieu ngay phep?")
        )

        self.assertEqual(response.type, "tool_plan")
        self.assertEqual(response.toolCalls[0].toolName, "get_my_leave_balance")

    def test_low_confidence_falls_back_to_rule_based(self):
        output = json.dumps(
            {
                "intent": "UNKNOWN",
                "reply": "Toi chua chac yeu cau nay.",
                "toolCalls": [],
                "confirmationRequired": False,
                "missingFields": [],
                "confidence": 0.2,
                "safety": {"allowed": True, "reason": None},
            }
        )

        response = self.service(output).plan(
            self.request("Toi co task nao sap den han khong?")
        )

        self.assertEqual(response.type, "tool_plan")
        self.assertEqual(response.toolCalls[0].toolName, "get_my_tasks")

    def test_llm_exception_falls_back_to_rule_based(self):
        response = self.service(RuntimeError("timeout")).plan(
            self.request("Mai toi muon nghi 1 ngay")
        )

        self.assertEqual(response.type, "confirmation_required")
        self.assertEqual(
            response.toolCalls[0].toolName,
            "create_leave_request_draft",
        )


if __name__ == "__main__":
    unittest.main()
