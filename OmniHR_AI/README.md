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
