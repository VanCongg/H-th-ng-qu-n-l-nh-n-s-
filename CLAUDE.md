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

**Chatbot architecture**: the mobile app calls NestJS only. NestJS calls `OmniHR_AI` internally (`POST /internal/chat/plan` with `X-Internal-Service-Token`) to get a plan; NestJS is the only service that checks permissions and writes data. The AI service never writes data directly — it returns `type/toolCalls/needConfirmation` and NestJS executes/confirms actions.

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

CI (`.github/workflows/ci.yml`) runs, per service in its own job/working directory: `OmniHR_BE` → `prisma generate` + `lint` + `test` + `build`; `OmniHR_WEB` → `lint` + `test` + `build`; `OmniHR_AI` → `pytest`. Same on every push/PR to `main`/`develop`. `OmniHR_APP` (Flutter) is not in CI — run `flutter analyze`/`flutter test` locally before considering mobile work done.

## Cross-cutting conventions

- There is no root package manager/workspace — never run `npm install` at the repo root; each of `OmniHR_BE`/`OmniHR_WEB` has its own `package.json`/lockfile.
- Commit messages follow `type(scope): summary` (e.g. `feat(be): ...`, `fix(web): ...`, `feat(app): ...`, `feat(ai): ...`); scope is the service, type is conventional-commits style (`feat`/`fix`/`refactor`/`test`/`docs`/`chore`/`ci`).
- When an API contract changes, update it on both sides in the same change: the NestJS DTO/controller in `OmniHR_BE`, and `OmniHR_WEB/src/api/endpoints.ts` + `types.ts` (and the Flutter model/`api_service.dart` call if `OmniHR_APP` consumes it). A backend-only or frontend-only edit to a shared endpoint is a bug.
- Never commit `.env` files — every service ships an `.env.example`; copy it locally instead of editing the example with real secrets.
- Before treating backend work as done, run `npm run lint && npm test && npm run build` in `OmniHR_BE` (mirrors CI); same for `OmniHR_WEB`.

## Backend architecture (`OmniHR_BE`)

- One NestJS module per domain under `src/<domain>/` (e.g. `employees`, `tasks`, `chatbot`, `review-cycles`), each with `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`. New domains follow this same module shape and get registered in `src/app.module.ts`.
- `src/prisma/` wraps the Prisma client as a Nest module/service; `prisma/schema.prisma` is the single source of truth for the DB model — always run `prisma:generate` after editing it, and add a migration via `prisma:migrate`.
- AuthZ is layered as global guards, applied in this order in `app.module.ts`: `ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard` → `PermissionsGuard`. Use `@Roles(...)` / `@Permissions(...)` decorators (`src/common/decorators/`) on controllers/handlers to restrict access; `@Public()` opts a route out of JWT auth. `PermissionsGuard` checks `user.permissions` (loaded via `UserRole` → `RolePermission` → `Permission`), not just role name.
- Config is validated up front via Joi in `app.module.ts` (`ConfigModule.forRoot`); in production it additionally rejects known-insecure default secrets (`rejectInsecureProductionConfig`) — don't remove or weaken this check.
- Errors go through `ApiError` (`src/common/api-error.ts`) and are normalized by `HttpExceptionFilter`; successful responses are wrapped by `ResponseInterceptor` into `{ success, message, data }` (matches `ApiEnvelope<T>` in `OmniHR_WEB/src/api/types.ts`). Follow this pattern instead of throwing raw NestJS exceptions or returning bare payloads — the interceptor only leaves a payload untouched if it already has `success`/`message` keys.
- `src/chatbot/` is the HRGenie gateway: `chatbot.controller.ts` exposes `/chatbot/*` to the mobile app, `chatbot-ai-client.service.ts` calls the internal AI service, `chatbot-tools.service.ts` validates/executes the tool calls the planner returns, `chatbot-history.service.ts` manages conversation persistence. Pending actions that need confirmation are created here and confirmed/cancelled via `/chatbot/actions/:actionId/confirm|cancel`.

## Web architecture (`OmniHR_WEB`)

- `src/features/<domain>/` — one folder per business domain, mirrors backend modules (`employees`, `tasks`, `leave-requests`, `review-cycles`, `performance-reviews`, ...). Put domain screens/hooks/components there rather than in shared `components/`.
- `src/api/` — single axios client (`axios.ts`), `endpoints.ts` (all HTTP calls), `types.ts` (shared API types mirroring backend DTOs). Add new endpoints/types here rather than inlining fetch calls in features.
- `src/store/` — Zustand stores; `auth.ts` holds the session (`accessToken`/`refreshToken`/`user`) persisted to `localStorage`, and exposes `hasRole`/`hasPermission` used by `PermissionGate`.
- `src/components/PermissionGate` — the client-side authorization gate; wrap UI needing a role/permission check in it instead of duplicating `authStore` checks (it mirrors the backend's `RolesGuard`/`PermissionsGuard` split — role and permission are checked independently).
- `src/layouts/` — two shells: `AdminLayout` (`/admin`) and `AppLayout` (`/app`, manager-facing); `nav.ts` defines the nav tree used by both, gated by role/permission.
- Routing/composition root is `src/app/App.tsx`; i18n strings live in `src/i18n.ts`.

## AI service architecture (`OmniHR_AI`)

- `app/api/` — FastAPI routers (`chat.py` internal planning endpoint, `health.py`, `rag.py`); `app/main.py` just wires routers into the `FastAPI()` app.
- `app/services/` — `rule_based_planner_service.py` (deterministic MVP planner, default), `llm_planner_service.py` (LLM-backed), `tool_planner_service.py` (shared tool-call orchestration), `rag_service.py`, `text_normalize.py`.
- `app/llm/` — provider abstraction (`base.py`, `factory.py`, `openai_compatible.py`); add new providers here behind the same interface rather than branching inside services.
- Planner mode (`AI_PLANNER_MODE`): `rule_based` (deterministic only), `llm` (LLM + config-driven fallback), `hybrid` (prefer LLM, fall back to rule-based on timeout/invalid JSON/schema errors/unavailable tools/low confidence). The response contract exposed to NestJS (`type`/`toolCalls`/`needConfirmation`) stays identical regardless of mode — map new planner internals back to this contract, don't change it.
- Regression fixtures for intent classification live at `app/tests/fixtures/intent_cases.json`; the intent test uses a failing fake LLM client to verify hybrid fallback without burning LLM quota — follow that pattern for new planner tests instead of calling a real LLM.

## Mobile architecture (`OmniHR_APP`)

- `lib/core/` — `api_service.dart` (HTTP client), `session.dart` (auth/session state), `utils.dart`.
- `lib/modules/<feature>/` — one folder per bottom-nav tab: `auth`, `shell`, `dashboard` (Home), `attendance` (Time), `leave` (Leave), `tasks` (Tasks), `profile` (Me).
- `lib/shared/widgets/widgets.dart` is a barrel export for shared widgets — export new shared widgets there rather than importing files individually.
- API base URL is compiled in via `--dart-define=API_BASE_URL=...` (`lib/core/app_config.dart`) and is never shown or editable in the UI; unset, it falls back to `http://localhost:3000` (web/desktop) or `http://10.0.2.2:3000` (Android emulator). A physical device needs `--dart-define=API_BASE_URL=http://<LAN-IP>:3000`.
- `lib/modules/onboarding/` runs once before login (splash → usage guide → location permission), gated by the `onboardingCompleted` pref in `AppSession`.
