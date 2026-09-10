import logging
import math
import re
from dataclasses import dataclass
from pathlib import Path

from app.core.config import settings
from app.llm.factory import build_embedding_client, embeddings_configured
from app.schemas.rag import RagSearchItem, RagSearchRequest, RagSearchResponse
from app.services.embedding_index import EmbeddingIndex
from app.services.text_normalize import normalize

logger = logging.getLogger(__name__)

DOCUMENTS_DIR = Path(__file__).resolve().parent.parent / "rag" / "documents"

MIN_SCORE = 0.45
MIN_OVERLAP = 2

_STOPWORDS = {
    "la", "va", "cua", "cho", "khi", "gi", "the", "nao", "co", "khong",
    "toi", "ban", "duoc", "de", "nhu", "voi", "trong", "mot", "cac", "nay",
    "hay", "hoac", "neu", "thi", "ve", "tai", "sao", "lam", "nhung", "da",
    "se", "bi", "ra", "vao", "tu", "sau", "truoc", "day",
    # Generic quantifier/time words: meaningful in isolation but not
    # distinctive enough across a small, all-HR-topic corpus to drive a
    # match by themselves (e.g. "nhieu" alone matched an unrelated salary
    # question to an attendance chunk purely by coincidence).
    "nhieu", "thang", "tien", "nam", "ngay", "lan", "bao",
}


@dataclass
class _Chunk:
    document_id: str
    chunk_id: str
    title: str
    content: str
    tokens: set[str]


