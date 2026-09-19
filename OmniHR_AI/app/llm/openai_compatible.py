import time
from typing import Any

from app.core.config import Settings
from app.llm.base import LlmClientError

# Worth another try: rate limits, overload and gateway hiccups. Anything else
# (bad key, unknown model, bad request) fails the same way every time.
RETRYABLE_STATUS = {408, 409, 429, 500, 502, 503, 504}
BACKOFF_BASE_SECONDS = 0.5
BACKOFF_CAP_SECONDS = 4.0


class RetryableLlmError(LlmClientError):
    """A transient failure; complete_json retries these with backoff."""

    def __init__(self, message: str, retry_after: float | None = None):
        super().__init__(message)
        self.retry_after = retry_after


class OpenAICompatibleLlmClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_url = (settings.llm_base_url or "https://api.openai.com/v1").rstrip("/")

    def complete_json(self, messages: list[dict[str, str]]) -> str:
        attempts = max(1, self.settings.llm_max_retries + 1)

        for attempt in range(attempts):
            try:
                return self._request(messages)
            except RetryableLlmError as error:
                if attempt + 1 >= attempts:
                    raise
                delay = error.retry_after
                if delay is None:
                    delay = BACKOFF_BASE_SECONDS * (2**attempt)
                time.sleep(min(delay, BACKOFF_CAP_SECONDS))

        raise LlmClientError("LLM request failed")

    def _request(self, messages: list[dict[str, str]]) -> str:
        import httpx

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if self.settings.llm_api_key:
            headers["Authorization"] = f"Bearer {self.settings.llm_api_key}"

        payload: dict[str, Any] = {
            "model": self.settings.llm_model,
            "messages": messages,
            "temperature": self.settings.llm_temperature,
            "max_tokens": self.settings.llm_max_output_tokens,
            "response_format": {"type": "json_object"},
        }

        try:
            with httpx.Client(timeout=self.settings.llm_timeout_seconds) as client:
                response = client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
        except (httpx.TimeoutException, httpx.TransportError) as error:
            raise RetryableLlmError(f"LLM request failed: {type(error).__name__}") from error

        if response.status_code in RETRYABLE_STATUS:
            raise RetryableLlmError(
                f"LLM provider returned {response.status_code}",
                retry_after=self._retry_after(response.headers.get("retry-after")),
            )
        if response.status_code >= 400:
            raise LlmClientError(f"LLM provider returned {response.status_code}")

        data = response.json()
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as error:
            raise LlmClientError("LLM provider returned an invalid response") from error

        if not isinstance(content, str) or not content.strip():
            raise LlmClientError("LLM provider returned an empty response")

        return content.strip()

    @staticmethod
    def _retry_after(value: str | None) -> float | None:
        try:
            return float(value) if value is not None else None
        except ValueError:
            return None
