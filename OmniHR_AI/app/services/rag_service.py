from app.schemas.rag import RagSearchRequest, RagSearchResponse


class RagService:
    def search(self, _request: RagSearchRequest) -> RagSearchResponse:
        return RagSearchResponse(items=[])
