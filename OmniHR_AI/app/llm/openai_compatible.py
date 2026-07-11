import time
from typing import Any

from app.core.config import Settings
from app.llm.base import LlmClientError


class OpenAICompatibleLlmClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_url = (settings.llm_base_url or "https://api.openai.com/v1").rstrip("/")

    def complete_json(self, messages: list[dict[str, str]]) -> str:
        last_error: Exception | None = None
        attempts = max(1, self.settings.llm_max_retries + 1)

        for attempt in range(attempts):
            try:
                return self._request(messages)
            except Exception as error:
                last_error = error
                if attempt + 1 < attempts:
                    time.sleep(0.25 * (attempt + 1))

        raise LlmClientError(str(last_error or "LLM request failed"))

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

        with httpx.Client(timeout=self.settings.llm_timeout_seconds) as client:
            response = client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
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
