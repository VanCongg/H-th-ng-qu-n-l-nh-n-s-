# Hợp đồng dữ liệu giữa NestJS và AI service cho /internal/chat/plan.

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


# Thông tin người hỏi: id, roles, permissions, phòng ban, vị trí.
class UserContext(BaseModel):
    userId: int
    employeeId: int | None = None
    roles: list[str] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)
    departmentId: int | None = None
    positionId: int | None = None


# Một tool người dùng được phép dùng.
class ToolDefinition(BaseModel):
    name: str
    description: str = ""

    @model_validator(mode="before")
    @classmethod
    def normalize_tool_definition(cls, value: Any) -> Any:
        if isinstance(value, str):
            return {"name": value, "description": ""}
        return value


# Một tin nhắn trong lịch sử (đã ẩn dữ liệu nhạy cảm ở NestJS).
class HistoryMessage(BaseModel):
    role: Literal["user", "assistant", "tool", "system"]
    content: str


# Yêu cầu lập kế hoạch: tin nhắn, ngày hôm nay, người hỏi, tool được phép, lịch sử.
class ChatPlanRequest(BaseModel):
    conversationId: str | None = None
    message: str
    locale: str = "vi"
    timezone: str = "Asia/Ho_Chi_Minh"
    today: str | None = None
    currentDate: str | None = None
    userContext: UserContext
    availableTools: list[ToolDefinition] = Field(default_factory=list)
    history: list[HistoryMessage] = Field(default_factory=list)

    @model_validator(mode="after")
    def normalize_current_date(self) -> "ChatPlanRequest":
        if not self.today and self.currentDate:
            self.today = self.currentDate
        if not self.today:
            raise ValueError("today/currentDate is required")
        return self


# Một lời gọi tool đề xuất.
class ToolCall(BaseModel):
    id: str
    toolName: str
    arguments: dict[str, Any] = Field(default_factory=dict)


# Thông tin xác nhận cho thao tác ghi.
class Confirmation(BaseModel):
    title: str | None = None
    summary: dict[str, Any] = Field(default_factory=dict)


# Kế hoạch trả về NestJS: type / intent / reply / toolCalls / needConfirmation (cố định mọi chế độ).
class ChatPlanResponse(BaseModel):
    type: Literal["answer", "tool_plan", "confirmation_required"]
    intent: str | None = None
    reply: str
    toolCalls: list[ToolCall] = Field(default_factory=list)
    needConfirmation: bool = False
    confirmation: Confirmation | None = None
    confidence: float = 0.7
    fallbackUsed: bool | None = None
    provider: str | None = None
    model: str | None = None
    citations: list[dict[str, Any]] = Field(default_factory=list)
