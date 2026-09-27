import unittest

from app.schemas.chat import ChatPlanRequest, ToolDefinition, UserContext
from app.services.rule_based_planner_service import RuleBasedPlannerService

TOOLS = [
    "get_today_attendance", "get_attendance_policy", "get_my_leave_balance", "get_my_leave_requests",
    "get_my_tasks", "get_my_upcoming_tasks", "get_my_profile", "get_my_manager",
    "get_who_is_on_leave_today", "get_upcoming_leaves", "get_team_attendance_summary",
    "get_team_task_summary", "get_department_headcount", "create_leave_request_draft",
    "cancel_my_pending_leave_request",
]


class RulePlannerParaphraseTest(unittest.TestCase):
    """The fallback planner copes with how people actually ask when the LLM is down."""

    def plan(self, message: str, today: str = "2026-07-08"):
        return RuleBasedPlannerService().plan(
            ChatPlanRequest(
                conversationId="paraphrase",
                message=message,
                today=today,
                userContext=UserContext(userId=1, employeeId=10),
                availableTools=[ToolDefinition(name=name) for name in TOOLS],
                history=[],
            )
        )

    def assert_tool(self, message: str, tool: str):
        plan = self.plan(message)
        self.assertTrue(plan.toolCalls, f"{message!r} planned no tool")
        self.assertEqual(plan.toolCalls[0].toolName, tool, message)

    def test_everyday_wordings_reach_the_right_tool(self):
        cases = {
            "Sáng nay tôi đã quẹt vân tay vào ca chưa nhỉ?": "get_today_attendance",
            "Mấy giờ thì được tan làm?": "get_attendance_policy",
            "Quỹ phép năm nay của tôi còn lại bao nhiêu ngày?": "get_my_leave_balance",
            "Liệt kê các đơn nghỉ mình đã gửi": "get_my_leave_requests",
            "Tuần này tôi có việc nào tới hạn không?": "get_my_upcoming_tasks",
            "Mã nhân viên của tôi là gì?": "get_my_profile",
            "Ai là sếp trực tiếp của tôi?": "get_my_manager",
            "Hôm nay ai vắng mặt vì nghỉ phép?": "get_who_is_on_leave_today",
            "Tuần sau có những ai xin nghỉ?": "get_upcoming_leaves",
            "Sáng nay team mình ai đi làm muộn?": "get_team_attendance_summary",
            "Nhóm tôi còn bao nhiêu việc chưa xong?": "get_team_task_summary",
            "Công ty hiện có bao nhiêu nhân sự?": "get_department_headcount",
            "Rút lại đơn nghỉ ngày mai giúp tôi": "cancel_my_pending_leave_request",
        }
        for message, tool in cases.items():
            with self.subTest(message=message):
                self.assert_tool(message, tool)

    def test_a_question_about_leave_is_not_a_leave_request(self):
        # "nghỉ phép" in the sentence used to read as filing leave.
        self.assert_tool("Hôm nay ai vắng mặt vì nghỉ phép?", "get_who_is_on_leave_today")
        # And asking whether the boss approved it is about the request.
        plan = self.plan("Đơn xin nghỉ tuần trước của tôi đã được sếp duyệt chưa?")
        self.assertNotEqual(plan.toolCalls[0].toolName if plan.toolCalls else None, "get_my_manager")

    def test_reads_a_weekday_as_a_date(self):
        # Wednesday 8 July 2026.
        arguments = self.plan("Thứ 6 tuần này tôi muốn nghỉ phép").toolCalls[0].arguments
        self.assertEqual(arguments["startDate"], "2026-07-10")
        arguments = self.plan("Cho tôi nghỉ 3 ngày từ thứ hai tuần sau").toolCalls[0].arguments
        self.assertEqual(arguments["startDate"], "2026-07-13")
        self.assertEqual(arguments["endDate"], "2026-07-15")

    def test_a_weekday_already_past_means_next_week(self):
        # "thứ 2" on a Wednesday is next Monday, never two days ago.
        arguments = self.plan("Xin nghỉ phép thứ 2").toolCalls[0].arguments
        self.assertEqual(arguments["startDate"], "2026-07-13")


if __name__ == "__main__":
    unittest.main()
