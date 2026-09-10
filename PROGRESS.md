# PROGRESS

## Phase 4 — Phone OTP auth, sessions, role-based access, tenancy, consent, dev inbox (2026-09-10)

Status: **done locally**. Acceptance Gate passed on this machine (CI not run; all tests and gate checks green).

### Built

- **SMS Adapter (`packages/adapters/src/sms`)**:
  - `SmsAdapter` interface (`send({ to, templateKey, params, locale })`), `renderSms` using i18n `sms` namespace.
  - Mock implementation pushing `{ to, text, at }` to Redis list `dev:inbox` (capped 500) and logging with phone masking.
  - Real stub throwing `NotConfiguredError`.
  - Exposed via `@kaithangu/adapters/sms`.
- **Auth & Session Service (`packages/core/src/services/auth.ts`, `packages/core/src/session.ts`)**:
  - `requestOtp`: validates Indian phone, rate limits via Redis (3 per phone per 10 min, 20 per IP per 10 min), generates 6-digit code, stores peppered SHA-256 hash in Redis `otp:{phone}` (TTL 300 s), and delivers via `SmsAdapter`.
  - `verifyOtp`: max 5 attempts per code, deletes code on 5th failure or on successful verification, upserts user (default role `customer`, locale from cookie, state from `DEFAULT_STATE`), updates `last_login_at`, and signs 30-day session JWT.
  - `authenticate`: verifies HS256 JWT, checks `session_version` against DB row to reject tokens revoked by `logoutAll`, returns full `RequestContext` with tenant scope ids (`societyId`, `stateCode`, `institutionId`).
  - `logoutAll`: increments user `session_version` in DB to invalidate active sessions.
  - `setLocale`: updates user's profile locale in DB.
  - Cookie helpers: `SESSION_COOKIE` (`kt_session`), `sessionCookieOptions` (`httpOnly`, `sameSite: 'lax'`, `secure: production`).
- **REST APIs (`/api/v1`)**:
  - `POST /api/v1/auth/otp/request`: requests OTP with client IP passed for rate limiting.
  - `POST /api/v1/auth/otp/verify`: verifies OTP, sets `kt_session` cookie, and returns redirect destination (`/consent` or role home).
  - `POST /api/v1/auth/logout`: clears session cookie and revokes session.
  - `GET /api/v1/me`: returns authenticated user profile and scope.
  - `GET /api/v1/admin/workers` & `GET /api/v1/admin/workers/[id]`: tenant-scoped worker queries.
- **Server Context Helpers (`apps/web/src/server/auth/context.ts`)**:
  - `getContext()`, `getSession()`, `getContextFromRequest()`, `getSessionFromRequest()`, `requireRole()`, `signInContext()`, `anonymousLocale()`.
- **Page Route Protection (`apps/web/src/proxy.ts`)**:
  - Next.js 16 proxy checking JWT signature and role claims:
    - `/app/*` -> `customer`
    - `/w/*` -> `worker`
    - `/admin/*` -> `lcs_admin`, `state_admin`, `national_admin`
    - `/org/*` -> `institution_admin`
    - `/dev/*` -> active only when `DEV_INBOX=true` (404 otherwise).
  - Unauthenticated visitors redirected to `/login?next=...` (or `/language` on first visit).
  - Forbidden roles redirected to `/forbidden`.
- **Tenancy Reference Pattern (`packages/core/src/services/workers.ts`, `packages/db/src/queries/workers.ts`)**:
  - `listWorkers` and `getWorker` enforcing `ScopeFilter` in SQL queries so out-of-scope records are never loaded or leaked (IDOR protection).
- **Consent Service & UI (`packages/core/src/services/consent.ts`, `apps/web/src/app/consent`)**:
  - Checks if user has accepted active terms version; redirects required before booking.
  - Plain-language consent points, audio button, and submission to `consents` table.
- **Mobile-First UI (360×640 viewport)**:
  - `/language`: prominent language selection buttons in 4 native scripts (മലയാളം, English, हिन्दी, தமிழ்).
  - `/login`: 10-digit mobile input with fixed +91 prefix.
  - `/login/verify`: 6 separate digit inputs with auto-advance, backspace support, paste handling, and resend countdown.
  - `/dev/inbox`: real-time message viewer reading from Redis `dev:inbox` with 3 s auto-refresh.
- **Test Coverage**:
  - Unit tests: OTP rate limiting, attempt counters, expiry (fake timers), JWT signing/verification/tamper detection, authz role scoping, `isAppError` cross-chunk detection.
  - Integration tests: IDOR suite (`idor.int.test.ts`) verifying LCS admins cannot access other societies, workers/customers cannot list workers, state admins cannot cross states; auth lifecycle integration suite (`auth.int.test.ts`).
  - E2E Playwright tests (12 tests on mobile viewport 360×640): full Malayalam signup flow (`/language` -> `/login` -> read OTP from `/dev/inbox` -> `/consent` -> `/app`), wrong code error feedback, visitor redirect, role home routing and `/forbidden` protection across all roles.
  - Packages/core maintains 100% line coverage.

### Acceptance Gate
- `bun run typecheck` — 0 errors
- `bun run lint` — 0 errors, 0 warnings
- `bun run test` — all 8 projects passed (77 web tests, 592 core tests, etc.)
- `bun run test:e2e` — 12/12 Playwright tests passed
- `bun run build` — Next.js 16 production build succeeded
- `bun run format:check` — all files formatted with Prettier

## Phase 3 — packages/core domain logic (2026-09-10)

Status: **done locally**. Acceptance Gate passed on this machine (CI not run, per
the user; nothing committed).

### Built

