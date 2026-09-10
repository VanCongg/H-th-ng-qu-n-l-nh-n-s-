import unittest

from app.schemas.rag import RagSearchRequest
from app.services.embedding_index import EmbeddingIndex, cosine_similarity
from app.services.rag_service import RagService


class StubEmbeddingClient:
    """Maps text onto a small hand-built topic space.

    Real embeddings are not available in tests (and calling a provider would
    make the suite slow, flaky and billable), so topics stand in for semantic
    proximity: two texts about the same topic get the same axis, which is
    exactly the property the retrieval logic depends on.
    """

    TOPICS = ["remote_work", "insurance", "annual_leave", "conduct"]

    KEYWORDS = {
        "remote_work": ["tu xa", "remote", "wfh", "tai nha", "lam viec tu xa"],
        "insurance": ["bao hiem", "om", "benh", "y te", "suc khoe", "kham"],
        "annual_leave": ["nghi phep", "phep nam", "cong don", "ngay phep"],
        "conduct": ["ung xu", "vi pham", "ky luat", "bao mat"],
    }

    def __init__(self):
        self.calls = 0

    def embed(self, texts: list[str]) -> list[list[float]]:
        self.calls += 1
        return [self._vector(text) for text in texts]

    NOISE_DIMS = 8

    def _vector(self, text: str) -> list[float]:
        import hashlib
        import re

        from app.services.text_normalize import normalize

        normalized = normalize(text)

        topic_part = [0.0] * len(self.TOPICS)
        for index, topic in enumerate(self.TOPICS):
            for keyword in self.KEYWORDS[topic]:
                # Whole-word match: a substring test would make "om" (sick)
                # fire on "hom nay" (today).
                if re.search(rf"(?<![a-z0-9]){re.escape(keyword)}(?![a-z0-9])", normalized):
                    topic_part[index] += 3.0

        # Every text also gets its own small, deterministic direction. Real
        # embedding models never map two different texts onto the identical
        # vector, and without this the stub would report unrelated documents as
        # perfectly similar just because neither mentions a known topic.
        digest = hashlib.sha256(normalized.encode("utf-8")).digest()
        noise_part = [digest[i] / 255.0 for i in range(self.NOISE_DIMS)]

        return topic_part + noise_part


class CosineSimilarityTest(unittest.TestCase):
    def test_identical_vectors_score_one(self):
        self.assertAlmostEqual(cosine_similarity([1.0, 2.0], [1.0, 2.0]), 1.0)

    def test_orthogonal_vectors_score_zero(self):
        self.assertAlmostEqual(cosine_similarity([1.0, 0.0], [0.0, 1.0]), 0.0)

    def test_magnitude_does_not_matter(self):
        self.assertAlmostEqual(cosine_similarity([1.0, 1.0], [5.0, 5.0]), 1.0)

    def test_mismatched_or_empty_vectors_score_zero(self):
        self.assertEqual(cosine_similarity([], [1.0]), 0.0)
        self.assertEqual(cosine_similarity([1.0, 2.0], [1.0]), 0.0)
        self.assertEqual(cosine_similarity([0.0, 0.0], [1.0, 1.0]), 0.0)


class EmbeddingIndexTest(unittest.TestCase):
    def setUp(self):
        self.client = StubEmbeddingClient()
        # tmp cache path so tests never touch the real cache file
        import tempfile
        from pathlib import Path

        self.cache_path = Path(tempfile.mkdtemp()) / "cache.json"
        self.index = EmbeddingIndex(self.client, "stub-model", self.cache_path)

    def test_builds_a_vector_per_chunk(self):
        self.index.build([("a", "lam viec tu xa"), ("b", "bao hiem y te")])

        self.assertEqual(self.index.size, 2)

    def test_reuses_the_cache_instead_of_re_embedding(self):
        chunks = [("a", "lam viec tu xa"), ("b", "bao hiem y te")]
        self.index.build(chunks)
        calls_after_first_build = self.client.calls

        # A second index over the same texts should hit the cache on disk.
        second = EmbeddingIndex(self.client, "stub-model", self.cache_path)
        second.build(chunks)

        self.assertEqual(self.client.calls, calls_after_first_build)
        self.assertEqual(second.size, 2)

    def test_only_embeds_chunks_missing_from_the_cache(self):
        self.index.build([("a", "lam viec tu xa")])
        self.client.calls = 0

        second = EmbeddingIndex(self.client, "stub-model", self.cache_path)
        second.build([("a", "lam viec tu xa"), ("b", "bao hiem y te")])

        # One batch call, and it must not include the already-cached chunk.
        self.assertEqual(self.client.calls, 1)

    def test_a_different_model_invalidates_the_cache(self):
        self.index.build([("a", "lam viec tu xa")])
        self.client.calls = 0

        other_model = EmbeddingIndex(self.client, "another-model", self.cache_path)
        other_model.build([("a", "lam viec tu xa")])

        self.assertEqual(self.client.calls, 1)

    def test_search_returns_a_similarity_per_chunk(self):
        self.index.build([("a", "lam viec tu xa"), ("b", "bao hiem y te")])

        scores = self.index.search("wfh")

        self.assertEqual(set(scores), {"a", "b"})
        self.assertGreater(scores["a"], scores["b"])


class RagServiceEmbeddingTest(unittest.TestCase):
    def build_service(self, mode: str) -> RagService:
        import tempfile
        from pathlib import Path

        client = StubEmbeddingClient()
        index = EmbeddingIndex(client, "stub-model", Path(tempfile.mkdtemp()) / "c.json")
        service = RagService(mode="keyword")
        index.build(
            [
                (chunk.chunk_id, f"{chunk.title}\n{chunk.content}")
                for chunk in service._chunks
            ]
        )
        return RagService(mode=mode, embedding_index=index)

    def test_keyword_mode_ignores_the_index(self):
        service = self.build_service("keyword")

        self.assertEqual(service.active_mode, "keyword")

    def test_falls_back_to_keyword_when_no_provider_is_configured(self):
        # Default settings have EMBEDDING_PROVIDER=mock, i.e. not configured.
        service = RagService(mode="hybrid")

        self.assertEqual(service.active_mode, "keyword")

    def test_embeddings_answer_a_question_that_shares_no_words_with_the_policy(self):
        # "được hỗ trợ gì khi ốm đau" shares no meaningful token with the
        # "Bảo hiểm" section, so keyword retrieval cannot reach it.
        query = "duoc ho tro gi khi om dau"

        keyword_only = RagService(mode="keyword")
        keyword_hits = keyword_only.search(RagSearchRequest(query=query, topK=3))
        self.assertEqual(keyword_hits.items, [], "keyword should miss this phrasing")

        hybrid = self.build_service("hybrid")
        hybrid_hits = hybrid.search(RagSearchRequest(query=query, topK=3))

        self.assertTrue(hybrid_hits.items, "embeddings should rescue it")
        self.assertEqual(hybrid_hits.items[0].documentId, "phuc_loi")

    def test_keyword_matches_still_win_on_exact_wording(self):
        hybrid = self.build_service("hybrid")

        result = hybrid.search(
            RagSearchRequest(query="nghi phep nam co duoc cong don khong", topK=3)
        )

        self.assertTrue(result.items)
        self.assertEqual(result.items[0].documentId, "nghi_phep")

    def test_unrelated_query_still_matches_nothing(self):
        hybrid = self.build_service("hybrid")

        result = hybrid.search(RagSearchRequest(query="gia ca phe hom nay", topK=3))

        self.assertEqual(result.items, [])


if __name__ == "__main__":
    unittest.main()
