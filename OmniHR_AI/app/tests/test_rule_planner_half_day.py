import unittest

from app.schemas.chat import ChatPlanRequest, ToolDefinition, UserContext
from app.services.rule_based_planner_service import RuleBasedPlannerService


class RulePlannerHalfDayTest(unittest.TestCase):
    """A leave of one shift: "nghỉ chiều mai", "nghỉ buổi sáng ngày 2/10"."""

    def plan(self, message: str):
        return RuleBasedPlannerService().plan(
            ChatPlanRequest(
                conversationId="half-day",
                message=message,
                today="2026-09-29",
                userContext=UserContext(userId=1, employeeId=10, permissions=["LEAVE_CREATE"]),
                availableTools=[ToolDefinition(name="create_leave_request_draft")],
                history=[],
            )
        )

    def test_names_the_shift_and_keeps_it_to_one_day(self):
        cases = {
            "Tôi xin nghỉ chiều mai vì đi khám": ("AFTERNOON", "2026-09-30"),
            "Xin nghỉ buổi sáng ngày 2/10": ("MORNING", "2026-10-02"),
            "Cho tôi xin nghỉ sáng mai 2 ngày": ("MORNING", "2026-09-30"),
        }
        for message, (half, day) in cases.items():
            with self.subTest(message=message):
                arguments = self.plan(message).toolCalls[0].arguments
                self.assertEqual(arguments["halfDay"], half)
                self.assertEqual(arguments["startDate"], day)
                self.assertEqual(arguments["endDate"], day)

    def test_asks_which_half_when_none_is_named(self):
        plan = self.plan("Xin nghỉ nửa ngày mai")
        self.assertFalse(plan.toolCalls)
        self.assertIn("sáng hay buổi chiều", plan.reply)

    def test_sang_meaning_next_is_not_a_morning(self):
        arguments = self.plan("Sang tuần sau tôi xin nghỉ 1 ngày 5/10").toolCalls[0].arguments
        self.assertNotIn("halfDay", arguments)


if __name__ == "__main__":
    unittest.main()
