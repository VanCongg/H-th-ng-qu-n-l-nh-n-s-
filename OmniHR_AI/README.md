# OmniHR AI Service

FastAPI service for HRGenie chatbot planning.

## Run Local

```bash
cd OmniHR_AI
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

NestJS calls this service through `POST /internal/chat/plan` with
`X-Internal-Service-Token`.

The current MVP provider is rule-based so the full chatbot flow can be tested
without an external LLM API key.

## Enable Real LLM Planner

The service keeps the NestJS-facing response contract unchanged. The LLM output
is validated internally and then mapped back to `type/toolCalls/needConfirmation`.

```env
AI_PLANNER_MODE=hybrid
LLM_PROVIDER=openai_compatible
LLM_MODEL=your-model-name
LLM_API_KEY=your-api-key
LLM_BASE_URL=https://api.openai.com/v1
LLM_TIMEOUT_SECONDS=20
LLM_MAX_RETRIES=1
LLM_TEMPERATURE=0
LLM_MAX_OUTPUT_TOKENS=800
LLM_FALLBACK_TO_RULE_BASED=true
LLM_CONFIDENCE_THRESHOLD=0.6
```

Gemini OpenAI-compatible example:

```env
AI_PLANNER_MODE=hybrid
LLM_PROVIDER=openai_compatible
LLM_MODEL=gemini-3.5-flash
LLM_API_KEY=your-gemini-api-key
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
```

Planner modes:

- `rule_based`: use the deterministic MVP planner only.
- `llm`: call the LLM planner and fallback based on config.
- `hybrid`: prefer LLM, fallback to rule-based on timeout, invalid JSON,
  schema validation errors, unavailable tools, or low confidence.

## Policy Retrieval (RAG)

HRGenie answers HR-policy questions from the Markdown documents in
`app/rag/documents/`. Each `##` heading becomes one retrievable chunk.

Two retrieval signals run over those chunks:

- **Keyword** — IDF-weighted token overlap plus bigrams. Always available and
  needs no network, so the service still answers policy questions with no
  provider configured. Bigrams matter in Vietnamese: once accents are stripped,
  `tu xa` (remote) and `xa hoi` (social) both reduce to the token `xa`, and the
  adjacent-word pair disambiguates them.
- **Embedding** — cosine similarity over chunk vectors from any
  OpenAI-compatible `/embeddings` endpoint. This is what lets a question reach a
  policy it shares no words with: *"được hỗ trợ gì khi ốm đau"* retrieves the
  **Bảo hiểm** section, which keyword scoring cannot reach.

```env
RAG_MODE=hybrid                  # keyword | embedding | hybrid
EMBEDDING_PROVIDER=openai_compatible
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_API_KEY=               # falls back to LLM_API_KEY
EMBEDDING_BASE_URL=              # falls back to LLM_BASE_URL
RAG_EMBEDDING_WEIGHT=0.6         # embedding share when blending the two scores
RAG_MIN_EMBEDDING_SCORE=0.55     # absolute cosine floor
RAG_MIN_EMBEDDING_GAP=0.10       # how far the winner must beat the runner-up
```

`hybrid` degrades to keyword-only when no provider is configured, and also when
the provider errors at request time - a policy answer never depends on a
third-party being up.

### Why there is no vector database

A vector database exists to make *approximate* nearest-neighbour search viable
over millions of vectors. This corpus is a few dozen chunks, where a full cosine
scan is exact, needs no extra service, and costs less than the network round
trip to one. Chunk vectors are embedded once and cached on disk
(`app/rag/.embedding_cache.json`, keyed by model + chunk text), so a restart
re-embeds nothing and editing one policy re-embeds only the chunks that changed.
If the corpus ever grew by orders of magnitude, `EmbeddingIndex.search` is the
single method a real index would replace.

### Why an absolute similarity threshold is not enough

Embedding models place any two same-language texts fairly close together, so a
cosine floor tuned against one model produces false positives on another. What
actually separates "found the answer" from "found nothing" is the *shape* of the
distribution: a genuine hit leaves the rest of the corpus far behind, while an
off-topic question scores every chunk about the same.

Measured on this corpus with the test stub:

| Query | Best | Runner-up | Gap |
|---|---|---|---|
| `duoc ho tro gi khi om dau` (on-topic) | 0.914 | 0.461 | **0.453** |
| `gia ca phe hom nay` (off-topic) | 0.868 | 0.834 | **0.034** |

Both clear a 0.55 floor. Only the first has a clear winner, so an embedding-only
match additionally requires `best - runner_up >= RAG_MIN_EMBEDDING_GAP`. That
keeps the rule model-agnostic rather than tuned to one provider's cosine range.

## Tests

The intent regression fixture lives at:

```txt
app/tests/fixtures/intent_cases.json
```

Run all AI service tests:

```bash
cd OmniHR_AI
pytest
```

The intent test uses a failing fake LLM client so it verifies hybrid fallback
without spending LLM quota.
