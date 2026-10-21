from fastapi import APIRouter, Depends

from app.core.security import verify_internal_token
from app.schemas.explain import ExplainRequest, ExplainResponse
from app.services.suggestion_explainer_service import SuggestionExplainerService

router = APIRouter(
    prefix="/internal/suggestions", dependencies=[Depends(verify_internal_token)]
)
explainer = SuggestionExplainerService()


@router.post("/explain", response_model=ExplainResponse)
def explain_suggestions(request: ExplainRequest) -> ExplainResponse:
    """
    Wording only: NestJS has already ranked and stored the candidates, and
    keeps its own sentence when this returns nothing.
    """
    return explainer.explain(request)
