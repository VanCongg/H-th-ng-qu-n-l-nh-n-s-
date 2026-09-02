# OmniHR Web

React + Vite + TypeScript web app for Admin and Manager (Mantine UI, TanStack Query, Zustand).

## Quick Start

```bash
cp .env.example .env
npm install
npm run dev
```

Runs at `http://localhost:5174`. Requires the backend (`OmniHR_BE`) running at the URL configured in `.env` (`VITE_API_BASE_URL`, defaults to `http://localhost:3000`).

## Checks

```bash
npm run lint
npm test
npm run build
```

## Structure

```txt
src/
  api/        # axios client, endpoints, shared types
  store/      # zustand stores (auth, preferences)
  components/ # shared UI (DataTable, PermissionGate, ...)
  features/   # one folder per domain (employees, tasks, leave-requests, ...)
  layouts/    # Manager (/app) and Admin (/admin) shells
```