- `packages/core/src` (pure TS, no DB/network/framework imports; each module has
  a header comment pointing to its AGENTS.md section):
  - `money.ts`: branded `Paise` (safe integer), `addPaise`/`subPaise` (BigInt,
    overflow-checked), `percentToBasisPoints` (exact; accepts `5.25` or Postgres
    `"5.25"`), `mulPct` (half-up, BigInt), `formatINR(paise, locale)` via
    `Intl.NumberFormat` `<locale>-IN`, fed an exact decimal string.
  - `phone.ts`: `normalizeIndianPhone` (Indian mobiles only → `+91…`, else
    `AppError('INVALID_PHONE')`), `maskPhone`.
  - `errors.ts`: `AppError(code, httpStatus?, messageKey?, details?)`; status and
    `error.<CODE>` key default per code. `context.ts`: `RequestContext`,
    `systemContext(reason)`.
  - `authz.ts`: typed `Action` union (22 actions), `POLICY` matrix, `can`,
    `assertCan` (→ `FORBIDDEN`). Fail closed on missing scope ids.
  - `pricing.ts`: `quote()` exactly per 6.2; `breakdownKeys` = i18n keys of the
    lines that apply. `matching/score.ts`: `scoreCandidate`, `rankCandidates`,
    `fairnessBoost` exactly per 6.3, with breakdown + "why" key/params.
  - `fairness.ts`: `median`, `gini` (exact integer maths), `zeroJobShare`.
  - `booking/stateMachine.ts`: 6.5 table, `assertTransition`, `allowedNext`,
    `canTransition`. `otp.ts`: `generateOtp` (`crypto.randomInt`), `hashOtp`
    (HMAC-SHA-256 keyed with the pepper), `verifyOtp` (constant time).
  - `ledger.ts`: `buildEntriesForUpi`/`buildEntriesForCash`, `canonicalJson`,
    `computeHash`, `sealEntries`, `verifyChain` → `{ ok, brokenAtId? }`.
  - `geo.ts`: added `haversineKm(a, b)`; existing functions unchanged.
- Tests: 403 in core (Vitest + fast-check): hand-computed pricing tables and
  properties (sum = total, parts ≥ 0, emergency ≥ normal, monotonic in minutes),
  score edges and tie-breaks, gini properties, full 11×11 state matrix, 100-entry
  ledger chains with per-field tamper detection, full role × action authz matrix
  (in-scope, out-of-scope, missing-scope), and an i18n check that every key core
  emits exists in all four locales with its placeholders.
- `packages/core/vitest.config.ts`: coverage threshold `lines: 90`
  (currently 100 % lines, 98.2 % branches).
- i18n: `error.*`, `pricing.*`, `matching.why.*` in en/ml/hi/ta.
- `packages/db`: `bun run db:seed` now upserts reference data (states, trades,
  state_config, state_trade_rates) from `data/seed/*_rates.yaml` in one
  transaction (`src/scripts/seed.ts`, rows built in `src/seed/stateRows.ts`);
  `-- --dry-run` prints the exact SQL without connecting. `loadPricingInputs()`
  query and `createDb` exported from `@kaithangu/db`. Seeded into the Supabase DB
  with the user's approval.
- `scripts/sim/quote-example.ts` (`bun run sim:quote-example`): loads KL plumber
  rates from the DB and prints normal vs emergency breakdowns
  (50 min → ₹165.00 / ₹206.26 with the placeholder rates).

### Decisions

1. Cash ledger path is literal 6.7: credit worker wage + one `cash_offset` debit
   for welfare + fee + gst; welfare/platform accounts are not credited at cash
   time. Zero-amount entries are omitted (DB requires `amount_paise > 0`).
2. Ledger hash input uses the DB column names (`id, account, booking_id,
   amount_paise, direction, kind, created_at, prev_hash`) so stored rows can be
   re-verified. Writers must assign `id` (nextval) and `created_at` (ms
   precision ISO string) before hashing, under the `ledger_head` lock.
3. Emergency surcharge is computed on the pre-surcharge wage; welfare/fee on the
   surcharged wage. Returned `wage` includes `surcharge`.
4. Authz matrix as approved in the Phase 3 plan; system actor may do anything.
5. Self-transitions (e.g. offered → offered) are illegal; sequential re-offers
   keep status `offered` without a transition.
6. `mulPct`/`gini` reject negative inputs (half-up is undefined for negatives).
7. "Why" key = the factor with the largest weighted contribution
   (`matching.why.proximity|skill|rating|fairness`); ties in that order.
8. Scores compare exactly (no rounding) before the tie-breaks.
9. `money.ts` names are `addPaise`/`subPaise` (spec said add/sub) to avoid
   generic exports from the package root.
10. New dependency: `fast-check` (allowed list), core dev only. Workspace deps
    added: core → i18n; scripts → core, db, zod.

### TODO_VERIFY

- All seeded `state_config` and `state_trade_rates` values for KL and TN (22
  rows, `is_placeholder = true`), as listed by `bun run db:seed`.
- ml/hi/ta translations of the new `error.*`, `pricing.*`, `matching.why.*`
  messages need review by native speakers.

### Known gaps

- `loadPricingInputs` and the live seed transaction have no automated DB test
  (exercised by the gate run only); the seed SQL is unit-tested via `toSQL()`.
- `db:seed` seeds reference data only; demo societies/workers and `db:reset`
  are still not wired (README "Demo data (not yet seeded)" still applies).
- `index.ts` exports `node:crypto` users (otp, ledger, context); importing
  `@kaithangu/core` from a client component will need subpath exports.
- `README.md` and `.claude/settings.local.json` fail `prettier --check`
  (pre-existing, not touched in this phase).

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