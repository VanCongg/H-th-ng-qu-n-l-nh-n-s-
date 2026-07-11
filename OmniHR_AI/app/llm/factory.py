from app.core.config import settings
from app.llm.base import LlmClient, LlmClientError
from app.llm.openai_compatible import OpenAICompatibleLlmClient


def current_provider() -> str:
    return settings.llm_provider


def build_llm_client() -> LlmClient:
    provider = settings.llm_provider.strip().lower()
    if provider in {"openai", "openai_compatible", "generic"}:
        return OpenAICompatibleLlmClient(settings)

    raise LlmClientError(f"Unsupported LLM provider: {settings.llm_provider}")
