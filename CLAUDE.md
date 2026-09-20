# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

OmniHR is an HR management system split into four independently versioned services in this monorepo. There is no root package.json / workspace tool — each service is built, linted, and tested from its own directory.

| Dir | Role | Stack |
|---|---|---|
| `OmniHR_BE` | REST API: auth, RBAC, attendance, leave, tasks, chatbot gateway | NestJS 11 + Prisma + PostgreSQL |
| `OmniHR_WEB` | Admin/Manager web app | React 19 + Vite + TypeScript + Mantine + TanStack Query + Zustand |
| `OmniHR_APP` | Employee mobile app | Flutter |
| `OmniHR_AI` | HRGenie chatbot planner service (internal only, never called by clients directly) | FastAPI (Python) |

**Chatbot architecture**: the mobile app calls NestJS only. NestJS calls `OmniHR_AI` internally (`POST /internal/chat/plan`, and `POST /internal/suggestions/explain` for assignee-suggestion wording, both with `X-Internal-Service-Token`) to get a plan; NestJS is the only service that checks permissions and writes data. The AI service never writes data directly — it returns `type/toolCalls/needConfirmation` and NestJS executes/confirms actions.

## Commands

### Backend (`OmniHR_BE`)

```bash
cd OmniHR_BE
npm run start:dev          # dev server w/ watch, http://localhost:3000, Swagger at /docs
npm run build               # nest build
npm run lint                 # eslint --fix on src/ and prisma/
npm test                     # jest --runInBand (all *.spec.ts)
npx jest src/employees/employees.service.spec.ts   # run a single test file
npx jest -t "should create"                          # run tests matching a name
npm run prisma:generate      # regen prisma client after schema.prisma changes
npm run prisma:migrate       # create + apply a new migration (dev)
npm run prisma:deploy        # apply migrations (prod/CI)
npm run prisma:seed          # seed base data (roles, admin, departments...)
SEED_AS_OF=2026-01-31 npm run prisma:seed   # anchor the seeded timeline in the past
npm run eval:suggestions     # replay past assignments and score the ranking (read-only)
npm run eval:tune-weights    # fit the ranking weights on that history; --apply writes them
npm run eval:ml-baseline     # compare the shipped ranking against logistic-regression baselines
npm run eval:diagnostics     # is the measurement sound? leakage, negative control, cold start
npm run eval:tune-constants  # random-search the history/capacity constants on three time slices
```

### Web (`OmniHR_WEB`)

```bash
cd OmniHR_WEB
npm run dev                  # http://localhost:5174, requires OmniHR_BE running (VITE_API_BASE_URL)
npm run build                # tsc -b && vite build
npm run lint                  # eslint --fix on src/**/*.{ts,tsx}
npm test                      # vitest run (all)
npx vitest run src/store/auth.test.ts   # run a single test file
npx vitest run -t "renders children"      # run tests matching a name
```

### AI service (`OmniHR_AI`)

```bash
cd OmniHR_AI
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pytest                          # all tests
pytest app/tests/test_x.py -k "case_name"   # single test
```

Default planner mode is rule-based (no LLM key needed). To exercise the real LLM planner, set `AI_PLANNER_MODE=hybrid`/`llm` and the `LLM_*` vars (see `OmniHR_AI/README.md`).

### Mobile (`OmniHR_APP`)

```bash
cd OmniHR_APP
flutter pub get
flutter run -d chrome          # or flutter run -d <device_id>
dart format lib test
flutter analyze
flutter test
flutter build apk --debug|--release
```

### Docker (backend stack only)

```bash
cd OmniHR_BE
docker compose up -d --build          # api (3000), postgres (5432), redis (6379), omnihr-ai (8000)
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run prisma:seed
```
Run via `docker compose`, not by starting the built `omnihr_be-api` image standalone — a standalone container lacks the env vars compose injects (fails with `DATABASE_URL is required`). For plain `npm run start:dev`, `.env` should point `DATABASE_URL` at `localhost`; compose overrides this to the `postgres` service host.

CI (`.github/workflows/ci.yml`) runs, per service in its own job/working directory: `OmniHR_BE` → `prisma generate` + `lint` + `test` + `build`; `OmniHR_WEB` → `lint` + `test` + `build`; `OmniHR_AI` → `pytest`; `OmniHR_APP` → `dart format --set-exit-if-changed` + `flutter analyze` + `flutter test` on a pinned Flutter version. Same on every push/PR to `main`/`develop`. Unformatted Dart fails the build, so run `dart format lib test` before pushing mobile work.

## Cross-cutting conventions

