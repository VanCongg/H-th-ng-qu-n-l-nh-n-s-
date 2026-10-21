# Điểm khởi động AI service (FastAPI): gắn các router health, chat (lập kế hoạch),
# explain (viết lý do gợi ý giao việc) và rag (tìm tài liệu chính sách).
# Service này chỉ dành cho NestJS gọi nội bộ, không bao giờ ghi dữ liệu.

from fastapi import FastAPI

from app.api.chat import router as chat_router
from app.api.explain import router as explain_router
from app.api.health import router as health_router
from app.api.rag import router as rag_router

app = FastAPI(title="OmniHR AI Service", version="0.1.0")

app.include_router(health_router)
app.include_router(chat_router)
app.include_router(explain_router)
app.include_router(rag_router)
