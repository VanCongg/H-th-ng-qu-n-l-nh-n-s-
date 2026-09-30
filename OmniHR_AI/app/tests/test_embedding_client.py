import unittest
from dataclasses import replace
from unittest import mock

import httpx

from app.core.config import settings
from app.llm.openai_compatible_embeddings import OpenAICompatibleEmbeddingClient


def client_answering(payload: dict) -> tuple[OpenAICompatibleEmbeddingClient, httpx.MockTransport]:
    config = replace(settings, embedding_model="stub", llm_base_url="https://example.test/v1", llm_max_retries=0)
    return OpenAICompatibleEmbeddingClient(config), httpx.MockTransport(
        lambda request: httpx.Response(200, json=payload)
    )


class OpenAICompatibleEmbeddingClientTest(unittest.TestCase):
    def embed_with(self, payload: dict, texts: list[str]):
        client, transport = client_answering(payload)
        real_client = httpx.Client
        with mock.patch("httpx.Client", lambda **kwargs: real_client(transport=transport, **kwargs)):
            return client.embed(texts)

    def test_accepts_a_first_row_without_index(self):
        # What Gemini's OpenAI-compatible endpoint actually returns: index 0 is omitted.
        vectors = self.embed_with(
            {"data": [{"embedding": [1.0, 0.0]}, {"index": 1, "embedding": [0.0, 1.0]}]},
            ["a", "b"],
        )

        self.assertEqual(vectors, [[1.0, 0.0], [0.0, 1.0]])

    def test_orders_rows_by_index(self):
        vectors = self.embed_with(
            {"data": [{"index": 1, "embedding": [0.0, 1.0]}, {"index": 0, "embedding": [1.0, 0.0]}]},
            ["a", "b"],
        )

        self.assertEqual(vectors, [[1.0, 0.0], [0.0, 1.0]])


if __name__ == "__main__":
    unittest.main()
