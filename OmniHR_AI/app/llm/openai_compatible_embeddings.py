import time
from typing import Any

from app.core.config import Settings
from app.llm.base import EmbeddingClientError


class OpenAICompatibleEmbeddingClient:
    """Calls the /embeddings endpoint of any OpenAI-compatible provider.

    Mirrors OpenAICompatibleLlmClient: same base URL, same credentials, same
    retry shape - only the endpoint and payload differ.
    """

    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_url = (
            settings.embedding_base_url or settings.llm_base_url or "https://api.openai.com/v1"
        ).rstrip("/")

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        last_error: Exception | None = None
        attempts = max(1, self.settings.llm_max_retries + 1)

        for attempt in range(attempts):
            try:
                return self._request(texts)
            except Exception as error:
                last_error = error
                if attempt + 1 < attempts:
                    time.sleep(0.25 * (attempt + 1))

        raise EmbeddingClientError(str(last_error or "Embedding request failed"))

    def _request(self, texts: list[str]) -> list[list[float]]:
        import httpx

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        api_key = self.settings.embedding_api_key or self.settings.llm_api_key
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload: dict[str, Any] = {
            "model": self.settings.embedding_model,
            "input": texts,
        }

        with httpx.Client(timeout=self.settings.llm_timeout_seconds) as client:
            response = client.post(
                f"{self.base_url}/embeddings",
                headers=headers,
                json=payload,
            )

        if response.status_code >= 400:
            raise EmbeddingClientError(f"Embedding provider returned {response.status_code}")

        data = response.json()
        try:
            rows = sorted(data["data"], key=lambda row: row["index"])
            vectors = [row["embedding"] for row in rows]
        except (KeyError, IndexError, TypeError) as error:
            raise EmbeddingClientError(
                "Embedding provider returned an invalid response"
            ) from error

        if len(vectors) != len(texts):
            raise EmbeddingClientError(
                f"Embedding provider returned {len(vectors)} vectors for {len(texts)} inputs"
            )

        return vectors
