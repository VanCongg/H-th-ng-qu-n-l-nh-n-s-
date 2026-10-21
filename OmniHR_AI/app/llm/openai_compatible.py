# Client LLM cho mọi API kiểu OpenAI (POST /chat/completions, yêu cầu trả JSON).
# Có thử lại khi gặp lỗi tạm thời (quá tải, giới hạn tốc độ) và một tổng thời gian tối đa cho mọi lần thử,
# để còn thời gian cho planner rule-based trả lời nếu LLM chậm.

import time
from typing import Any

from app.core.config import Settings
from app.llm.base import LlmClientError

# Worth another try: rate limits, overload and gateway hiccups. Anything else
# (bad key, unknown model, bad request) fails the same way every time.
RETRYABLE_STATUS = {408, 409, 429, 500, 502, 503, 504}
BACKOFF_BASE_SECONDS = 0.5
BACKOFF_CAP_SECONDS = 4.0
# Not worth starting an attempt with less time than this left in the budget.
MIN_ATTEMPT_SECONDS = 2.0


# Lỗi tạm thời, đáng thử lại (429, 5xx, timeout).
class RetryableLlmError(LlmClientError):
    """A transient failure; complete_json retries these with backoff."""

    def __init__(self, message: str, retry_after: float | None = None):
        super().__init__(message)
        self.retry_after = retry_after


class OpenAICompatibleLlmClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_url = (settings.llm_base_url or "https://api.openai.com/v1").rstrip("/")

    # Gọi LLM, thử lại có giãn cách khi lỗi tạm thời, dừng khi hết tổng thời gian cho phép.
    def complete_json(self, messages: list[dict[str, str]]) -> str:
        attempts = max(1, self.settings.llm_max_retries + 1)
        # One budget for every attempt: a slow provider must not use up the
        # time the caller waits, or the rule-based fallback never gets to answer.
        deadline = time.monotonic() + self.settings.llm_total_budget_seconds

        for attempt in range(attempts):
            remaining = deadline - time.monotonic()
            if remaining < MIN_ATTEMPT_SECONDS:
                raise LlmClientError("LLM time budget used up")
            try:
                return self._request(messages, timeout=min(self.settings.llm_timeout_seconds, remaining))
            except RetryableLlmError as error:
                if attempt + 1 >= attempts:
                    raise
                delay = error.retry_after
                if delay is None:
                    delay = BACKOFF_BASE_SECONDS * (2**attempt)
                delay = min(delay, BACKOFF_CAP_SECONDS)
                if time.monotonic() + delay + MIN_ATTEMPT_SECONDS > deadline:
                    raise
                time.sleep(delay)

        raise LlmClientError("LLM request failed")

    # Một lần gọi HTTP tới /chat/completions.
    def _request(self, messages: list[dict[str, str]], timeout: float | None = None) -> str:
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
            with httpx.Client(timeout=timeout or self.settings.llm_timeout_seconds) as client:
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
