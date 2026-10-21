import unittest

from app.schemas.chat import ChatPlanRequest, ToolDefinition, UserContext
from app.services.rule_based_planner_service import RuleBasedPlannerService


class RulePlannerTaskStatusTest(unittest.TestCase):
    """An employee reports progress on their own task in their own words."""

    def setUp(self):
        self.planner = RuleBasedPlannerService()

    def plan(self, message: str):
        return self.planner.plan(
            ChatPlanRequest(
                conversationId="task-status",
                message=message,
                locale="vi",
                timezone="Asia/Ho_Chi_Minh",
                today="2026-09-25",
                userContext=UserContext(
                    userId=1,
                    employeeId=10,
                    roles=["EMPLOYEE"],
                    permissions=["TASK_READ_SELF", "TASK_UPDATE_STATUS"],
                ),
                availableTools=[
                    ToolDefinition(name="get_my_tasks"),
                    ToolDefinition(name="get_my_upcoming_tasks"),
                    ToolDefinition(name="get_my_task_stats"),
                    ToolDefinition(name="update_task_status_draft"),
                ],
                history=[],
            )
        )

    def draft_arguments(self, message: str):
        plan = self.plan(message)
        self.assertEqual(plan.intent, "UPDATE_TASK_STATUS_DRAFT", message)
        self.assertTrue(plan.toolCalls, message)
        self.assertEqual(plan.toolCalls[0].toolName, "update_task_status_draft")
        return plan.toolCalls[0].arguments

    def test_reading_the_target_status_and_the_title(self):
        cases = {
            "Hoàn thành task Build login": "DONE",
            "Tôi đã hoàn thành task Build login": "DONE",
            "Hoàn tất công việc Build login": "DONE",
            "Cập nhật task Build login sang hoàn thành": "DONE",
            "Gửi duyệt task Build login": "IN_REVIEW",
            "Rút task Build login về đang làm": "IN_PROGRESS",
            "Rút task Build login": "IN_PROGRESS",
        }
        for message, status in cases.items():
            with self.subTest(message=message):
                self.assertEqual(
                    self.draft_arguments(message),
                    {"status": status, "taskTitle": "Build login"},
                )

    def test_the_status_it_is_in_now_is_not_the_target(self):
        arguments = self.draft_arguments(
            "Cập nhật task Build login đang chờ duyệt thành hoàn thành"
        )
        self.assertEqual(arguments, {"status": "DONE", "taskTitle": "Build login"})

    def test_a_title_may_contain_ve(self):
        arguments = self.draft_arguments("Cập nhật task Tài liệu về API sang đang làm")
        self.assertEqual(
            arguments, {"status": "IN_PROGRESS", "taskTitle": "Tài liệu về API"}
        )

    def test_questions_are_not_updates(self):
        self.assertEqual(self.plan("Đã hoàn thành task Build login chưa?").intent, "GET_MY_TASKS")
        self.assertEqual(
            self.plan("Tháng này tôi hoàn thành bao nhiêu task").intent, "GET_MY_TASK_STATS"
        )

    def test_open_tasks_include_those_waiting_for_review(self):
        plan = self.plan("Task của tôi")
        self.assertEqual(plan.toolCalls[0].toolName, "get_my_tasks")
        self.assertIn("IN_REVIEW", plan.toolCalls[0].arguments["status"])


if __name__ == "__main__":
    unittest.main()