- There is no root package manager/workspace — never run `npm install` at the repo root; each of `OmniHR_BE`/`OmniHR_WEB` has its own `package.json`/lockfile.
- Commit messages follow `type(scope): summary` (e.g. `feat(be): ...`, `fix(web): ...`, `feat(app): ...`, `feat(ai): ...`); scope is the service, type is conventional-commits style (`feat`/`fix`/`refactor`/`test`/`docs`/`chore`/`ci`).
- When an API contract changes, update it on both sides in the same change: the NestJS DTO/controller in `OmniHR_BE`, and `OmniHR_WEB/src/api/endpoints.ts` + `types.ts` (and the Flutter model/`api_service.dart` call if `OmniHR_APP` consumes it). A backend-only or frontend-only edit to a shared endpoint is a bug.
- Never commit `.env` files — every service ships an `.env.example`; copy it locally instead of editing the example with real secrets.
- Before treating backend work as done, run `npm run lint && npm test && npm run build` in `OmniHR_BE` (mirrors CI); same for `OmniHR_WEB`.

## Backend architecture (`OmniHR_BE`)

- One NestJS module per domain under `src/<domain>/` (e.g. `employees`, `tasks`, `chatbot`, `attendance`), each with `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`. New domains follow this same module shape and get registered in `src/app.module.ts`.
- `src/prisma/` wraps the Prisma client as a Nest module/service; `prisma/schema.prisma` is the single source of truth for the DB model — always run `prisma:generate` after editing it, and add a migration via `prisma:migrate`.
- AuthZ is layered as global guards, applied in this order in `app.module.ts`: `ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard` → `PermissionsGuard`. Use `@Roles(...)` / `@Permissions(...)` decorators (`src/common/decorators/`) on controllers/handlers to restrict access; `@Public()` opts a route out of JWT auth. `PermissionsGuard` checks `user.permissions` (loaded via `UserRole` → `RolePermission` → `Permission`), not just role name.
- `src/redis/` is a global module wrapping one optional ioredis connection, serving two jobs. (1) Rate limits that must agree across API instances: `ThrottlerGuard` (via `RedisThrottlerStorage` in `src/common/throttler/`) and the chatbot per-user limit in `chatbot.service.ts`. (2) `CacheService` — cache-aside reads via `cache.wrap(key, ttl, loader)`, used by `AuthService.hydrateAuthUser` (runs on every authenticated request) and `SystemSettingsService.getSettings`.
- Everything Redis-backed degrades instead of failing: with `REDIS_HOST` unset or Redis unreachable, rate limits fall back to in-process counters and `CacheService` reports a miss so the loader hits the database. Tests and `start:dev` therefore need no Redis. Keep new shared state on that same fall-back path rather than failing the request.
- Cache keys and TTLs live in `src/redis/cache-keys.ts` — add new ones there, never inline. `wrap` never stores `null`, so a "not found" is always re-checked. Every write that changes a cached value must invalidate it: a user's roles/status/password drop `cacheKeys.authUser(id)` (see `users.service.ts`, `employees.service.ts`, `auth.service.ts`), and a change to a role's permissions evicts *every* holder via `RolesService.invalidateRoleHolders`. The TTL is a backstop for a missed path, not the mechanism. Unit tests use `createFakeCache()` from `src/redis/cache.service.fake.ts`.
- Config is validated up front via Joi in `app.module.ts` (`ConfigModule.forRoot`); in production it additionally rejects known-insecure default secrets (`rejectInsecureProductionConfig`) — don't remove or weaken this check.
- Errors go through `ApiError` (`src/common/api-error.ts`) and are normalized by `HttpExceptionFilter`; successful responses are wrapped by `ResponseInterceptor` into `{ success, message, data }` (matches `ApiEnvelope<T>` in `OmniHR_WEB/src/api/types.ts`). Follow this pattern instead of throwing raw NestJS exceptions or returning bare payloads — the interceptor only leaves a payload untouched if it already has `success`/`message` keys.
- Simulated history: the seed fills its anchor month (`SEED_AS_OF`, default today) and `prisma/simulate-day.ts` plays the days forward from there. `--until` is clamped to today - **a dataset must never contain a date that has not happened yet**, and `clampToToday` is unit tested for that.
- `src/ai-task-suggestions/` ranks assignees with a weighted multi-criteria score (skill / workload / leave availability / track record on finished tasks), not a learned model. Two things sit **outside** the weighted score on purpose: hard tiers (missing a required skill, or approved leave over more than `LEAVE_BLOCK_THRESHOLD` of the task window) push a candidate below everyone else regardless of points, and fair-share rebalancing subtracts points after ranking from whoever already took more than the team's recent average. Weights decide who is better; tiers decide who is possible; rebalancing decides who has had enough for now. The pure scoring lives in `suggestion-scoring.ts` and is shared with `prisma/evaluate-suggestions.ts` and `prisma/tune-weights.ts`, so the offline evaluation measures exactly what the API ranks with. The weights are **not** constants: they come from system settings (`aiWeightSkill` / `aiWeightWorkload` / `aiWeightAvailability` / `aiWeightHistory`), are fitted on past assignments by the tuner, and every generated suggestion snapshots the weights that produced it. Run the tuner against a simulated database (`DATABASE_URL=...omnihr_eval`), never production; it refuses to write weights fitted on too few decisions unless forced.
- `src/chatbot/` is the HRGenie gateway: `chatbot.controller.ts` exposes `/chatbot/*` to the mobile app, `chatbot-ai-client.service.ts` calls the internal AI service, `chatbot-tools.service.ts` validates/executes the tool calls the planner returns, `chatbot-history.service.ts` manages conversation persistence. Pending actions that need confirmation are created here and confirmed/cancelled via `/chatbot/actions/:actionId/confirm|cancel`.