class RagService:
    """Retrieval over the seed policy docs, keyword and/or embedding based.

    Keyword scoring (IDF-weighted overlap + bigrams) is always available and
    needs no network, so the service still answers with no provider configured.
    When an embedding provider is set, cosine similarity over the chunk vectors
    runs alongside it and the two scores are blended - keyword alone cannot
    match a question that shares no words with the policy that answers it.

    Search is an exact scan, not a vector database: see EmbeddingIndex.
    """

    def __init__(
        self,
        documents_dir: Path | None = None,
        embedding_index: "EmbeddingIndex | None" = None,
        mode: str | None = None,
        embedding_weight: float | None = None,
        min_embedding_score: float | None = None,
        min_embedding_gap: float | None = None,
    ):
        self._chunks = self._load_chunks(documents_dir or DOCUMENTS_DIR)
        self._idf = self._build_idf(self._chunks)
        # A word absent from every document is, if anything, rarer than any
        # word that appears at least once - score it as maximally
        # distinguishing, not as weightless (see _score for why 0 is wrong).
        self._max_idf = max(self._idf.values(), default=1.0)

        self._mode = (mode or settings.rag_mode).strip().lower()
        self._embedding_weight = (
            settings.rag_embedding_weight if embedding_weight is None else embedding_weight
        )
        self._min_embedding_score = (
            settings.rag_min_embedding_score
            if min_embedding_score is None
            else min_embedding_score
        )
        self._min_embedding_gap = (
            settings.rag_min_embedding_gap if min_embedding_gap is None else min_embedding_gap
        )
        self._embedding_index = embedding_index
        if self._embedding_index is None and self._mode in {"embedding", "hybrid"}:
            self._embedding_index = self._build_embedding_index()

    def _build_embedding_index(self) -> "EmbeddingIndex | None":
        if not embeddings_configured():
            return None
        try:
            index = EmbeddingIndex(build_embedding_client(), settings.embedding_model)
            index.build(
                [(chunk.chunk_id, f"{chunk.title}\n{chunk.content}") for chunk in self._chunks]
            )
            return index
        except Exception:
            # A provider outage must not take policy answers down entirely -
            # keyword retrieval still works.
            logger.warning("Embedding index unavailable, falling back to keyword retrieval")
            return None

    @property
    def active_mode(self) -> str:
        """The mode actually in effect, after any fallback."""
        if self._mode in {"embedding", "hybrid"} and self._embedding_index is None:
            return "keyword"
        return self._mode

    def search(self, request: RagSearchRequest) -> RagSearchResponse:
        query_tokens = self._tokenize(request.query)
        if not query_tokens:
            return RagSearchResponse(items=[])

        similarities = self._embedding_similarities(request.query)
        leader = self._leading_similarity(similarities)

        scored = []
        for chunk in self._chunks:
            overlap = query_tokens & chunk.tokens
            keyword_score = (
                self._score(query_tokens, overlap, chunk)
                if len(overlap) >= MIN_OVERLAP
                else 0.0
            )
            similarity = similarities.get(chunk.chunk_id, 0.0)

            if self._keeps(keyword_score, similarity, leader):
                scored.append((self._blend(keyword_score, similarity), chunk))

        scored.sort(key=lambda pair: pair[0], reverse=True)

        items = [
            RagSearchItem(
                documentId=chunk.document_id,
                chunkId=chunk.chunk_id,
                title=chunk.title,
                content=chunk.content,
                score=round(score, 3),
            )
            for score, chunk in scored[: request.topK]
        ]
        return RagSearchResponse(items=items)

    def _embedding_similarities(self, query: str) -> dict[str, float]:
        if self._embedding_index is None or self._mode == "keyword":
            return {}
        try:
            return self._embedding_index.search(query)
        except Exception:
            logger.warning("Embedding search failed, using keyword scores only")
            return {}

    def _leading_similarity(self, similarities: dict[str, float]) -> tuple[float, float]:
        """Returns (best, runner_up) similarity across the corpus."""
        if not similarities:
            return (0.0, 0.0)
        ranked = sorted(similarities.values(), reverse=True)
        return (ranked[0], ranked[1] if len(ranked) > 1 else 0.0)

    def _keeps(
        self, keyword_score: float, similarity: float, leader: tuple[float, float]
    ) -> bool:
        """A chunk survives if either signal is confident enough on its own.

        Keeping the thresholds separate is what lets embeddings rescue a
        question worded nothing like the policy, while keyword keeps answering
        exact-wording questions when embeddings are unavailable.
        """
        if self._mode == "embedding":
            return self._embedding_confident(similarity, leader)
        if keyword_score >= MIN_SCORE:
            return True
        return self._embedding_confident(similarity, leader)

    def _embedding_confident(self, similarity: float, leader: tuple[float, float]) -> bool:
        """An absolute cosine floor alone cannot admit a chunk.

        Embedding models place any two same-language texts fairly close
        together, so a floor tuned against one model turns into false positives
        on another. What actually separates "found the answer" from "found
        nothing" is the shape of the distribution: a real hit leaves the rest of
        the corpus far behind, while an off-topic question scores every chunk
        about the same. So the retrieval must first have a clear winner, and
        only chunks in that leading cluster are admitted.
        """
        best, runner_up = leader
        if best - runner_up < self._min_embedding_gap:
            return False
        return (
            similarity >= self._min_embedding_score
            and best - similarity < self._min_embedding_gap
        )

    def _blend(self, keyword_score: float, similarity: float) -> float:
        if self._mode == "embedding":
            return similarity
        if not self._embedding_index or self._mode == "keyword":
            return keyword_score
        weight = self._embedding_weight
        return keyword_score * (1 - weight) + similarity * weight

    def _score(self, query_tokens: set[str], overlap: set[str], chunk: _Chunk) -> float:
        # IDF-weighted overlap ratio: a word shared by nearly every chunk
        # (e.g. "quan ly", "nhan vien") has low weight, so a coincidental
        # match on common vocabulary alone can't dominate the score - the
        # match has to be on words that actually distinguish this chunk's
        # topic from the rest of the corpus.
        query_weight = sum(
            self._idf.get(token, self._max_idf) for token in query_tokens
        )
        if query_weight <= 0:
            return 0.0
        overlap_weight = sum(self._idf.get(token, 0.0) for token in overlap)
        score = overlap_weight / query_weight
        title_tokens = self._tokenize(chunk.title)
        if query_tokens & title_tokens:
            score = min(score + 0.1, 1.0)
        return score

    def _build_idf(self, chunks: list[_Chunk]) -> dict[str, float]:
        chunk_count = len(chunks) or 1
        document_frequency: dict[str, int] = {}
        for chunk in chunks:
            for token in chunk.tokens:
                document_frequency[token] = document_frequency.get(token, 0) + 1
        return {
            token: math.log(1 + chunk_count / df)
            for token, df in document_frequency.items()
        }

    def _tokenize(self, text: str) -> set[str]:
        words = re.findall(r"[a-z0-9]+", normalize(text))
        unigrams = {
            word for word in words if len(word) > 1 and word not in _STOPWORDS
        }
        # Bigrams from the raw (pre-stopword-filter) sequence: Vietnamese
        # compound words often accent-collide once stripped to single
        # syllables (e.g. "xa" from both "từ xa"/remote and "xã hội"/social
        # insurance) - the adjacent-pair signal disambiguates them without
        # needing embeddings. Built from raw words (not unigrams) so a
        # stopword half like "tu" in "tu xa" doesn't disappear first.
        bigrams = {
            f"{a}_{b}"
            for a, b in zip(words, words[1:])
            if len(a) > 1 and len(b) > 1
        }
        return unigrams | bigrams

    def _load_chunks(self, documents_dir: Path) -> list[_Chunk]:
        chunks: list[_Chunk] = []
        if not documents_dir.exists():
            return chunks

        for path in sorted(documents_dir.glob("*.md")):
            document_id = path.stem
            text = path.read_text(encoding="utf-8")
            for title, content in self._split_sections(text):
                chunks.append(
                    _Chunk(
                        document_id=document_id,
                        chunk_id=f"{document_id}#{self._slug(title)}",
                        title=title,
                        content=content,
                        tokens=self._tokenize(f"{title} {content}"),
                    )
                )
        return chunks

    def _split_sections(self, text: str) -> list[tuple[str, str]]:
        sections: list[tuple[str, str]] = []
        current_title: str | None = None
        current_lines: list[str] = []

        for line in text.splitlines():
            heading = re.match(r"^##\s+(.+)$", line.strip())
            if heading:
                if current_title is not None:
                    sections.append((current_title, "\n".join(current_lines).strip()))
                current_title = heading.group(1).strip()
                current_lines = []
            elif current_title is not None:
                current_lines.append(line)

        if current_title is not None:
            sections.append((current_title, "\n".join(current_lines).strip()))

        return [(title, content) for title, content in sections if content]

    def _slug(self, title: str) -> str:
        return re.sub(r"[^a-z0-9]+", "-", normalize(title)).strip("-")
