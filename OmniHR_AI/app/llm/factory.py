# Tạo client LLM / embedding theo cấu hình (hiện hỗ trợ API kiểu OpenAI: OpenAI, Gemini...).

from app.core.config import settings
from app.llm.base import EmbeddingClient, EmbeddingClientError, LlmClient, LlmClientError
from app.llm.openai_compatible import OpenAICompatibleLlmClient
from app.llm.openai_compatible_embeddings import OpenAICompatibleEmbeddingClient

_OPENAI_COMPATIBLE = {"openai", "openai_compatible", "generic"}


def current_provider() -> str:
    return settings.llm_provider


# Client LLM theo LLM_PROVIDER; provider không hỗ trợ thì báo lỗi (planner sẽ lùi về rule-based).
def build_llm_client() -> LlmClient:
    provider = settings.llm_provider.strip().lower()
    if provider in _OPENAI_COMPATIBLE:
        return OpenAICompatibleLlmClient(settings)

    raise LlmClientError(f"Unsupported LLM provider: {settings.llm_provider}")


# Đã cấu hình embedding chưa (EMBEDDING_PROVIDER khác "mock").
def embeddings_configured() -> bool:
    return settings.embedding_provider.strip().lower() in _OPENAI_COMPATIBLE


# Client embedding theo EMBEDDING_PROVIDER.
def build_embedding_client() -> EmbeddingClient:
    provider = settings.embedding_provider.strip().lower()
    if provider in _OPENAI_COMPATIBLE:
        return OpenAICompatibleEmbeddingClient(settings)

    raise EmbeddingClientError(
        f"Unsupported embedding provider: {settings.embedding_provider}"
    )
