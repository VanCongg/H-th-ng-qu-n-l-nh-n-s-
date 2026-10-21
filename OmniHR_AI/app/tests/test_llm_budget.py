import time
import unittest
from dataclasses import replace
from unittest import mock

from app.core.config import settings
from app.llm.base import LlmClientError
from app.llm.openai_compatible import OpenAICompatibleLlmClient, RetryableLlmError


class LlmTimeBudgetTest(unittest.TestCase):
    """Retries stop when the time budget is gone, so the fallback can still answer."""

    def client(self, **overrides):
        return OpenAICompatibleLlmClient(replace(settings, **overrides))

    def test_each_attempt_gets_at_most_what_is_left(self):
        client = self.client(llm_timeout_seconds=20, llm_max_retries=0, llm_total_budget_seconds=6)
        with mock.patch.object(client, "_request", return_value="{}") as request:
            client.complete_json([])
        self.assertLessEqual(request.call_args.kwargs["timeout"], 6)

    def test_no_retry_once_the_budget_is_spent(self):
        client = self.client(llm_timeout_seconds=20, llm_max_retries=2, llm_total_budget_seconds=3)
        calls = []

        def slow_failure(messages, timeout=None):
            calls.append(timeout)
            time.sleep(1.2)
            raise RetryableLlmError("timeout")

        with mock.patch.object(client, "_request", side_effect=slow_failure):
            with self.assertRaises(LlmClientError):
                client.complete_json([])
        # Three attempts were allowed, but the budget only had room for one.
        self.assertEqual(len(calls), 1)


if __name__ == "__main__":
    unittest.main()
