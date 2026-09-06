import math
import re
from dataclasses import dataclass
from pathlib import Path

from app.schemas.rag import RagSearchItem, RagSearchRequest, RagSearchResponse
from app.services.text_normalize import normalize

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
    """Dependency-free keyword-overlap retrieval over the seed policy docs.

    No embeddings/vector DB: matches this service's existing rule-based
    philosophy, and keeps every match explainable by word overlap.
    """

    def __init__(self, documents_dir: Path | None = None):
        self._chunks = self._load_chunks(documents_dir or DOCUMENTS_DIR)
        self._idf = self._build_idf(self._chunks)
        # A word absent from every document is, if anything, rarer than any
        # word that appears at least once - score it as maximally
        # distinguishing, not as weightless (see _score for why 0 is wrong).
        self._max_idf = max(self._idf.values(), default=1.0)

    def search(self, request: RagSearchRequest) -> RagSearchResponse:
        query_tokens = self._tokenize(request.query)
        if not query_tokens:
            return RagSearchResponse(items=[])

        scored = []
        for chunk in self._chunks:
            overlap = query_tokens & chunk.tokens
            if len(overlap) < MIN_OVERLAP:
                continue
            score = self._score(query_tokens, overlap, chunk)
            if score >= MIN_SCORE:
                scored.append((score, chunk))
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
