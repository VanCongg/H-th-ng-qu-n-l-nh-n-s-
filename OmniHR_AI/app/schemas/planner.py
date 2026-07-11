from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.chat import ChatPlanResponse, Confirmation, ToolCall as ChatToolCall


class PlannerIntent(str, Enum):
    SMALL_TALK = "SMALL_TALK"
    GET_MY_PROFILE = "GET_MY_PROFILE"
    GET_TODAY_ATTENDANCE = "GET_TODAY_ATTENDANCE"
    GET_ATTENDANCE_POLICY = "GET_ATTENDANCE_POLICY"
    GET_MY_LEAVE_BALANCE = "GET_MY_LEAVE_BALANCE"
    GET_MY_LEAVE_REQUESTS = "GET_MY_LEAVE_REQUESTS"
    GET_LEAVE_TYPES = "GET_LEAVE_TYPES"
    CREATE_LEAVE_REQUEST_DRAFT = "CREATE_LEAVE_REQUEST_DRAFT"
    CANCEL_MY_PENDING_LEAVE_REQUEST = "CANCEL_MY_PENDING_LEAVE_REQUEST"
    GET_MY_TASKS = "GET_MY_TASKS"
    GET_MY_UPCOMING_TASKS = "GET_MY_UPCOMING_TASKS"
    UNKNOWN = "UNKNOWN"
    OUT_OF_SCOPE = "OUT_OF_SCOPE"
    FORBIDDEN_REQUEST = "FORBIDDEN_REQUEST"


class PlannerToolName(str, Enum):
    GET_MY_PROFILE = "get_my_profile"
    GET_TODAY_ATTENDANCE = "get_today_attendance"
    GET_ATTENDANCE_POLICY = "get_attendance_policy"
    GET_MY_LEAVE_BALANCE = "get_my_leave_balance"
    GET_MY_LEAVE_REQUESTS = "get_my_leave_requests"
    GET_LEAVE_TYPES = "get_leave_types"
    CREATE_LEAVE_REQUEST_DRAFT = "create_leave_request_draft"
    CANCEL_MY_PENDING_LEAVE_REQUEST = "cancel_my_pending_leave_request"
    GET_MY_TASKS = "get_my_tasks"
    GET_MY_UPCOMING_TASKS = "get_my_upcoming_tasks"


class PlannerToolCall(BaseModel):
    model_config = ConfigDict(extra="forbid")

    toolName: PlannerToolName
    arguments: dict[str, Any] = Field(default_factory=dict)


class PlannerSafety(BaseModel):
    model_config = ConfigDict(extra="forbid")

    allowed: bool
    reason: str | None = None


class PlannerResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intent: PlannerIntent
    reply: str = Field(min_length=1, max_length=1000)
    toolCalls: list[PlannerToolCall] = Field(default_factory=list, max_length=3)
    confirmationRequired: bool
    missingFields: list[str] = Field(default_factory=list, max_length=10)
    confidence: float = Field(ge=0, le=1)
    safety: PlannerSafety


class PlannerValidationError(ValueError):
    pass


READ_TOOLS = {
    PlannerToolName.GET_MY_PROFILE,
    PlannerToolName.GET_TODAY_ATTENDANCE,
    PlannerToolName.GET_ATTENDANCE_POLICY,
    PlannerToolName.GET_MY_LEAVE_BALANCE,
    PlannerToolName.GET_MY_LEAVE_REQUESTS,
    PlannerToolName.GET_LEAVE_TYPES,
    PlannerToolName.GET_MY_TASKS,
    PlannerToolName.GET_MY_UPCOMING_TASKS,
}

WRITE_TOOLS = {
    PlannerToolName.CREATE_LEAVE_REQUEST_DRAFT,
    PlannerToolName.CANCEL_MY_PENDING_LEAVE_REQUEST,
}

TOOL_ARGUMENT_ALLOWLISTS = {
    PlannerToolName.GET_MY_PROFILE: set(),
    PlannerToolName.GET_TODAY_ATTENDANCE: set(),
    PlannerToolName.GET_ATTENDANCE_POLICY: set(),
    PlannerToolName.GET_MY_LEAVE_BALANCE: {"year"},
    PlannerToolName.GET_MY_LEAVE_REQUESTS: {"status", "limit"},
    PlannerToolName.GET_LEAVE_TYPES: set(),
    PlannerToolName.GET_MY_TASKS: {"status", "limit"},
    PlannerToolName.GET_MY_UPCOMING_TASKS: {"mode", "days", "limit"},
    PlannerToolName.CREATE_LEAVE_REQUEST_DRAFT: {
        "leaveTypeCode",
        "leaveTypeId",
        "startDate",
        "endDate",
        "reason",
    },
    PlannerToolName.CANCEL_MY_PENDING_LEAVE_REQUEST: {
        "leaveRequestId",
        "startDate",
    },
}


def validate_planner_response(
    response: PlannerResponse,
    available_tools: set[str],
) -> PlannerResponse:
    if not response.safety.allowed and response.toolCalls:
        raise PlannerValidationError("Unsafe planner response cannot include tool calls")

    if response.missingFields and response.toolCalls:
        raise PlannerValidationError("Planner response with missing fields cannot call tools")

    sanitized_calls: list[PlannerToolCall] = []
    for call in response.toolCalls:
        tool_name = call.toolName.value
        if tool_name not in available_tools:
            raise PlannerValidationError(f"Tool is not available: {tool_name}")

        if call.toolName in WRITE_TOOLS and not response.confirmationRequired:
            raise PlannerValidationError("Write tools require confirmation")

        allowed_args = TOOL_ARGUMENT_ALLOWLISTS[call.toolName]
        sanitized_args = {
            key: value
            for key, value in call.arguments.items()
            if key in allowed_args
        }
        sanitized_calls.append(
            PlannerToolCall(toolName=call.toolName, arguments=sanitized_args)
        )

    if response.intent == PlannerIntent.CREATE_LEAVE_REQUEST_DRAFT:
        has_leave_tool = any(
            call.toolName == PlannerToolName.CREATE_LEAVE_REQUEST_DRAFT
            for call in sanitized_calls
        )
        if has_leave_tool and not response.confirmationRequired:
            raise PlannerValidationError("Leave draft intent requires confirmation")

    if response.intent == PlannerIntent.CANCEL_MY_PENDING_LEAVE_REQUEST:
        has_cancel_tool = any(
            call.toolName == PlannerToolName.CANCEL_MY_PENDING_LEAVE_REQUEST
            for call in sanitized_calls
        )
        if has_cancel_tool and not response.confirmationRequired:
            raise PlannerValidationError("Cancel leave intent requires confirmation")

    return response.model_copy(update={"toolCalls": sanitized_calls})


def planner_to_chat_response(response: PlannerResponse) -> ChatPlanResponse:
    tool_calls = [
        ChatToolCall(
            id=f"call_{uuid4().hex[:8]}",
            toolName=call.toolName.value,
            arguments=call.arguments,
        )
        for call in response.toolCalls
    ]

    if tool_calls:
        plan_type = "confirmation_required" if response.confirmationRequired else "tool_plan"
    else:
        plan_type = "answer"

    confirmation = None
    if response.confirmationRequired and tool_calls:
        confirmation = Confirmation(
            title="Xac nhan thao tac",
            summary=tool_calls[0].arguments,
        )

    return ChatPlanResponse(
        type=plan_type,
        intent=response.intent.value,
        reply=response.reply,
        toolCalls=tool_calls,
        needConfirmation=response.confirmationRequired,
        confirmation=confirmation,
        confidence=response.confidence,
    )
