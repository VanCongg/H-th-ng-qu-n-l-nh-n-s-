from fastapi import APIRouter, Depends

from app.core.security import verify_internal_token
from app.schemas.rag import RagSearchRequest, RagSearchResponse
from app.services.rag_service import RagService

router = APIRouter(prefix="/internal/rag", dependencies=[Depends(verify_internal_token)])
rag_service = RagService()


@router.post("/search", response_model=RagSearchResponse)
def search(request: RagSearchRequest) -> RagSearchResponse:
    return rag_service.search(request)
