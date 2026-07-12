# KIMY — AGENTS.md

## Stack

Turborepo (npm workspaces) · Next.js 15 (Web) · NestJS 11 (API) · PostgreSQL 16 + pgvector · Prisma 6 · Redis + BullMQ · MinIO S3 · Expo SDK 54 (Mobile)

## Structure

```
apps/api/          — NestJS backend (port 3001)
apps/web/          — Next.js 15 frontend (port 3000)
apps/mobile/       — Expo React Native (students, read-only)
packages/ai-engine — LangChain AI pipeline (must rebuild after changes)
packages/database/ — Prisma schema + seeds
packages/shared-types/ — Shared TS interfaces
```

## Setup & Dev

```powershell
.\setup.ps1         # 1. .env → Docker infra → npm install → db:generate → db:push → seed
.\setup2.ps1        # 2. Build ai-engine → create MinIO bucket → install Chromium
```

**Dev (Windows, native is faster):** Only Dockerize infra services.
```powershell
docker compose up -d postgres redis minio    # Terminal 1
npm run dev --workspace=@kimy/api            # Terminal 2 (NestJS watch mode)
npm run dev --workspace=@kimy/web            # Terminal 3 (Next.js)
```

**PostgreSQL is on port 5434**, not 5432. See `.env.example`.

**After editing `packages/ai-engine`**: run `npm run build --workspace=@kimy/ai-engine` (or `cd packages/ai-engine && npm run build`). API imports from `dist/`, so rebuild is required.

## Prisma workflow

After modifying `packages/database/prisma/schema.prisma`:
```powershell
npm run db:generate    # regenerate Prisma client
npm run db:push        # sync schema with DB
```
Both steps are required. The `EPERM: rename query_engine-windows.dll.node` error is a harmless Windows race condition — stop the NestJS watcher and retry.

## AI Pipeline

- Providers: OpenAI, Groq, Gemini, DeepSeek, Claude, MiniMax
- Provider set via env `AI_PROVIDER` or DB `SystemSettings.aiProvider` (DB overrides env)
- Fallback chain: primary → DeepSeek → OpenAI → Groq → Gemini → Claude → MiniMax → Simulation
- If no API keys are set at all, `analyzeAdvance()` skips directly to `runSimulation()`
- Auto-correction: `buildPipeline()` maps model → provider to fix DB mismatches (e.g. `model: 'gpt-4o'` + `provider: 'groq'`)

## 2FA (critical)

2FA state lives **in-memory only** (not Redis or DB):
- `temp2faSecrets` Map — persists TOTP secret between `enable` and `confirm-enable` (TTL 10 min, cleanup every 5 min)
- `loginAttempts` Map — 5 failed attempts → 15 min block
- `recoveryTokens` Map — for password recovery

**Never** use `UnauthorizedException` (HTTP 401) on any 2FA endpoint (`enable`, `verify`, `confirm-enable`, `disable`, `authenticate`). The web client's Axios interceptor (`apps/web/src/lib/api.ts`) catches 401 and immediately logs the user out. Use `BadRequestException` (400) instead.

## No testing / lint infrastructure

There are no Jest, Vitest, `.spec.ts`, or `.test.ts` files anywhere. No linters are configured. Do not look for or run test/lint commands.

## Other conventions

- **Soft-delete templates**: set `isActive = false`, never physically delete
- **Mobile is read-only**: uploads only from web
- **Upload triggers immediate AI analysis** via BullMQ — no confirmation step
- **Test credentials**: all users use password `Kimy2026!` (admin@kimy.edu, coordinador@kimy.edu, asesor1@kimy.edu, estudiante1@kimy.edu, etc.)
- **API client interceptor**: auto-logout on 401 — applies to all requests
- **`@kimy/*` packages** use workspace protocol `"*"` in `package.json`
- **Gemini SDK nativo**: bypasses LangChain because the project's LangChain version doesn't support Gemini 2.0
- **Puppeteer** PDF generation requires Chromium: `npx puppeteer browsers install`
