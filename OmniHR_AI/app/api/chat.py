from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.security import verify_internal_token
from app.schemas.chat import ChatPlanRequest, ChatPlanResponse
from app.services.tool_planner_service import ToolPlannerService

# Endpoint nội bộ, chỉ NestJS gọi: mọi request phải có header
# X-Internal-Service-Token đúng (so sánh hằng thời gian trong verify_internal_token).
router = APIRouter(prefix="/internal/chat", dependencies=[Depends(verify_internal_token)])
planner = ToolPlannerService()


@router.post("/plan", response_model=ChatPlanResponse)
def plan_chat(request: ChatPlanRequest) -> ChatPlanResponse:
    """Nhận tin nhắn + danh sách tool được phép, trả về kế hoạch
    (type / intent / reply / toolCalls / needConfirmation). Không đọc hay ghi dữ liệu."""
    return planner.plan(request)
