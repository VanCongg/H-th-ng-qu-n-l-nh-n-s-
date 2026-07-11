import unittest

from app.schemas.chat import ChatPlanRequest, ToolDefinition, UserContext
from app.services.tool_planner_service import ToolPlannerService


class ToolPlannerServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.planner = ToolPlannerService()

    def request(self, message: str) -> ChatPlanRequest:
        return ChatPlanRequest(
            message=message,
            today="2026-07-01",
            userContext=UserContext(
                userId=1,
                employeeId=10,
                roles=["EMPLOYEE"],
                permissions=[
                    "LEAVE_CREATE",
                    "LEAVE_READ_SELF",
                    "ATTENDANCE_READ_SELF",
                    "TASK_READ_SELF",
                ],
            ),
            availableTools=[
                ToolDefinition(name="create_leave_request_draft"),
                ToolDefinition(name="get_my_leave_balance"),
                ToolDefinition(name="get_today_attendance"),
                ToolDefinition(name="get_my_leave_requests"),
                ToolDefinition(name="get_my_tasks"),
            ],
        )

    def test_leave_request_tomorrow(self) -> None:
        response = self.planner.plan(self.request("Mai tôi muốn nghỉ 1 ngày"))

        self.assertEqual(response.type, "confirmation_required")
        self.assertEqual(response.toolCalls[0].toolName, "create_leave_request_draft")
        self.assertEqual(response.toolCalls[0].arguments["startDate"], "2026-07-02")
        self.assertEqual(response.toolCalls[0].arguments["endDate"], "2026-07-02")

    def test_leave_balance(self) -> None:
        response = self.planner.plan(self.request("Tôi còn bao nhiêu ngày phép?"))

        self.assertEqual(response.type, "tool_plan")
        self.assertEqual(response.toolCalls[0].toolName, "get_my_leave_balance")

    def test_today_attendance(self) -> None:
        response = self.planner.plan(self.request("Hôm nay tôi đã check-in chưa?"))

        self.assertEqual(response.type, "tool_plan")
        self.assertEqual(response.toolCalls[0].toolName, "get_today_attendance")

    def test_leave_request_status(self) -> None:
        response = self.planner.plan(self.request("Đơn nghỉ của tôi duyệt chưa?"))

        self.assertEqual(response.type, "tool_plan")
        self.assertEqual(response.toolCalls[0].toolName, "get_my_leave_requests")

    def test_upcoming_tasks(self) -> None:
        response = self.planner.plan(
            self.request("Tôi có task nào sắp hết hạn không?")
        )

        self.assertEqual(response.type, "tool_plan")
        self.assertEqual(response.toolCalls[0].toolName, "get_my_tasks")


if __name__ == "__main__":
    unittest.main()
