from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.security import verify_internal_token
from app.schemas.chat import ChatPlanRequest, ChatPlanResponse
from app.services.tool_planner_service import ToolPlannerService

router = APIRouter(prefix="/internal/chat", dependencies=[Depends(verify_internal_token)])
planner = ToolPlannerService()


@router.post("/plan", response_model=ChatPlanResponse)
def plan_chat(request: ChatPlanRequest) -> ChatPlanResponse:
    return planner.plan(request)
