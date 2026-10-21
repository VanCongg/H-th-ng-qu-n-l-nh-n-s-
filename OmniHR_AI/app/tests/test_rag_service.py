import unittest

from app.schemas.rag import RagSearchRequest
from app.services.rag_service import RagService


class RagServiceTest(unittest.TestCase):
    def setUp(self):
        self.service = RagService()

    def test_loads_multiple_chunks_from_all_seed_documents(self):
        # Every seed doc has several ## sections; a broad query across all
        # topics should be able to surface chunks from more than one file.
        document_ids = set()
        for query in [
            "nghi phep nam co duoc cong don khong",
            "lam viec tu xa can dang ky the nao",
            "cong ty co bao hiem gi",
            "quy tac ung xu voi dong nghiep the nao",
        ]:
            result = self.service.search(RagSearchRequest(query=query, topK=1))
            self.assertTrue(result.items, msg=f"no match for: {query}")
            document_ids.add(result.items[0].documentId)

        self.assertEqual(
            document_ids,
            {"nghi_phep", "cham_cong_lam_viec", "phuc_loi", "quy_tac_ung_xu"},
        )

    def test_closely_matching_query_ranks_expected_chunk_first(self):
        result = self.service.search(
            RagSearchRequest(query="nghi phep nam co duoc cong don sang nam sau khong", topK=3)
        )
        self.assertTrue(result.items)
        top = result.items[0]
        self.assertEqual(top.documentId, "nghi_phep")
        self.assertIn("cộng dồn", top.title.lower())
        self.assertGreater(top.score, 0.5)

    def test_unrelated_query_does_not_match_policy_chunks(self):
        # This phrasing is deliberately close to the existing rule-based
        # attendance-today intent, not a policy question - RAG must stay
        # quiet so the existing structured intent keeps working untouched.
        result = self.service.search(
            RagSearchRequest(query="cham cong hom nay cua toi the nao", topK=3)
        )
        self.assertEqual(result.items, [])

    def test_empty_query_returns_no_items(self):
        result = self.service.search(RagSearchRequest(query="   ", topK=3))
        self.assertEqual(result.items, [])

    def test_topk_limits_result_count(self):
        result = self.service.search(
            RagSearchRequest(query="nghi phep don xin nghi quan ly", topK=1)
        )
        self.assertLessEqual(len(result.items), 1)


if __name__ == "__main__":
    unittest.main()
