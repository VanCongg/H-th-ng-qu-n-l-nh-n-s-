# Hợp đồng dữ liệu cho tìm kiếm tài liệu chính sách (RAG).

from typing import Any

from pydantic import BaseModel, Field


# Câu hỏi và số kết quả muốn lấy (topK).
class RagSearchRequest(BaseModel):
    query: str
    locale: str = "vi"
    topK: int = 5
    filters: dict[str, Any] = Field(default_factory=dict)


# Một đoạn tài liệu tìm được kèm điểm.
class RagSearchItem(BaseModel):
    documentId: str
    chunkId: str
    title: str
    content: str
    score: float
    metadata: dict[str, Any] = Field(default_factory=dict)


class RagSearchResponse(BaseModel):
    items: list[RagSearchItem] = Field(default_factory=list)
