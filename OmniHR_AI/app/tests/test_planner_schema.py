import unittest

from app.schemas.planner import (
    PlannerResponse,
    PlannerValidationError,
    validate_planner_response,
)


class PlannerSchemaTest(unittest.TestCase):
    def test_accepts_valid_read_tool_and_strips_unexpected_arguments(self):
        response = PlannerResponse.model_validate(
            {
                "intent": "GET_TODAY_ATTENDANCE",
                "reply": "Toi se kiem tra cham cong hom nay.",
                "toolCalls": [
                    {
                        "toolName": "get_today_attendance",
                        "arguments": {"employeeId": 999},
                    }
                ],
                "confirmationRequired": False,
                "missingFields": [],
                "confidence": 0.9,
                "safety": {"allowed": True, "reason": None},
            }
        )

        validated = validate_planner_response(response, {"get_today_attendance"})

        self.assertEqual(validated.toolCalls[0].arguments, {})

    def test_strips_sensitive_arguments_from_birthday_tool(self):
        response = PlannerResponse.model_validate(
            {
                "intent": "GET_EMPLOYEE_BIRTHDAYS",
                "reply": "Toi se kiem tra sinh nhat.",
                "toolCalls": [
                    {
                        "toolName": "get_employee_birthdays",
                        "arguments": {"month": 7, "employeeId": 999, "birthYear": 1996},
                    }
                ],
                "confirmationRequired": False,
                "missingFields": [],
                "confidence": 0.9,
                "safety": {"allowed": True, "reason": None},
            }
        )

        validated = validate_planner_response(response, {"get_employee_birthdays"})

        self.assertEqual(validated.toolCalls[0].arguments, {"month": 7})

    def test_rejects_tool_not_available(self):
        response = PlannerResponse.model_validate(
            {
                "intent": "GET_MY_TASKS",
                "reply": "Toi se kiem tra task cua ban.",
                "toolCalls": [{"toolName": "get_my_tasks", "arguments": {}}],
                "confirmationRequired": False,
                "missingFields": [],
                "confidence": 0.9,
                "safety": {"allowed": True, "reason": None},
            }
        )

        with self.assertRaises(PlannerValidationError):
            validate_planner_response(response, {"get_today_attendance"})

    def test_rejects_write_tool_without_confirmation(self):
        response = PlannerResponse.model_validate(
            {
                "intent": "CREATE_LEAVE_REQUEST_DRAFT",
                "reply": "Toi da chuan bi nhap don nghi.",
                "toolCalls": [
                    {
                        "toolName": "create_leave_request_draft",
                        "arguments": {
                            "leaveTypeCode": "ANNUAL_LEAVE",
                            "startDate": "2026-07-08",
                            "endDate": "2026-07-08",
                            "reason": "Co viec gia dinh",
                        },
                    }
                ],
                "confirmationRequired": False,
                "missingFields": [],
                "confidence": 0.9,
                "safety": {"allowed": True, "reason": None},
            }
        )

        with self.assertRaises(PlannerValidationError):
            validate_planner_response(response, {"create_leave_request_draft"})

    def test_rejects_unsafe_response_with_tool_calls(self):
        response = PlannerResponse.model_validate(
            {
                "intent": "FORBIDDEN_REQUEST",
                "reply": "Toi khong the thuc hien yeu cau nay.",
                "toolCalls": [{"toolName": "get_my_profile", "arguments": {}}],
                "confirmationRequired": False,
                "missingFields": [],
                "confidence": 0.95,
                "safety": {
                    "allowed": False,
                    "reason": "FORBIDDEN_OR_UNSAFE_REQUEST",
                },
            }
        )

        with self.assertRaises(PlannerValidationError):
            validate_planner_response(response, {"get_my_profile"})

    def test_rejects_missing_fields_with_tool_calls(self):
        response = PlannerResponse.model_validate(
            {
                "intent": "CREATE_LEAVE_REQUEST_DRAFT",
                "reply": "Ban muon nghi ngay nao?",
                "toolCalls": [{"toolName": "create_leave_request_draft", "arguments": {}}],
                "confirmationRequired": False,
                "missingFields": ["startDate"],
                "confidence": 0.9,
                "safety": {"allowed": True, "reason": None},
            }
        )

        with self.assertRaises(PlannerValidationError):
            validate_planner_response(response, {"create_leave_request_draft"})


if __name__ == "__main__":
    unittest.main()


def test_task_status_draft_is_a_write_tool_with_a_narrow_argument_list():
    """
    The tool exists in NestJS and in the rule-based planner; leaving it out of
    the schema made it unreachable in hybrid mode, which is what ships.
    """
    from app.schemas.planner import (
        TOOL_ARGUMENT_ALLOWLISTS,
        WRITE_TOOLS,
        PlannerIntent,
        PlannerToolName,
    )

    assert PlannerToolName.UPDATE_TASK_STATUS_DRAFT in WRITE_TOOLS
    assert PlannerIntent.UPDATE_TASK_STATUS_DRAFT
    assert TOOL_ARGUMENT_ALLOWLISTS[PlannerToolName.UPDATE_TASK_STATUS_DRAFT] == {
        "status",
        "taskId",
        "taskTitle",
    }
