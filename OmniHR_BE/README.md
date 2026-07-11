# OmniHR Backend

NestJS + Prisma backend for CoreHR phase 1.

## Quick Start

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

Swagger runs at:

```txt
http://localhost:3000/docs
```

## Docker

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run prisma:seed
```

Run the backend with Docker Compose from this folder, not by clicking Run on
the `omnihr_be-api` image in Docker Desktop. A standalone image container does
not receive the required environment variables and will fail with:

```txt
Config validation error: "DATABASE_URL" is required
```

The compose service injects the correct internal database URL:

```txt
postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public
```

For local `npm run start:dev`, keep `.env` using `localhost` in `DATABASE_URL`.
For Docker Compose, the API container uses the `postgres` service host
automatically.

Default admin is read from:

```txt
DEFAULT_ADMIN_USERNAME
DEFAULT_ADMIN_EMAIL
DEFAULT_ADMIN_PASSWORD
```

## HRGenie Chatbot

The mobile app must call NestJS only. NestJS calls the internal AI service,
validates tools, executes business logic, creates pending actions, and writes
audit logs.

Chatbot endpoints:

```txt
POST /chatbot/message
GET /chatbot/conversations
GET /chatbot/conversations/:id/messages
POST /chatbot/actions/:actionId/confirm
POST /chatbot/actions/:actionId/cancel
```

Important env vars:

```env
AI_SERVICE_URL=http://localhost:8000
DOCKER_AI_SERVICE_URL=http://omnihr-ai:8000
AI_INTERNAL_TOKEN=change-me
AI_TIMEOUT_MS=30000
CHATBOT_RATE_LIMIT_TTL_SECONDS=60
CHATBOT_RATE_LIMIT_MAX=20
CHATBOT_HISTORY_LIMIT=12
CHATBOT_MAX_MESSAGE_LENGTH=1000
CHATBOT_PENDING_ACTION_TTL_MINUTES=30
```

Run backend checks:

```bash
npm run prisma:validate
npm run prisma:generate
npm run build
npm run test
```

For Docker:

```bash
docker compose up -d --build api omnihr-ai
docker compose exec api npm run prisma:deploy
```
