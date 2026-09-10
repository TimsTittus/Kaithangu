# PROGRESS

## Phase 1 — Monorepo scaffold, tooling, local infra, CI (2026-09-10)

Status: **done locally**. Acceptance Gate passed on this machine; the GitHub
Actions run is pending (the user commits and pushes).

### Built

- Root: Bun workspaces (`apps/*`, `packages/*`, `scripts`), `packageManager: bun@1.3.14`,
  Turborepo tasks (build, dev, typecheck, lint, test, test:e2e), `.nvmrc` (22),
  `.gitignore`, Prettier config + `.prettierignore`, root `vitest.config.ts`
  (`test.projects`, v8 coverage), `.env.example` documenting every variable.
- `packages/config`: `tsconfig.base.json` (strict, noUncheckedIndexedAccess,
  bundler resolution, ES2022), shared ESLint flat config (`createConfig(dir)` with
  typescript-eslint `recommendedTypeChecked`), Prettier config.
- `packages/core`: `clamp`, `parseEnv` + `EnvValidationError` (lists every
  missing/invalid var, empty string = missing), `maskPhones`, `buildLoggerOptions`
  (pino, masks phone numbers in every emitted line).
- `packages/db`: `redactDatabaseUrl`. `packages/adapters`: `resolveAdapterMode`
  (per-adapter `<NAME>_MODE` → `ADAPTER_MODE` → `mock`). `packages/i18n`:
  `SUPPORTED_LOCALES`, `isSupportedLocale`.
- `apps/web`: Next.js 16.3.4 (App Router, src/, Tailwind v4), `transpilePackages`,
  env validated at startup (`instrumentation.ts` → `instrumentation-node.ts`),
  `GET /api/health` → `{ ok, version, db, redis }` with real `SELECT 1` / `PING`
  probes, 1 s timeout each, HTTP 503 when anything is down. tRPC v11 server at
  `/api/trpc` (fetch adapter) with `system.ping`; errors carry `requestId`.
- `apps/voice`: Fastify 5, `GET /health` → `{ ok, version }`, pino with
  `requestId` log label (reuses a valid `x-request-id`, else a UUID, echoed back),
  graceful SIGTERM/SIGINT via `app.close()`, `tsx watch` dev, `tsup` build
  bundling `@kaithangu/*`.
- `apps/jobs`: RabbitMQ worker (amqplib). Durable `heartbeat` queue; publishes
  every 60 s and consumes/logs it (zod-validated payload, bad messages nacked
  without requeue); graceful shutdown; exits if the broker connection drops.
- `apps/ml`: uv project, Python 3.12, FastAPI `GET /health`, pytest (1 test);
  `package.json` shells to `uv run uvicorn … --port 8000` / `uv run pytest`.
- `docker-compose.yml`: postgis/postgis:16-3.4, redis:7, rabbitmq:4.3-management,
  named volumes, healthchecks; `infra/db/init.sql` creates `postgis` + `pgcrypto`
  and database `kaithangu_test` (with the same extensions).
- `scripts/smoke/datastores.ts` (`bun run smoke:datastores`): live Postgres,
  Redis (incl. `SET NX PX` lock) and RabbitMQ round-trip.
- `.github/workflows/ci.yml`: `node` job (postgis, redis, rabbitmq services;
  setup-node from `.nvmrc`, setup-bun, `bun install --frozen-lockfile`, init DB,
  format:check, typecheck, lint, test, build, smoke) and `ml` job (setup-uv,
  `uv sync --locked`, pytest). Validated with actionlint (exit 0).
- `README.md` quickstart, `docs/architecture.md`.

### Installed versions

Bun 1.3.14 · Next.js **16.3.4** (major 16 → `proxy.ts` instead of
`middleware.ts`, async params/searchParams) · React 19.2.8 · TypeScript 6.0.3 ·
ESLint 9.39.5 · typescript-eslint 8.70 · Vitest 5.0 · Turbo 2.10 · Fastify 5.12 ·
pino 10.3 · zod 4.6 · ioredis 6.0 · postgres 3.4.9 · amqplib 2.0.1 ·
@trpc/server 11.18 · tsx 4.23 · tsup 8.5 · Python 3.12.12 · FastAPI 0.141 ·
uvicorn 0.52 · pytest 9.1.

### Decisions

1. **RabbitMQ replaces BullMQ** (user-approved). AGENTS.md §3 and the allowed-deps
   list amended. Redis stays for locks/sessions/rate limits. RabbitMQ 4 rejects
   transient non-exclusive queues, so work queues are durable, and amqplib
   connections/channels always get `'error'` listeners (an unhandled one crashes
   the process).
