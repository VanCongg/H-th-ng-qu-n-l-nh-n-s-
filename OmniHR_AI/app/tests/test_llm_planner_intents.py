import json
import unittest
from pathlib import Path

from app.schemas.chat import ChatPlanRequest, ToolDefinition, UserContext
from app.services.llm_planner_service import LlmPlannerService
from app.services.rule_based_planner_service import RuleBasedPlannerService


class FailingLlmClient:
    def complete_json(self, messages: list[dict[str, str]]) -> str:
        raise RuntimeError("simulated timeout")


class LlmPlannerIntentFixtureTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fixture_path = Path(__file__).parent / "fixtures" / "intent_cases.json"
        cls.cases = json.loads(fixture_path.read_text(encoding="utf-8"))

    def setUp(self):
        self.service = LlmPlannerService(
            client=FailingLlmClient(),
            fallback=RuleBasedPlannerService(),
            fallback_enabled=True,
            confidence_threshold=0.6,
        )

    def request(self, message: str) -> ChatPlanRequest:
        return ChatPlanRequest(
            conversationId="fixture",
            message=message,
            locale="vi",
            timezone="Asia/Ho_Chi_Minh",
            today="2026-07-08",
            userContext=UserContext(
                userId=1,
                employeeId=10,
                roles=["EMPLOYEE"],
                permissions=[
                    "ATTENDANCE_READ_SELF",
                    "LEAVE_CREATE",
                    "LEAVE_CANCEL_SELF",
                    "LEAVE_READ_SELF",
                    "TASK_READ_SELF",
                    "TASK_UPDATE_STATUS",
                    "TASK_READ_TEAM",
                    "EMPLOYEE_READ_SELF",
                    "EMPLOYEE_READ_TEAM",
                    "ATTENDANCE_READ_TEAM",
                    "LEAVE_READ_TEAM",
                ],
            ),
            availableTools=[
                ToolDefinition(name="get_my_profile"),
                ToolDefinition(name="get_my_manager"),
                ToolDefinition(name="get_today_attendance"),
                ToolDefinition(name="get_attendance_policy"),
                ToolDefinition(name="get_my_leave_balance"),
                ToolDefinition(name="get_my_leave_requests"),
                ToolDefinition(name="get_leave_types"),
                ToolDefinition(name="create_leave_request_draft"),
                ToolDefinition(name="cancel_my_pending_leave_request"),
                ToolDefinition(name="get_my_tasks"),
                ToolDefinition(name="update_task_status_draft"),
                ToolDefinition(name="get_my_upcoming_tasks"),
                ToolDefinition(name="get_employee_birthdays"),
                ToolDefinition(name="get_who_is_on_leave_today"),
                ToolDefinition(name="get_upcoming_leaves"),
                ToolDefinition(name="get_team_attendance_summary"),
                ToolDefinition(name="get_team_task_summary"),
                ToolDefinition(name="get_department_headcount"),
            ],
            history=[],
        )

    def test_fixture_has_at_least_50_cases(self):
        self.assertGreaterEqual(len(self.cases), 50)

    def test_intent_fixture_uses_rule_based_fallback(self):
        for case in self.cases:
            with self.subTest(message=case["message"]):
                response = self.service.plan(self.request(case["message"]))

                self.assertTrue(response.fallbackUsed)
                self.assertEqual(response.intent, case["expectedIntent"])
                self.assertEqual(
                    response.needConfirmation,
                    case["confirmationRequired"],
                )

                expected_tool = case["expectedTool"]
                if expected_tool is None:
                    self.assertEqual(response.toolCalls, [])
                else:
                    self.assertEqual(response.toolCalls[0].toolName, expected_tool)

                if response.toolCalls:
                    available = {
                        tool.name for tool in self.request(case["message"]).availableTools
                    }
                    self.assertIn(response.toolCalls[0].toolName, available)


if __name__ == "__main__":
    unittest.main()
