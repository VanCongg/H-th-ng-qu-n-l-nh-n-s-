import hashlib
import json
import math
from pathlib import Path

from app.llm.base import EmbeddingClient

CACHE_PATH = Path(__file__).resolve().parent.parent / "rag" / ".embedding_cache.json"


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0

    dot = 0.0
    left_norm = 0.0
    right_norm = 0.0
    for a, b in zip(left, right):
        dot += a * b
        left_norm += a * a
        right_norm += b * b

    if left_norm <= 0 or right_norm <= 0:
        return 0.0

    return dot / math.sqrt(left_norm * right_norm)


class EmbeddingIndex:
    """Exact nearest-neighbour search over the policy chunks.

    Deliberately not a vector database: an ANN index (HNSW, IVF) trades recall
    for speed once you have millions of vectors, and this corpus is a few dozen
    chunks. A full cosine scan is both exact and, at this size, faster than the
    round trip a separate vector store would add.

    Chunk vectors are cached on disk keyed by (model, text), so restarting the
    service does not re-pay for embeddings, and editing one policy document only
    re-embeds the chunks that actually changed.
    """

    def __init__(
        self,
        client: EmbeddingClient,
        model: str,
        cache_path: Path | None = None,
    ):
        self._client = client
        self._model = model
        self._cache_path = cache_path or CACHE_PATH
        self._cache = self._load_cache()
        self._vectors: dict[str, list[float]] = {}

    def build(self, chunks: list[tuple[str, str]]) -> None:
        """chunks: (chunk_id, text). Embeds only what the cache is missing."""
        missing = [
            (chunk_id, text)
            for chunk_id, text in chunks
            if self._cache_key(text) not in self._cache
        ]

        if missing:
            vectors = self._client.embed([text for _, text in missing])
            for (_, text), vector in zip(missing, vectors):
                self._cache[self._cache_key(text)] = vector
            self._save_cache()

        self._vectors = {
            chunk_id: self._cache[self._cache_key(text)]
            for chunk_id, text in chunks
            if self._cache_key(text) in self._cache
        }

    def search(self, query: str) -> dict[str, float]:
        """Returns {chunk_id: cosine similarity} for every indexed chunk."""
        if not self._vectors:
            return {}

        query_vector = self._client.embed([query])[0]
        return {
            chunk_id: cosine_similarity(query_vector, vector)
            for chunk_id, vector in self._vectors.items()
        }

    @property
    def size(self) -> int:
        return len(self._vectors)

    def _cache_key(self, text: str) -> str:
        digest = hashlib.sha256(f"{self._model}\n{text}".encode("utf-8")).hexdigest()
        return digest

    def _load_cache(self) -> dict[str, list[float]]:
        if not self._cache_path.exists():
            return {}
        try:
            return json.loads(self._cache_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            # A corrupt cache is not worth failing a request over - re-embed.
            return {}

    def _save_cache(self) -> None:
        try:
            self._cache_path.parent.mkdir(parents=True, exist_ok=True)
            self._cache_path.write_text(
                json.dumps(self._cache), encoding="utf-8"
            )
        except OSError:
            # Losing the cache only costs money on the next boot, not correctness.
            pass
