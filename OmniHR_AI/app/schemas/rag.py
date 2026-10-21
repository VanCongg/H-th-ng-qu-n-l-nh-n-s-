from typing import Any

from pydantic import BaseModel, Field


class RagSearchRequest(BaseModel):
    query: str
    locale: str = "vi"
    topK: int = 5
    filters: dict[str, Any] = Field(default_factory=dict)


class RagSearchItem(BaseModel):
    documentId: str
    chunkId: str
    title: str
    content: str
    score: float
    metadata: dict[str, Any] = Field(default_factory=dict)


class RagSearchResponse(BaseModel):
    items: list[RagSearchItem] = Field(default_factory=list)
