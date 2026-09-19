import unittest
from unittest.mock import patch

from app.core.config import Settings
from app.llm.base import LlmClientError
from app.llm.openai_compatible import OpenAICompatibleLlmClient, RetryableLlmError


class ScriptedClient(OpenAICompatibleLlmClient):
    """Replays a list of outcomes instead of calling the provider."""

    def __init__(self, outcomes, retries=2):
        settings = Settings()
        object.__setattr__(settings, "llm_max_retries", retries)
        super().__init__(settings)
        self.outcomes = list(outcomes)
        self.calls = 0

    def _request(self, messages):
        self.calls += 1
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


@patch("app.llm.openai_compatible.time.sleep", lambda seconds: None)
class OpenAICompatibleRetryTest(unittest.TestCase):
    def test_retries_transient_errors_then_succeeds(self):
        client = ScriptedClient([RetryableLlmError("503"), RetryableLlmError("429"), '{"ok": true}'])

        self.assertEqual(client.complete_json([]), '{"ok": true}')
        self.assertEqual(client.calls, 3)

    def test_gives_up_after_the_configured_retries(self):
        client = ScriptedClient([RetryableLlmError("503")] * 3, retries=2)

        with self.assertRaises(RetryableLlmError):
            client.complete_json([])
        self.assertEqual(client.calls, 3)

    def test_does_not_retry_permanent_errors(self):
        # A bad key or unknown model fails the same way every time.
        client = ScriptedClient([LlmClientError("LLM provider returned 400"), '{"ok": true}'])

        with self.assertRaises(LlmClientError):
            client.complete_json([])
        self.assertEqual(client.calls, 1)

    def test_retry_after_header_is_parsed(self):
        self.assertEqual(OpenAICompatibleLlmClient._retry_after("2"), 2.0)
        self.assertIsNone(OpenAICompatibleLlmClient._retry_after("soon"))
        self.assertIsNone(OpenAICompatibleLlmClient._retry_after(None))


if __name__ == "__main__":
    unittest.main()
