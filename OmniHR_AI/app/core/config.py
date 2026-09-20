import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# The Settings field defaults below are evaluated when this module is first
# imported, so the .env file has to reach os.environ before that happens.
# override=False keeps real environment variables authoritative, which is what
# docker compose relies on.
load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)


def _bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _float_env(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    internal_token: str = os.getenv("AI_INTERNAL_TOKEN", "")
    ai_planner_mode: str = os.getenv("AI_PLANNER_MODE", "rule_based")
    llm_provider: str = os.getenv("LLM_PROVIDER", "mock")
    llm_model: str = os.getenv("LLM_MODEL", "rule-based-vi-v1")
    llm_api_key: str = os.getenv("LLM_API_KEY", "")
    llm_base_url: str = os.getenv("LLM_BASE_URL", "")
    llm_timeout_seconds: int = _int_env("LLM_TIMEOUT_SECONDS", 20)
    llm_max_retries: int = _int_env("LLM_MAX_RETRIES", 2)
    llm_temperature: float = _float_env("LLM_TEMPERATURE", 0.0)
    llm_max_output_tokens: int = _int_env("LLM_MAX_OUTPUT_TOKENS", 800)
    llm_fallback_to_rule_based: bool = _bool_env("LLM_FALLBACK_TO_RULE_BASED", True)
    llm_confidence_threshold: float = _float_env("LLM_CONFIDENCE_THRESHOLD", 0.6)
    embedding_provider: str = os.getenv("EMBEDDING_PROVIDER", "mock")
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "none")
    # Falls back to the LLM credentials when unset, since most providers serve
    # both from the same base URL and key.
    embedding_base_url: str = os.getenv("EMBEDDING_BASE_URL", "")
    embedding_api_key: str = os.getenv("EMBEDDING_API_KEY", "")
    # keyword | embedding | hybrid. Hybrid degrades to keyword when no
    # embedding provider is configured, so the service still answers offline.
    rag_mode: str = os.getenv("RAG_MODE", "hybrid")
    rag_embedding_weight: float = _float_env("RAG_EMBEDDING_WEIGHT", 0.6)
    rag_min_embedding_score: float = _float_env("RAG_MIN_EMBEDDING_SCORE", 0.55)
    # How far the best match must sit above the runner-up before an embedding
    # score alone can admit a chunk. An off-topic question scores every chunk
    # about the same, so a flat distribution means "no answer here".
    rag_min_embedding_gap: float = _float_env("RAG_MIN_EMBEDDING_GAP", 0.10)


settings = Settings()