2. **tRPC "everywhere possible"** (user-approved). AGENTS.md §4.1/§4.7 amended:
   app API is tRPC at `/api/trpc`; REST only for health, signed webhooks and
   external clients. Only the server side is wired so far.
3. **Extra dependencies approved by the user:** `@types/node`, `@types/react`,
   `@types/react-dom`, `@tailwindcss/postcss`, `eslint-config-next`, `httpx` (dev).
   Added to the AGENTS.md allowed list together with amqplib and the tRPC packages.
4. **TypeScript 6.0.3, not 7.0**: typescript-eslint 8.70 requires `<6.1.0`.
5. **ESLint 9, not 10**: `eslint-plugin-react` (pulled in by `eslint-config-next`)
   calls `context.getFilename()`, removed in ESLint 10; its latest release
   supports only `^9.7`.
6. **Vitest `test.projects`** at the root (the `workspace` file is deprecated).
7. **`scripts/` is a workspace** so smoke/sim/demo scripts can import deps under
   Bun's isolated linker.
8. **One root `.env`**: loaded by `next.config.ts` (`process.loadEnvFile`, never
   overrides real env) and by `tsx --env-file-if-exists=../../.env` for voice/jobs.
9. **Compose credentials come from `.env`** with `${VAR:?}` fail-fast; the host
   Postgres port is `POSTGRES_PORT` (5432 was taken on the dev machine → 5434).
   CI uses throwaway credentials on ephemeral service containers.
10. **Health returns 503** when a dependency is down (body shape as specified).
11. **Phone masking via pino `hooks.streamWrite`** on the final JSON line. A first
    version walked log objects in `formatters.log` and overflowed the stack on
    Fastify's circular request objects; a regression test covers this.
12. **Heartbeat** uses `setInterval` + publish to the durable queue. The design for
    delayed/scheduled messages (offer timeouts, "matching 60 min before") —
    TTL + dead-letter vs. the delayed-message plugin — is deferred to the dispatch
    phase.
13. **Names**: apps are `web`, `voice`, `jobs`, `ml` (so `bun run --filter ml dev`
    works); shared packages are `@kaithangu/*`.
14. AGENTS.md §9 commands without an implementation yet (`db:*`, `voice:*`,
    `demo:reset`) are placeholder scripts that print which phase implements them.
15. New env vars beyond the Phase 1 list: `RABBITMQ_URL`, `VOICE_PORT`,
    `VOICE_HOST`, and compose-only `POSTGRES_USER/PASSWORD/PORT`, `REDIS_PORT`,
    `RABBITMQ_DEFAULT_USER/PASS`, `RABBITMQ_PORT`, `RABBITMQ_MANAGEMENT_PORT`.
16. create-next-app boilerplate removed (template page, SVGs, favicon, Geist
    Google fonts — per-locale Noto fonts come with i18n). `sharp` /
    `unrs-resolver` moved to root `trustedDependencies`.

### TODO_VERIFY

- `DEMO_PINCODE` is empty in `.env.example`; needs a verified pincode from the
  provided data files.
- `DEFAULT_STATE=KL` in `.env.example` assumes Kerala's state code; confirm it
  matches the codes used when `state_config` is seeded.

### Known gaps

- GitHub Actions has not run yet (actionlint only); first push will tell.
- The local gate ran on Node 26.7.0; `.nvmrc` and CI use Node 22.
- `.gitignore` still contains the pre-existing `AGENTS.md` and `CLAUDE.md`
  entries, so git ignores those files. Remove the lines if they should be committed.
- The home page and `metadata.title` contain the brand name "Kaithangu" and
  `lang="en"` until next-intl locale resolution lands.
- No tRPC client/react-query provider yet; `AppError` (and its mapping into the
  tRPC error shape) is not implemented yet.
- `apps/ml` has no lint/typecheck step (no Python linter in the allowed list) and
  its health has no version.
- `test:e2e` has no tasks yet (Playwright arrives with UI work).
- Web health does not report RabbitMQ (spec fixes the shape to db/redis).
- Repo-wide Vitest coverage is 45% because app entry points (servers, route
  handlers, client factories) are exercised only by the live gate; `packages/core`
  is at 100% lines.
- pytest prints 2 DeprecationWarnings from Starlette's TestClient (third-party).
- `bun run dev` needs `uv` on PATH for `apps/ml`.