## Web architecture (`OmniHR_WEB`)

- `src/features/<domain>/` — one folder per business domain, mirrors backend modules (`employees`, `tasks`, `leave-requests`, `projects`, `skills`, ...). Put domain screens/hooks/components there rather than in shared `components/`.
- `src/api/` — single axios client (`axios.ts`), `endpoints.ts` (all HTTP calls), `types.ts` (shared API types mirroring backend DTOs). Add new endpoints/types here rather than inlining fetch calls in features.
- `src/store/` — Zustand stores; `auth.ts` holds the session (`accessToken`/`refreshToken`/`user`) persisted to `localStorage`, and exposes `hasRole`/`hasPermission` used by `PermissionGate`.
- `src/components/PermissionGate` — the client-side authorization gate; wrap UI needing a role/permission check in it instead of duplicating `authStore` checks (it mirrors the backend's `RolesGuard`/`PermissionsGuard` split — role and permission are checked independently).
- `src/layouts/` — two shells: `AdminLayout` (`/admin`) and `AppLayout` (`/app`, manager-facing); `nav.ts` defines the nav tree used by both, gated by role/permission.
- Routing/composition root is `src/app/App.tsx`; i18n strings live in `src/i18n.ts`.

## AI service architecture (`OmniHR_AI`)

- `app/api/` — FastAPI routers (`chat.py` internal planning endpoint, `explain.py` suggestion wording, `health.py`, `rag.py`); `app/main.py` just wires routers into the `FastAPI()` app.
- `app/services/` — `rule_based_planner_service.py` (deterministic MVP planner, default), `llm_planner_service.py` (LLM-backed), `tool_planner_service.py` (shared tool-call orchestration), `suggestion_explainer_service.py` (writes the assignee-suggestion reasons), `rag_service.py`, `text_normalize.py`.
- `POST /internal/suggestions/explain` rewrites the reason shown under each AI assignee suggestion. It is wording only: NestJS has already ranked, scored and stored the candidates, so an empty answer (no LLM key, timeout, invalid JSON, an employee id the request never mentioned) simply leaves the template sentence in place. Turn it off with `AI_SUGGESTION_EXPLANATIONS=false` on the NestJS side.
- `app/llm/` — provider abstraction (`base.py`, `factory.py`, `openai_compatible.py`); add new providers here behind the same interface rather than branching inside services.
- Planner mode (`AI_PLANNER_MODE`): `rule_based` (deterministic only), `llm` (LLM + config-driven fallback), `hybrid` (prefer LLM, fall back to rule-based on timeout/invalid JSON/schema errors/unavailable tools/low confidence). The response contract exposed to NestJS (`type`/`toolCalls`/`needConfirmation`) stays identical regardless of mode — map new planner internals back to this contract, don't change it.
- Regression fixtures for intent classification live at `app/tests/fixtures/intent_cases.json`; the intent test uses a failing fake LLM client to verify hybrid fallback without burning LLM quota — follow that pattern for new planner tests instead of calling a real LLM.

## Mobile architecture (`OmniHR_APP`)

- `lib/core/` — `api_service.dart` (HTTP client), `session.dart` (auth/session state), `utils.dart`.
- `lib/modules/<feature>/` — one folder per bottom-nav tab: `auth`, `shell`, `dashboard` (Home), `attendance` (Time), `leave` (Leave), `tasks` (Tasks), `profile` (Me).
- `lib/shared/widgets/widgets.dart` is a barrel export for shared widgets — export new shared widgets there rather than importing files individually.
- API base URL is compiled in via `--dart-define=API_BASE_URL=...` (`lib/core/app_config.dart`) and is never shown or editable in the UI; unset, it falls back to `http://localhost:3000` (web/desktop) or `http://10.0.2.2:3000` (Android emulator). A physical device needs `--dart-define=API_BASE_URL=http://<LAN-IP>:3000`.
- `lib/modules/onboarding/` runs once before login (splash → usage guide → location permission), gated by the `onboardingCompleted` pref in `AppSession`.
