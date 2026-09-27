import unittest

from app.schemas.chat import ChatPlanRequest, ToolDefinition, UserContext
from app.services.rule_based_planner_service import RuleBasedPlannerService


class RulePlannerLeaveSafetyTest(unittest.TestCase):
    """Leave is filed and cancelled by the person taking it, never for someone else."""

    def setUp(self):
        self.planner = RuleBasedPlannerService()

    def plan(self, message: str):
        return self.planner.plan(
            ChatPlanRequest(
                conversationId="safety",
                message=message,
                locale="vi",
                timezone="Asia/Ho_Chi_Minh",
                today="2026-07-08",
                userContext=UserContext(
                    userId=1,
                    employeeId=10,
                    roles=["EMPLOYEE"],
                    permissions=["LEAVE_CREATE", "LEAVE_CANCEL_SELF", "LEAVE_READ_SELF"],
                ),
                availableTools=[
                    ToolDefinition(name="create_leave_request_draft"),
                    ToolDefinition(name="cancel_my_pending_leave_request"),
                    ToolDefinition(name="get_my_leave_requests"),
                    ToolDefinition(name="get_who_is_on_leave_today"),
                ],
                history=[],
            )
        )

    def test_refuses_leave_actions_for_someone_else(self):
        for message in (
            "Tạo đơn xin nghỉ phép thứ Sáu cho chị Mai",
            "Xin nghỉ ốm hộ anh Tuấn hôm nay",
            "Bạn nộp đơn nghỉ phép thay cho đồng nghiệp của tôi nhé",
            "Hủy giúp đơn nghỉ của anh Nam",
            "Hủy hết đơn nghỉ của cả phòng",
            "xin nghi phep cho Hoa ngay mai",
        ):
            with self.subTest(message=message):
                response = self.plan(message)
                self.assertEqual(response.intent, "FORBIDDEN_REQUEST")
                self.assertEqual(response.toolCalls, [])
                self.assertFalse(response.needConfirmation)

    def test_own_leave_actions_still_drafted(self):
        # "em" is how many employees refer to themselves - it must not read as someone else.
        cases = (
            ("Cho em xin nghỉ phép ngày mai", "create_leave_request_draft"),
            ("Ngày mai tôi muốn xin nghỉ phép", "create_leave_request_draft"),
            ("Hủy đơn nghỉ của em đang chờ duyệt", "cancel_my_pending_leave_request"),
        )
        for message, tool in cases:
            with self.subTest(message=message):
                response = self.plan(message)
                self.assertTrue(response.needConfirmation)
                self.assertEqual(response.toolCalls[0].toolName, tool)


if __name__ == "__main__":
    unittest.main()
