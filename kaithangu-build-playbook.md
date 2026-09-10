# Kaithangu — Phase-by-Phase Build Playbook for AI Coding Agents

SIH 2026 · PS 26089 · Cooperative Gig Services Platform
For use with Claude Code or Google Antigravity, starting from an empty repo.

---

## 0. How to use this playbook (read once)

No prompt makes an agent error-free. Mistakes get prevented by four things, and this playbook is built around them:

- locked decisions the agent cannot drift from (`AGENTS.md`)
- small phases
- tests written alongside the code
- acceptance gates that you run yourself

Rules for you, the human:

1. **One phase = one fresh agent session.** Never paste two phases together. Long sessions degrade.
2. **Every session starts with the Universal Preamble** (section 2), followed by the phase prompt.
3. **Plan before code.**
   - Claude Code: switch to plan mode (Shift+Tab until "plan mode") before pasting the prompt.
   - Antigravity: use Planning mode.
   - Read the plan. Reject it if it contradicts `AGENTS.md`.
4. **A phase is done only when its Acceptance Gate passes on your machine.** Run the commands yourself. Don't trust "all tests pass" without seeing output.
5. **Commit and tag after every phase:** `git tag phase-03-done`. If a phase goes badly, `git reset --hard phase-02-done` and rerun it. That beats patching a mess.
6. **When something breaks,** use the Fix Prompt (section 3), not "fix it".
7. **Every third-party integration starts with a smoke script** against the real, current docs. The agent must never guess API parameters for Twilio, Sarvam, Razorpay, or any LLM provider.
8. **You write `AGENTS.md` yourself** (section 4). Don't let the agent generate its own constitution.

Phase map:

| #   | Phase                                | Output                                                           |
| --- | ------------------------------------ | ---------------------------------------------------------------- |
| 1   | Scaffold & tooling                   | Monorepo, Docker, CI, health checks                              |
| 2   | Database & seed                      | Schema, migrations, Kerala seed data                             |
| 3   | Core domain logic                    | Pricing, splits, matching score, fairness, state machine, ledger |
| 4   | Auth, RBAC, tenancy                  | Phone OTP, roles, scoping, dev inbox, consent                    |
| 5   | Customer PWA                         | Multilingual booking flow, audio labels, offline shell           |
| 6   | Dispatch & worker app                | Offers, atomic accept, worker PWA, OTP start/complete            |
| 7   | Voice v1 (IVR)                       | Call-based booking and worker IVR, voice simulator               |
| 8   | Voice v2                             | Realtime voice, voice onboarding, voice rating                   |
| 9   | Payments & welfare                   | UPI splits, cash path, hash-chained ledger, invoices, QR ID      |
| 10  | Federation console                   | 3-level dashboards, maps, fairness, welfare, disputes            |
| 11  | AI & simulation                      | Synthetic history, forecasting, fairness proof, workforce advice |
| 12  | Disaster, institutions, state switch | Relief mode, bulk bookings, Tamil Nadu config, ONDC prototype    |
| 13  | Security & performance               | Threat model, IDOR suite, load tests, budgets                    |
| 14  | Real-user testing                    | Voice corpus, eval, field test protocol, bug bash                |
| 15  | Deploy & demo hardening              | Production deploy, demo reset, runbook, fallbacks                |

---

## 1. Before Phase 1: accounts, tools, and data (manual, do this first)

**Local tools**

- Node 22 LTS
- Bun 1.2+ (package manager, workspace manager and script runner)
- Docker Desktop
- Python 3.12 with `uv`
- git
- ffmpeg
- ngrok or cloudflared (for Twilio webhooks during development)

**Accounts**

| Service               | Why                                                                            | Gotchas to handle early                                                                                                                                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub (private repo) | Code + CI                                                                      | —                                                                                                                                                                                                                                                                                                                                                                           |
| Twilio                | Calls (voice booking, worker IVR)                                              | **Upgrade from trial**: trial accounts can only call verified numbers and play a trial message. **Enable Voice Geo Permissions for India** in the console. Buying an Indian inbound number needs regulatory documents, so design the demo around **callback** ("enter your number / give a missed call, we call you"). Test an outbound call to an Indian mobile in week 1. |
| Sarvam AI             | Speech-to-text, text-to-speech, translation (Malayalam, Hindi, Tamil, English) | Read current docs at docs.sarvam.ai. Model names and parameters change between versions.                                                                                                                                                                                                                                                                                    |
| LLM provider          | Intent extraction from transcripts                                             | Pick one primary: Sarvam chat, Anthropic, or Gemini. It sits behind an adapter, so it can be swapped.                                                                                                                                                                                                                                                                       |
| Razorpay (test mode)  | UPI payments + Route splits                                                    | **Route needs activation.** Raise the request early, possibly via a support ticket. A mock adapter covers the gap.                                                                                                                                                                                                                                                          |
| Supabase or Neon      | Hosted Postgres with PostGIS for staging/prod                                  | Enable the `postgis` extension.                                                                                                                                                                                                                                                                                                                                             |
| Railway (or Fly.io)   | Voice server, jobs worker, ML service, Redis                                   | The voice server must be a persistent process, never serverless.                                                                                                                                                                                                                                                                                                            |
| Vercel                | Next.js web app                                                                | —                                                                                                                                                                                                                                                                                                                                                                           |

**Data you must collect** (the agent is forbidden from inventing it)

1. **India pincode directory CSV with latitude/longitude** (data.gov.in "All India Pincode Directory"). Save it as `data/raw/pincodes.csv`.
2. **Kerala minimum wage notification values** for each trade, from the Kerala Labour Department. You'll fill `state_trade_rates` from these.
3. **Festival windows** for Kerala (Onam, Vishu, Christmas, Eid, wedding season) for the years you simulate. Save to `data/seed/festivals.yaml`.
4. **Optional:** IMD district rainfall CSV for Ernakulam and Kottayam. Save to `data/raw/rainfall_*.csv`.
5. **Real cooperative details** from your LCS visit: trade list, typical rates, and society structure.

**Demo hardware:** 2 keypad phones with Indian SIMs (these are the workers), and 1 low-end Android phone with 2 GB RAM (the customer).

---

## 2. Universal Preamble (paste at the start of every session)

```text
You are working in the Kaithangu monorepo. Before doing anything else:

1. Read AGENTS.md completely. It is binding. If any instruction from me conflicts with AGENTS.md, stop and ask me which wins.
2. Read PROGRESS.md to learn what earlier phases built, the decisions made, and known gaps.
3. Run: bun install && bun run typecheck && bun run lint && bun run test. Report the baseline result. If the baseline is failing, report it and wait; do not start new work on a red baseline.

Rules for this session:
- First output a written plan: files to create/modify, migrations, new dependencies (with justification), tests you will write, and risks/unknowns. Then wait for me to reply "go".
- Implement in small steps. After each step run typecheck, lint and the relevant tests. Never batch many unverified changes.
- Do not add any dependency that is not in the AGENTS.md allowed list without asking me first and giving a reason.
- Do not guess third-party API shapes. Fetch and read the official docs, write a smoke script in scripts/smoke/, run it, and only then integrate.
- Never hardcode secrets, user-facing strings, prices, wage values, coordinates, pincodes, or festival dates. Use env vars, i18n catalogs, or config tables.
- Never weaken a check to make it pass: no `any`, no `@ts-ignore`, no `eslint-disable`, no skipped or deleted tests, no loosened assertions.
- If a requirement is ambiguous, list the options with trade-offs and ask. Do not choose silently.
- When finished: run this phase's Acceptance Gate commands and paste the real output, update PROGRESS.md (built, decisions, TODO_VERIFY items, known gaps), and list every file you changed.
```

---

## 3. Utility prompts

**Fix prompt** (use whenever a command fails):

```text
This failed:
[paste the exact command and the FULL error output]

1. State the root cause in 2–3 sentences before touching any code.
2. Propose the minimal fix. Do not refactor unrelated code. Do not delete/skip tests, loosen types, or disable lint rules.
3. Apply it, re-run the failing command AND the full test suite, and paste the output.
4. If the root cause is a wrong assumption about an external API, re-read the official docs and update the smoke script too.
```

**Review prompt** (before tagging each phase; ideally in a fresh session):

```text
Review the diff since git tag [phase-XX-done] against AGENTS.md and the Phase [N] acceptance criteria. Do not change code.
Check specifically:
- authorization + tenancy scoping on every data access
- zod validation at every boundary (HTTP, webhooks, LLM output, job payloads)
- money as integer paise; no floats
- no hardcoded user-facing strings, rates, coordinates, or dates
- error, loading, empty, offline states in UI
- missing tests or tests that assert nothing meaningful
- security: IDOR, auth bypass, webhook signature verification, rate limits, secrets in code, PII in logs
Output a table: issue | file:line | severity (blocker/major/minor) | proposed fix.
```

**Context handoff prompt** (when a session gets long or confused):

```text
Stop implementing. Write the current state of this phase into PROGRESS.md under "Phase N — in progress": completed tasks, remaining tasks, open decisions, failing tests with their error. Then stop.
```

**Unstuck prompt** (when the agent loops on the same error):

```text
You have attempted this fix more than twice. Stop. List every assumption you are making about this problem, mark which ones you have actually verified (with the command/doc that verified it), and propose a diagnostic step that tests the weakest assumption. Do not change application code until the diagnostic runs.
```

---

## 4. AGENTS.md — the project constitution (you create this file by hand)

Create `AGENTS.md` at the repo root with the content below. Then:

- **Claude Code:** create `CLAUDE.md` containing the single line `@AGENTS.md`. Claude Code imports the file.
- **Antigravity:** add a workspace rule saying "Always read and follow AGENTS.md at the repository root before any task." Recent versions may also read `AGENTS.md` directly; check in your install.
- Create an empty `PROGRESS.md` with the heading `# Progress`.

```markdown
# Kaithangu — Agent Constitution (binding)

## 1. Product

Cooperative-owned household & community services marketplace for Labour Cooperative Societies (LCS) under Labour Cooperative Federations, built for NCCT / Ministry of Cooperation. Kerala pilot; every state-specific value comes from configuration so other states are added by config, not code.
Users include non-literate people on keypad phones. Every core customer and worker action MUST be possible over a phone call (IVR + voice) without a smartphone.

## 2. Roles

customer, worker, lcs_admin, state_admin, national_admin (NCCT), institution_admin.
Scope hierarchy: national → state → society (LCS). A user with scope X sees only data inside X.

## 3. Locked stack (do not change without human approval)

- Monorepo: Bun workspaces ("workspaces" in root package.json, "packageManager": "bun@<installed version>", lockfile bun.lock committed) + Turborepo. Apps still run on the Node 22 runtime in production (Next.js, Fastify, BullMQ); Bun is the package manager and script runner. TypeScript strict everywhere ("strict": true, "noUncheckedIndexedAccess": true, "exactOptionalPropertyTypes": false).
- Bun command rule: ALWAYS invoke package scripts with `bun run <script>`. Never type `bun test` (runs Bun's built-in test runner, not Vitest) or `bun build` (runs Bun's bundler, not Next/tsup). Use `bunx` instead of `npx`. Do not use Bun-only runtime APIs (Bun.serve, Bun.file, bun:sqlite) in app code; production runs on Node 22.
- Internal packages are just-in-time TS packages: package.json "exports" point to ./src/*.ts. apps/web lists them in `transpilePackages`. apps/voice and apps/jobs run with `tsx` in dev and bundle with `tsup` (noExternal: [/^@kaithangu\//]) for production.
- apps/web: Next.js latest stable (App Router, src/ dir), React Server Components by default, Tailwind CSS v4, next-intl WITHOUT locale-prefixed routing (locale from user profile, else cookie NEXT_LOCALE, else state default), MapLibre GL JS with OpenFreeMap tiles, Recharts, lucide-react icons. Hand-written service worker at public/sw.js + manifest.webmanifest; no PWA plugin. If Next.js major ≥ 16: use proxy.ts (not middleware.ts), and treat route params/searchParams as async.
- apps/voice: Node 22, Fastify, @fastify/websocket, @fastify/formbody, twilio SDK. Persistent server, never serverless. System ffmpeg available in its Docker image.
- apps/jobs: Node 22, BullMQ workers (dispatch, notifications, broadcasts, scheduled jobs, view refresh).
- apps/ml: Python 3.12, uv, FastAPI, uvicorn, pandas, numpy, lightgbm, scikit-learn, h3, pydantic, psycopg[binary], pyyaml, pytest.
- packages/db: Drizzle ORM + drizzle-kit, postgres.js driver, PostgreSQL 16 + PostGIS 3. Raw SQL only in packages/db/src/sql/ (PostGIS queries, triggers, views), always parameterized.
- packages/core: pure domain logic + service layer. No imports from next, fastify, bullmq or any adapter implementation (interfaces only).
- packages/adapters: interfaces + implementations for telephony, speech (stt/tts), llm, payments, sms, geocode, storage. Each has `mock` and `real`. Selected by env ADAPTER_MODE (mock|real) with per-adapter overrides (e.g. PAYMENTS_MODE=mock).
- packages/i18n: JSON catalogs en, ml, hi, ta (UI + voice prompts + trade synonyms).
- packages/config: shared tsconfig, eslint flat config (typescript-eslint), prettier.
- Validation: zod. Auth: custom phone OTP + session JWT (jose) in httpOnly cookie. Logging: pino with requestId; phone numbers masked in logs. Tests: Vitest, Playwright, fast-check, pytest.
- Local infra: docker compose with postgis/postgis:16-3.4 and redis:7.

### Allowed dependencies (anything else: ask first)

next, react, react-dom, tailwindcss, next-intl, zod, drizzle-orm, drizzle-kit, postgres, ioredis, bullmq, jose, pino, pino-pretty, fastify, @fastify/websocket, @fastify/formbody, twilio, razorpay, maplibre-gl, recharts, lucide-react, h3-js, @react-pdf/renderer, qrcode, date-fns, date-fns-tz, alawmulaw, papaparse, @faker-js/faker, turbo, typescript, tsx, tsup, vitest, @vitest/coverage-v8, @playwright/test, fast-check, @lhci/cli, typescript-eslint, eslint, prettier, dotenv.

## 4. Architecture rules

1. Business logic lives in packages/core services. Next.js route handlers, voice handlers and jobs are thin: parse input → call service → map result/error.
2. Every service function takes `ctx: RequestContext` first: { actor: { userId, role, societyId?, stateCode?, institutionId? } | { system: true, reason }, requestId, locale }. Services enforce authorization and tenancy themselves using core/authz.ts. No tenant-data query without a scope filter.
3. Validate with zod at every boundary: HTTP bodies/params, webhooks, LLM outputs, job payloads, CSV uploads, env.
4. Errors: services throw AppError(code, httpStatus, messageKey, details?). messageKey is an i18n key. Handlers map AppError to responses; unknown errors → 500 with requestId, full error only in logs.
5. External services only through packages/adapters. With ADAPTER_MODE=mock the entire system must run offline with no API keys.
6. Webhooks (Twilio, Razorpay) verify signatures using the exact public URL. Webhook handlers and payment operations are idempotent (idempotency key stored in DB).
7. API routes live under /api/v1. JSON responses: { data } or { error: { code, messageKey, requestId } }.

## 5. Data rules

- Money: integer paise (DB bigint). Use core/money.ts helpers only. Rounding: half-up to the paisa. Never floats for money.
- Time: timestamptz in UTC; display in Asia/Kolkata via date-fns-tz.
- Phone: E.164 (+91XXXXXXXXXX), normalised by core/phone.ts.
- Location: geometry(Point, 4326). Distances via ST_DWithin(a::geography, b::geography, meters) and ST_Distance(...::geography).
- IDs: uuid default gen_random_uuid().
- Never store Aadhaar numbers, bank account numbers, card numbers, or raw OTPs. OTPs are hashed (SHA-256 with server pepper) with TTL.
- ledger_entries is append-only and hash-chained; a DB trigger rejects UPDATE and DELETE.
- Schema changes only through drizzle-kit migrations committed to the repo. Never edit an applied migration.
- NEVER invent real-world data (coordinates, pincodes, wage rates, scheme rules, festival dates, society registration numbers). Use provided data files and config tables. When a value is missing, insert a placeholder marked TODO_VERIFY (column is_placeholder=true where applicable) and list it in PROGRESS.md. Demo entities (societies, workers) are fictional and labelled "Demo".

## 6. Canonical domain rules (all phases must follow exactly)

### 6.1 Trades

plumber, electrician, carpenter, painter, domestic_help, caregiver, driver, gardener, cleaner, technician. certified_required = true for electrician and technician.

### 6.2 Pricing (per state config)

state_trade_rates(state_code, trade_code, wage_floor_per_hour_paise, min_billable_minutes, visit_charge_paise, emergency_surcharge_pct, is_placeholder).
state_config(state_code, welfare_pct, platform_fee_pct, gst_pct_on_platform_fee, default_locale, locales[], timezone, active).

- billable_minutes = max(min_billable_minutes, estimated_minutes)
- wage = ceil(billable_minutes × wage_floor_per_hour_paise / 60) + visit_charge_paise
- emergency: wage += round(wage × emergency_surcharge_pct / 100) (the surcharge goes 100% to the worker)
- welfare = round(wage × welfare_pct / 100)
- platform_fee = round(wage × platform_fee_pct / 100)
- gst = institution invoices only: round(platform_fee × gst_pct_on_platform_fee / 100)
- customer_total = wage + welfare + platform_fee + gst
- The worker's entitlement is 100% of wage. Welfare is an employer-style contribution added on top, never deducted from wage.
- Invariant (property-tested): wage + welfare + platform_fee + gst = customer_total; all parts ≥ 0.

### 6.3 Matching

Hard filters (SQL): worker.status = 'verified'; has the trade; available = true; no booking in (accepted, en_route, in_progress); distance ≤ worker.service_radius_km; (bayesian rating ≥ 3.5 OR rating_count < 5); for certified_required trades, skill.certified = true.
Score (TS, core/matching/score.ts):

- proximity = 1 − distance_km / service_radius_km (clamped 0..1)
- skill_fit = skill_level / 3 (levels 1..3)
- bayesian_rating = (5 × society_mean + rating_sum) / (5 + rating_count); rating_norm = (bayesian_rating − 1) / 4
- fairness_boost = median_30d > 0 ? clamp((median_30d − worker_30d) / median_30d, 0, 1) : (worker_30d == 0 ? 1 : 0), where earnings are 30-day wage totals among verified workers of the same society and trade
- normal score = 0.35·proximity + 0.25·skill_fit + 0.15·rating_norm + 0.25·fairness_boost
- emergency/disaster score = 0.70·proximity + 0.20·skill_fit + 0.10·rating_norm
- tie-break: oldest last_job_completed_at first (null first), then worker id
  Every offer stores the full score breakdown and an explanation i18n key + params ("why this worker").

### 6.4 Dispatch

- Normal: sequential offers to top 5 candidates, OFFER_TIMEOUT_SECONDS (default 45) each. Channel: IVR call if worker.has_smartphone = false; otherwise in-app + SMS, escalating to IVR after 20 s without response.
- Emergency: parallel offers to top 3; first accept wins.
- Accept is atomic: UPDATE bookings SET worker_id = $w, status = 'accepted' WHERE id = $b AND status = 'offered' RETURNING id; plus Redis SET NX lock booking:{id}:accept (TTL 30 s) for parallel offers. Losers get a "job already taken" message.
- All candidates exhausted → status 'unassigned', lcs_admin alerted, manual assign available.
- Scheduled bookings: matching starts 60 min before scheduled_for.

### 6.5 Booking state machine

requested → matching → offered → accepted → en_route → in_progress → completed
matching|offered → unassigned → offered (manual assign)
requested|matching|offered|unassigned|accepted|en_route → cancelled
completed → disputed → resolved
Any other transition throws AppError('INVALID_TRANSITION'). Every transition writes booking_events(actor, from, to, at, meta).

### 6.6 Job OTPs

On accept, generate a 4-digit start_otp and complete_otp; send them to the customer (SMS + read in status call); store hashes. The worker enters them (PWA keypad or IVR DTMF). Max 5 attempts each, then lock + alert the lcs_admin.

### 6.7 Ledger

ledger_entries(id bigserial, account text, booking_id, amount_paise bigint, direction 'credit'|'debit', kind, created_at, prev_hash, hash).
Accounts: worker:{id}, welfare:{society_id}, platform, society:{id}, cash_offset:worker:{id}.

- UPI captured: credit worker wage, credit welfare, credit platform fee (+ gst to platform:gst).
- Cash: worker collected customer_total → credit worker wage, record debit on cash_offset:worker:{id} for welfare + platform_fee (+ gst) owed; recovered from future digital payouts.
- hash = sha256(prev_hash || canonical_json(entry without hash)). Genesis prev_hash = 64 zeros. Entries are written inside a transaction that locks the chain head (SELECT ... FOR UPDATE on ledger_head).

### 6.8 Fairness metric

Gini coefficient of 30-day wage earnings among verified workers, per society (and per trade). Also report % of verified workers with zero jobs in 30 days.

### 6.9 Voice

- The LLM only extracts structured data validated by zod. It never sets prices, picks workers, or confirms bookings.
- Every voice step has a DTMF fallback. Two failed understandings at a step → that step switches to a DTMF menu.
- Always read back and require explicit confirmation (press 1) before creating a booking.
- Pincodes and OTPs are collected by keypad (DTMF), never by speech.
- Store transcripts. Raw audio is kept only if consent was recorded, max 30 days; otherwise recordings are deleted after transcription.
- All prompts are i18n keys in packages/i18n (voice namespace).

## 7. UX rules (low-literacy, low-end devices)

- Mobile-first at 360×640. Touch targets ≥ 48 px. Body text ≥ 16 px. Every primary action has an icon, a text label, and an audio button that plays the label.
- No user-facing string in code. Test Malayalam for overflow.
- First-load JS ≤ 150 KB gzipped for /app and /w routes. Must be usable on slow 3G.
- Every screen has loading, empty, error, and offline states.
- WCAG 2.1 AA contrast. Load only the active locale's Noto font.

## 8. Definition of done (every task)

typecheck, lint, unit tests and the phase's integration/e2e tests pass; new logic has tests (packages/core ≥ 90% line coverage); PROGRESS.md updated; no TODOs except TODO_VERIFY data placeholders.

## 9. Commands (must keep working)

bun run dev · bun run build · bun run typecheck · bun run lint · bun run test · bun run test:e2e · bun run db:migrate · bun run db:seed · bun run db:reset · bun run voice:sim · bun run voice:eval · bun run smoke:<name> · bun run demo:reset

## 10. Repo layout

kaithangu/
AGENTS.md CLAUDE.md PROGRESS.md README.md
apps/web apps/voice apps/jobs apps/ml
packages/core packages/db packages/adapters packages/i18n packages/config
data/raw data/seed
scripts/smoke scripts/sim scripts/demo
tests/voice-corpus tests/field
docs/
docker-compose.yml turbo.json .env.example (workspaces declared in root package.json)
```

---

## Phase 1 — Scaffold & tooling

**Before you start:** `AGENTS.md`, `CLAUDE.md`, and `PROGRESS.md` exist, Docker is running, and the repo is empty otherwise.

```text
PHASE 1 — Monorepo scaffold, tooling, local infra, CI.

Goal: a working monorepo skeleton. `bun run dev` starts web (3000), voice (4000), jobs, and ml (8000); docker compose provides Postgres+PostGIS and Redis; CI runs typecheck, lint and tests. No product features yet.

Tasks:
1. Root: package.json with "workspaces": ["apps/*", "packages/*"] and "packageManager": "bun@<version from `bun --version`>"; internal deps referenced as "workspace:*"; turbo.json with tasks build, dev (persistent, no cache), lint, typecheck, test, test:e2e. Root package.json scripts proxy to turbo. .nvmrc = 22. .gitignore (node_modules, .next, dist, .env*, !.env.example, coverage, playwright-report, data/raw/*, !data/raw/.gitkeep, __pycache__, .venv, models/).
2. packages/config: tsconfig.base.json (strict, noUncheckedIndexedAccess, moduleResolution "bundler", target ES2022), eslint flat config using typescript-eslint recommendedTypeChecked, prettier config. Every package extends these.
3. apps/web: create with create-next-app (TypeScript, Tailwind, ESLint, App Router, src dir, import alias @/*). Check the installed Next.js major and record it in PROGRESS.md; follow AGENTS.md rules for Next ≥ 16. Add transpilePackages for @kaithangu/*. Add GET /api/health returning { ok, version, db: "up"|"down", redis: "up"|"down" } with real connectivity checks and a 1 s timeout each.
4. packages/core, packages/db, packages/adapters, packages/i18n: package.json name @kaithangu/<name>, exports "./src/index.ts", a trivial exported function each with one Vitest test.
5. apps/voice: Fastify server with GET /health, graceful shutdown on SIGTERM, pino logging with requestId. Dev via tsx watch, build via tsup bundling @kaithangu/* (noExternal).
6. apps/jobs: BullMQ worker process with a "heartbeat" queue that logs every 60 s; connection from REDIS_URL; graceful shutdown.
7. apps/ml: uv project (Python 3.12), FastAPI app with GET /health, pytest with one test. Script `bun run --filter ml dev` runs uvicorn on 8000 (add a package.json in apps/ml that shells to uv so turbo can run it).
8. docker-compose.yml: postgis/postgis:16-3.4 (port 5432, db kaithangu, init SQL in infra/db/init.sql creating extensions postgis and pgcrypto; also create database kaithangu_test), redis:7 (6379), named volumes, healthchecks.
9. Env handling: .env.example listing EVERY variable with comments: NODE_ENV, DATABASE_URL, DATABASE_URL_TEST, REDIS_URL, SESSION_SECRET, OTP_PEPPER, ADAPTER_MODE, TELEPHONY_MODE, SPEECH_MODE, LLM_MODE, PAYMENTS_MODE, SMS_MODE, PUBLIC_BASE_URL, VOICE_PUBLIC_URL, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, SARVAM_API_KEY, LLM_PROVIDER, LLM_API_KEY, LLM_MODEL, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, ML_SERVICE_URL, STORAGE_DIR, DEFAULT_STATE, OFFER_TIMEOUT_SECONDS, DEV_INBOX, DEMO_PINCODE, MY_TEST_PHONE. Each app has src/env.ts that parses process.env with zod and fails fast with a readable message listing missing vars. Mode vars default to ADAPTER_MODE when unset.
10. Vitest workspace config at root; coverage via @vitest/coverage-v8.
11. GitHub Actions .github/workflows/ci.yml: on push/PR; services postgis/postgis:16-3.4 and redis:7; steps: setup Bun with oven-sh/setup-bun, bun install --frozen-lockfile, typecheck, lint, test; separate job for apps/ml with uv + pytest.
12. README.md quickstart (prereqs, docker compose up -d, cp .env.example .env, bun install, bun run dev, health URLs). docs/architecture.md with the layer description from AGENTS.md.

Constraints: no product code, no auth, no schema beyond extensions. Do not add dependencies outside AGENTS.md.

Acceptance Gate (paste real output):
- docker compose up -d && docker compose ps  → both healthy
- bun install && bun run typecheck && bun run lint && bun run test  → all green
- bun run dev, then: curl localhost:3000/api/health ; curl localhost:4000/health ; curl localhost:8000/health  → all ok, web shows db "up" and redis "up"
- stop Redis (docker compose stop redis) → web health shows redis "down" without crashing
- CI workflow file validated (act or push to a branch) and green
Update PROGRESS.md.
```

---

## Phase 2 — Database schema, migrations, seed data

**Before you start:** `data/raw/pincodes.csv` is in place. Write whatever Kerala wage values you have into `data/seed/kerala_rates.yaml`, and put `TODO_VERIFY` where you don't have a value.

```text
PHASE 2 — Database schema, migrations, triggers, seed.

Goal: complete schema for the whole product (so later phases rarely migrate), deterministic seed data for a Kerala demo, and integration tests proving PostGIS and ledger rules work.

Schema (Drizzle, packages/db/src/schema/*.ts, one file per area; enums as pgEnum):
- states(code pk 'KL'|'TN'…, name_key, active bool)
- state_config(state_code pk fk, welfare_pct numeric(5,2), platform_fee_pct numeric(5,2), gst_pct_on_platform_fee numeric(5,2), default_locale, locales text[], timezone, is_placeholder bool)
- state_trade_rates(state_code, trade_code, wage_floor_per_hour_paise bigint, min_billable_minutes int, visit_charge_paise bigint, emergency_surcharge_pct numeric(5,2), is_placeholder bool, pk(state_code, trade_code))
- trades(code pk, certified_required bool, icon, sort_order)  — names come from i18n keys trade.<code>
- federations(id, state_code, name, level enum national|state, parent_id nullable)
- societies(id, federation_id, state_code, name, district, reg_no nullable, location geometry(Point,4326), is_demo bool)
- pincodes(pincode, office_name, district, state_name, location geometry(Point,4326)) — index on pincode
- users(id, phone unique E.164, name, role enum, locale, state_code, society_id nullable, institution_id nullable, session_version int default 0, created_at, last_login_at)
- consents(id, user_id, purpose enum platform_terms|call_recording|data_processing, version, channel enum web|voice, accepted_at, evidence jsonb)
- addresses(id, user_id, label, address_text, pincode, location geometry, created_at)
- workers(user_id pk fk users, society_id, status enum pending|verified|suspended, service_radius_km numeric(4,1) default 8, home_location geometry, available bool default false, available_updated_at, has_smartphone bool, rating_sum int default 0, rating_count int default 0, last_job_completed_at nullable, eshram_uan nullable, qr_key_version int default 1, photo_url nullable, verified_by nullable, verified_at nullable)
- worker_skills(worker_id, trade_code, level smallint 1..3, years int, certified bool, source enum roster|voice_interview|certificate|admin, verified bool, pk(worker_id, trade_code))
- institutions(id, name, type enum school|panchayat|hospital|office|other, gstin nullable, state_code, address_text, location geometry)
- bookings(id, customer_id, institution_id nullable, state_code, society_id nullable, worker_id nullable, trade_code, problem_text, problem_summary_en nullable, source enum pwa|voice|institution|admin|ondc, urgency enum normal|emergency, disaster_event_id nullable, scheduled_for nullable, estimated_minutes int, location geometry, address_text, pincode, status enum (per AGENTS.md 6.5), quote jsonb (full breakdown), wage_paise, welfare_paise, platform_fee_paise, gst_paise, total_paise, start_otp_hash, complete_otp_hash, otp_attempts smallint, started_at, completed_at, cancelled_reason, created_at, updated_at)
- booking_offers(id, booking_id, worker_id, rank, channel enum app|sms|ivr, score numeric(6,4), breakdown jsonb, explanation_key, explanation_params jsonb, offered_at, expires_at, responded_at, response enum accepted|declined|timeout|superseded nullable)
- booking_events(id bigserial, booking_id, actor_user_id nullable, actor_system text nullable, from_status, to_status, meta jsonb, at)
- payments(id, booking_id, method enum upi|cash, amount_paise, status enum created|captured|failed|refunded, provider_order_id, provider_payment_id, idempotency_key unique, raw jsonb, created_at)
- ledger_head(id smallint pk = 1, last_hash text)
- ledger_entries(id bigserial, account, booking_id nullable, amount_paise bigint check > 0, direction enum credit|debit, kind enum wage|welfare|platform_fee|gst|cash_offset|payout|adjustment, created_at, prev_hash, hash unique)
- ratings(booking_id pk, stars smallint 1..5, comment_text, channel enum app|voice, sentiment enum positive|neutral|negative nullable, flags text[], created_at)
- disputes(id, booking_id, raised_by, reason_code, description, status enum open|investigating|resolved|rejected, resolution_note, created_at, resolved_at)
- welfare_schemes(code pk, state_code nullable, name_key, rules jsonb, is_placeholder bool)
- welfare_enrolments(id, worker_id, scheme_code, status enum interested|submitted|enrolled|rejected, reference nullable, updated_at)
- call_sessions(id, call_sid unique, direction enum inbound|outbound, purpose enum customer_booking|worker_offer|worker_availability|worker_job|onboarding|rating|status_update|broadcast, phone, user_id nullable, locale nullable, state jsonb, transcript jsonb default '[]', outcome, booking_id nullable, started_at, ended_at)
- disaster_events(id, state_code, districts text[], active bool, relief_rate_mode enum normal|no_surcharge, started_by, started_at, ended_at)
- demand_forecasts(id, state_code, h3_cell text, trade_code, date, predicted numeric, lower numeric, upper numeric, model_version, created_at, unique(h3_cell, trade_code, date, model_version))
- festivals(id, state_code, name_key, start_date, end_date, is_placeholder bool)
- idempotency_keys(key pk, scope, response jsonb, created_at)
- invoice_sequences(society_id, fiscal_year, last_number, pk(society_id, fiscal_year)); invoices(id, booking_id nullable, institution_id nullable, society_id, number text unique, fiscal_year, lines jsonb, totals jsonb, pdf_path, issued_at)

Indexes: GIST on every geometry column; bookings(status), bookings(society_id, created_at), bookings(worker_id, status), booking_offers(booking_id), worker_skills(trade_code), workers(society_id, status, available), ledger_entries(account), call_sessions(phone).

Raw SQL migrations (packages/db/src/sql/ applied through drizzle custom migration):
- trigger on ledger_entries rejecting UPDATE and DELETE (raise exception)
- insert ledger_head row with 64 zeros

Seed (packages/db/src/seed/*.ts, deterministic with faker seed 42):
- states KL (active) and TN (inactive); state_config from data/seed/kerala_rates.yaml and data/seed/tamilnadu_rates.yaml (create both YAML files with TODO_VERIFY placeholders and is_placeholder=true where I have not given values; never invent numbers silently — if you must fill a placeholder, use obvious round numbers and flag them).
- trades (AGENTS.md 6.1).
- pincodes: import Kerala rows from data/raw/pincodes.csv using papaparse; skip rows without valid lat/long; log counts. If the file is missing, fail with a clear message. NEVER invent coordinates.
- federations: "NCCT (Demo)" national → "Kerala Labour Cooperative Federation (Demo)" state.
- societies: 5 demo societies — 3 in Ernakulam district, 2 in Kottayam district — each located at the centroid of a real pincode from the imported table (pick pincodes by district from the data, not from memory).
- workers: 500 (100 per society), realistic trade mix, levels, years, 30% has_smartphone=false, home_location = random point within 4 km of the society location (use ST_Project or a proper geodesic offset function in TS with a unit test), statuses mostly verified, some pending.
- demo users with fixed phones documented in docs/demo-accounts.md: customer +919000000001, lcs_admin per society +91900000001X, state_admin +919000000020, national_admin +919000000030, institution_admin +919000000040, plus DEMO_WORKER_PHONE_1/2 from env for the physical keypad phones (verified plumber + electrician near DEMO_PINCODE).
- welfare_schemes: PMSBY, PMJJBY, society_welfare_fund with rules {} and is_placeholder=true.
- festivals from data/seed/festivals.yaml (create the file with TODO_VERIFY entries if absent).

Scripts: bun run db:generate, db:migrate, db:seed, db:reset (drop + migrate + seed; refuses to run when NODE_ENV=production), db:studio.
docs/erd.md: Mermaid erDiagram of the schema.

Tests (integration, against kaithangu_test, each test file resets schema):
- migrations apply cleanly on an empty DB
- UPDATE and DELETE on ledger_entries raise errors
- ST_DWithin candidate query returns workers inside radius and excludes outside (use synthetic fixture coordinates in the test)
- seed is deterministic (same counts and same first worker id on two runs with the same seed)
- geodesic offset helper: point at distance d from origin measures d ± 1% via ST_Distance

Acceptance Gate:
- bun run db:reset → prints counts per table
- bun run test → green (unit + integration)
- PROGRESS.md lists every TODO_VERIFY placeholder
```

---

## Phase 3 — Core domain logic (pure, heavily tested)

```text
PHASE 3 — packages/core domain logic.

Goal: implement the canonical rules in AGENTS.md section 6 as pure, framework-free TypeScript with exhaustive tests. This is the foundation; correctness here matters more than speed.

Modules (packages/core/src):
- money.ts: branded Paise type, add/sub/mulPct (half-up), formatINR(paise, locale) using Intl.NumberFormat en-IN / ml-IN etc.
- phone.ts: normalizeIndianPhone(input) → E.164 or AppError('INVALID_PHONE'); maskPhone().
- errors.ts: AppError class and error code union.
- context.ts: RequestContext type, systemContext(reason).
- authz.ts: policy matrix: can(actor, action, resource) with scope checks (national ⊃ state ⊃ society; worker = own records; customer = own bookings; institution_admin = own institution). Export a typed Action union. Unit test every role × action combination in a table-driven test.
- pricing.ts: quote(input: { rates, stateConfig, estimatedMinutes, urgency, isInstitution }) → { billableMinutes, wage, surcharge, welfare, platformFee, gst, total, breakdownKeys }. Exactly AGENTS.md 6.2.
- matching/score.ts: scoreCandidate(candidate, context, mode) → { score, breakdown, explanation: { key, params } }; rankCandidates() with tie-breaks. Exactly AGENTS.md 6.3.
- fairness.ts: median(), gini() (handles empty and all-zero arrays → 0), zeroJobShare().
- booking/stateMachine.ts: transition table, assertTransition(from, to), allowedNext(from). Exactly AGENTS.md 6.5.
- otp.ts: generateOtp(digits) using crypto.randomInt, hashOtp(otp, pepper), verifyOtp().
- ledger.ts: buildEntriesForUpi(booking), buildEntriesForCash(booking), canonicalJson(), computeHash(prev, entry), verifyChain(entries) → { ok, brokenAtId? }.
- geo.ts: haversineKm (for display/sanity only), destinationPoint(lat, lng, km, bearing).
- index.ts exports.

Tests (Vitest + fast-check):
- pricing: table tests with hand-computed expected values; property tests: parts sum to total, all ≥ 0, emergency total ≥ normal total, monotonic in minutes.
- score: proximity edges (0 km, radius, beyond radius), bayesian rating with 0 ratings, fairness boost when median is 0, emergency weights ignore fairness, deterministic tie-break.
- gini: [] → 0, all equal → 0, one-has-all → (n−1)/n, bounded 0..1 (property).
- state machine: every legal transition passes; every illegal pair throws (generate the full matrix).
- ledger: chain of 100 random entries verifies; altering any field of any entry breaks verification at that id; cash path totals match.
- authz: full matrix.
Coverage for packages/core ≥ 90% lines, enforced in vitest config thresholds.

Constraints: no DB, no network, no framework imports in these modules. Document each module with a short header comment explaining the rule and pointing to the AGENTS.md section.

Acceptance Gate:
- bun run --filter @kaithangu/core test -- --coverage → green, thresholds met
- Show me the pricing output for: plumber, 50 minutes, normal vs emergency, using the seeded KL rates (write a tiny script scripts/sim/quote-example.ts that loads rates from DB and prints both breakdowns).
```

---

## Phase 4 — Auth, RBAC, tenancy, consent, dev inbox

```text
PHASE 4 — Phone OTP auth, sessions, role-based access, tenancy enforcement, consent, dev inbox.

Tasks:
1. packages/adapters/sms: interface SmsAdapter.send({ to, templateKey, params, locale }). mock: pushes { to, text, at } to Redis list dev:inbox (capped 500) and logs. real: leave a stub that throws NOT_CONFIGURED (DLT-registered provider comes later); text is rendered from i18n sms namespace.
2. OTP service (packages/core/services/auth.ts):
   - requestOtp(phone): normalize; rate limit via Redis (3 per phone per 10 min, 20 per IP per 10 min — IP passed from handler); 6-digit OTP; store hash + attempts in Redis key otp:{phone} TTL 300 s; send via SmsAdapter.
   - verifyOtp(phone, code): max 5 attempts then key deleted; on success upsert user (new users → role customer, locale from cookie, state DEFAULT_STATE), update last_login_at.
   - Session: jose JWT HS256 signed with SESSION_SECRET, claims { sub, role, sv: session_version }, 30-day expiry, cookie "kt_session" httpOnly, sameSite=lax, secure in production, path "/". Verify sv against DB on sensitive actions (logout-all bumps session_version).
3. API: POST /api/v1/auth/otp/request, POST /api/v1/auth/otp/verify, POST /api/v1/auth/logout, GET /api/v1/me.
4. getContext() server helper for route handlers/server components: reads cookie, verifies JWT, loads actor scope (society, state, institution), returns RequestContext or null. requireRole(ctx, roles).
5. Route protection in proxy.ts/middleware.ts (per Next major): /app/* customer, /w/* worker, /admin/* lcs_admin|state_admin|national_admin, /org/* institution_admin; unauthenticated → /login?next=…; wrong role → /forbidden. The proxy only checks the JWT signature and role; authorization of data still happens in services.
6. Tenancy: add packages/core/services/workers.ts with listWorkers(ctx, filters) and getWorker(ctx, id) enforcing scope via authz + SQL filters. This is the reference pattern later services copy.
7. Consent: after first login, /consent screen (plain language, audio button, version from i18n) → consents row; required before booking. Voice consent handled in Phase 7.
8. UI: /login (phone input with large keypad-friendly field, +91 fixed prefix), /login/verify (6 separate digit boxes, autofill one-time-code), language picker at first visit (big buttons with native script names: മലയാളം, English, हिन्दी, தமிழ் — each with audio button placeholder).
9. Dev inbox: /dev/inbox page listing SMS messages from Redis, auto-refresh 3 s; enabled only when DEV_INBOX=true; returns 404 otherwise, verified by test.

Tests:
- unit: rate limit, attempt limit, OTP expiry (fake timers), JWT tampering rejected.
- integration: IDOR suite — lcs_admin of society A cannot get/list workers of society B (403/404), state_admin sees all KL societies but not TN, worker cannot list workers, customer cannot access /api/v1/admin/*.
- Playwright e2e (mobile viewport 360×640): pick Malayalam → login → read OTP from /dev/inbox → consent → lands on /app home.

Acceptance Gate:
- bun run test && bun run test:e2e → green
- Manual: log in as each demo role and confirm redirects.
```

---

## Phase 5 — Customer PWA (multilingual, low-literacy, low-end)

```text
PHASE 5 — Customer booking experience in apps/web (/app).

Goal: a customer on a 2 GB Android over slow 3G, possibly unable to read well, can book a verified cooperative worker in under 90 seconds.

i18n:
- packages/i18n catalogs en, ml, hi, ta with namespaces common, trades, booking, status, errors, sms, voice. English is the source; ml/hi/ta values are produced by scripts/i18n/translate.ts using the speech/translate adapter (Sarvam translate in real mode; mock returns "[ml] <english>"). Mark machine-translated keys in a sidecar file needs_review.json so native speakers review them. Never hand-write Malayalam/Hindi/Tamil strings in code.
- Lint check (script) that fails when a catalog is missing keys present in en.

Audio labels:
- scripts/audio/build.ts generates an mp3 per (locale, key) for keys listed in packages/i18n/audio-keys.json using the TTS adapter (mock writes a short silent mp3), output apps/web/public/audio/{locale}/{key}.mp3, skip unchanged (content hash manifest).
- <AudioLabel k="…"/> component: speaker button (48 px), plays the file, no autoplay.

Screens (App Router, server components by default, client components only where interaction requires):
1. /app home: grid of 10 trades (lucide icon + label + audio), "Emergency" red button, "My bookings".
2. Booking wizard /app/book/[trade] (one step per screen, big Back/Next):
   a. Problem: text box + mic button (records up to 30 s with MediaRecorder → POST /api/v1/stt → transcript fills box; hide mic if unsupported). Quick-pick chips per trade from i18n.
   b. Location: "Use my location" (Geolocation) or saved address or pincode + landmark. Show MapLibre map (OpenFreeMap tiles) with a draggable pin; lazy-load map JS only on this step.
   c. When: Now / Emergency / Pick a slot (next 7 days, 2-hour slots 7:00–19:00).
   d. Quote: breakdown from POST /api/v1/quotes — worker wage, welfare contribution (explained: "goes to worker welfare fund"), platform fee, total. Audio button reads the total.
   e. Confirm → POST /api/v1/bookings (idempotency key header) → redirect to tracking.
3. /app/bookings/[id] tracking: vertical status timeline, worker card when assigned (name, society, trade, rating, "Verified by <society>" badge, verification code), start/complete OTPs displayed large, cancel button (allowed states only), polling every 5 s via route handler (no websockets needed).
4. /app/bookings list.
5. Offline: public/sw.js caches app shell, fonts, icons, audio for the active locale (cache-first), API network-first; offline banner component; manifest.webmanifest with icons (generate simple placeholder icons), theme color, display standalone.

API (thin handlers → core services):
- POST /api/v1/quotes {tradeCode, pincode|lat/lng, urgency, estimatedMinutes?} → quote (estimatedMinutes default from trade config).
- POST /api/v1/bookings → creates booking status requested → enqueues "match" job (queue producer only; the consumer is Phase 6; in this phase log the enqueue).
- GET /api/v1/bookings/:id, GET /api/v1/bookings, POST /api/v1/bookings/:id/cancel.
- POST /api/v1/stt (auth required, ≤ 1 MB, audio/webm or audio/ogg) → speech adapter.
All services enforce customer ownership.

Fonts: next/font Noto Sans + Noto Sans Malayalam/Devanagari/Tamil, load only the active locale's font.

Tests:
- unit/integration for booking service (ownership, validation, idempotency, state transitions on cancel).
- Playwright e2e on mobile emulation (Pixel 5 profile, network throttled to slow 3G via CDP) in ml and en: full booking to tracking page; cancel flow; offline banner appears when offline.
- Lighthouse CI (@lhci/cli) against production build for /app and /app/book/plumber with mobile preset: performance ≥ 85, accessibility ≥ 95, best-practices ≥ 90.
- Bundle check: script parses Next build output; fail if first-load JS for /app routes > 150 KB gzipped.

Acceptance Gate:
- bun run test && bun run test:e2e && bun run lhci → green with scores shown
- Screenshots of each step in ml at 360×640 saved to docs/screens/ (via Playwright) — check no Malayalam overflow.
```

---

## Phase 6 — Dispatch engine, worker app, job execution

```text
PHASE 6 — Matching + dispatch (apps/jobs), worker PWA (/w), job OTP flow, minimal LCS admin assignment.

Matching & dispatch:
1. packages/db/src/sql/candidates.sql: parameterized query applying AGENTS.md 6.3 hard filters and returning per candidate: worker id, distance_km, service_radius_km, skill level, certified, rating_sum, rating_count, society_mean_rating, earnings_30d, society_trade_median_30d, last_job_completed_at, has_smartphone. Use CTEs; confirm index usage with EXPLAIN ANALYZE on seeded data and paste the plan into PROGRESS.md.
2. core/services/dispatch.ts: runMatching(ctx, bookingId) → rank via core score → persist booking_offers (top 5 normal / top 3 emergency) → transition to offered → schedule offers.
3. apps/jobs queues: match, offer-timeout, notify, scheduled-match. Offer flow per AGENTS.md 6.4 with delayed jobs; job payloads zod-validated; retries with backoff for notify only (never retry a dispatch decision blindly — make handlers idempotent by checking current DB state first).
4. acceptOffer(ctx, offerId): atomic SQL + Redis SET NX for parallel offers; generates start/complete OTPs, stores hashes, sends OTPs to customer via SmsAdapter; marks other offers superseded; notifies losers.
5. declineOffer / timeout → next candidate; exhausted → unassigned + notify lcs_admin (SMS + admin UI badge).
6. Notification service: channels app (DB-backed notifications table — add migration), sms (adapter), ivr (telephony adapter mock in this phase: logs "would call"). Channel choice per AGENTS.md 6.4.

Worker PWA (/w), same UX rules (icons + audio + big targets):
- Home: huge Available/Not available toggle (updates workers.available, available_updated_at), today's summary.
- Offer card (polling 3 s while available): trade, area (locality from pincode office name), distance, pay (wage only — what the worker earns), countdown ring, Accept / Decline.
- Active job: customer first name, address text, "Open in Maps" (geo URL / Google Maps URL), buttons: I'm on the way (en_route) → Start job (enter start OTP on numeric keypad) → Complete job (enter complete OTP).
- Earnings (30 days, list) — welfare balance placeholder until Phase 9.
- Profile: trades, society, status.

LCS admin minimal (/admin/society/unassigned): list unassigned bookings in scope, candidate list with scores and explanation, manual assign (creates an offer to chosen worker; worker still must accept).

Worker job services: markEnRoute, startJob(otp), completeJob(otp) with attempt limits (AGENTS.md 6.6); completion updates last_job_completed_at and enqueues payment/rating steps (stubs until Phases 8–9).

Tests:
- concurrency: 3 parallel accepts on an emergency booking → exactly one accepted, two superseded (run 50 iterations).
- timeouts: fake timers / short OFFER_TIMEOUT_SECONDS in test env → progression through 5 candidates → unassigned.
- idempotency: processing the same offer-timeout job twice has no double effect.
- fairness smoke: 200 synthetic normal bookings in one society/trade → Gini of assigned earnings lower than a rating-only ranking run on the same inputs (use core functions, no network).
- OTP: wrong OTP 5 times locks; correct OTP transitions states.
- e2e: customer books (Phase 5 flow) → worker (second browser context) sees offer → accepts → customer sees worker card + OTPs → worker starts and completes with OTPs → customer sees completed.

Acceptance Gate:
- bun run test && bun run test:e2e → green
- Paste EXPLAIN ANALYZE of candidates query (should use GIST index; < 50 ms on seed data)
```

---

## Phase 7 — Voice v1: call-based booking and worker IVR (the headline feature)

**Before you start:**

- Twilio account upgraded, India geo permissions on.
- Sarvam and LLM keys in `.env`.
- ngrok/cloudflared URL in `VOICE_PUBLIC_URL`.
- Record 10 test utterances yourselves (Malayalam, Manglish, English) as WAV files into `tests/voice-corpus/samples/`, each with an expected label in `tests/voice-corpus/labels.jsonl`.

```text
PHASE 7 — Voice v1 using Twilio webhooks (record-per-turn), transport-independent dialog engine, voice simulator and evaluator.

Key design (do this exactly): the conversation logic is a pure state machine in packages/core/voice, independent of Twilio. Twilio webhooks (this phase), the simulator (this phase) and realtime media streams (Phase 8) are all just transports that feed it events.

Types (packages/core/voice/types.ts):
- VoiceEvent = { type: 'start' } | { type: 'speech'; transcript: string; confidence?: number; detectedLocale?: string } | { type: 'dtmf'; digits: string } | { type: 'timeout' } | { type: 'hangup' }
- VoicePrompt = { key: string; params?: Record<string, string | number> }
- VoiceTurn = { prompts: VoicePrompt[]; expect: { mode: 'speech' | 'dtmf' | 'speech_or_dtmf'; dtmfDigits?: number; maxSeconds: number } | null; actions: VoiceAction[]; end: boolean }
- VoiceAction = { type: 'createBooking'; payload } | { type: 'acceptOffer'; offerId } | { type: 'declineOffer'; offerId } | { type: 'setAvailability'; available } | { type: 'startJob'; otp } | { type: 'completeJob'; otp } | { type: 'recordConsent'; purpose } | { type: 'setLocale'; locale } | …
- Flow = { id; initial(ctx) → state; step(state, event, deps) → Promise<{ state; turn }> } where deps are injected (services, llm extractor, clock). Actions are executed by the transport layer through core services, and their result is fed back as an event if needed.

Flows (packages/core/voice/flows/*.ts), every prompt an i18n key in the voice namespace:
A. customer_booking:
   1. Language: known caller → use stored locale; else "For Malayalam press 1, English 2, Hindi 3, Tamil 4" (each option spoken in its own language).
   2. Short consent line (terms + recording disclosure) → press 1 to continue → recordConsent.
   3. "What help do you need?" (speech) → LLM extraction (see below).
   4. Missing/low-confidence trade → one clarification question → still unclear → DTMF trade menu (paged: 1–5, 9 for more).
   5. Urgency check if not extracted: "Is this an emergency? press 1 yes, 2 no".
   6. Pincode by keypad (6 digits) → validate against pincodes table → read back office name → confirm 1 / re-enter 2.
   7. Landmark (speech, stored as text; no geocoding of free text).
   8. Time: now / today later / tomorrow (DTMF).
   9. Read quote total (wage explained briefly) → press 1 confirm, 2 repeat, 3 cancel.
   10. createBooking → "We will call you back with the worker's name and code" → end.
B. status_update (outbound after accept): worker name, society, trade, arrival estimate; read start OTP twice; press 1 to repeat.
C. worker_offer (outbound): "New job: <trade>, <locality>, <distance> km, you earn ₹<wage>. Press 1 accept, 2 decline" → accept/decline action → confirm; no input in 20 s → timeout.
D. worker_availability (outbound 07:00 daily for has_smartphone=false workers, and inbound option): press 1 available today, 2 not.
E. worker_job (inbound from a known worker phone): 1 on the way, 2 start job (enter customer's 4-digit start code), 3 complete job (enter completion code), 4 today's earnings.
F. Callback entry: POST /api/v1/voice/callback {phone} (web button + admin demo panel) → rate limited (2 per phone per 10 min) → places outbound call running customer_booking.

LLM extraction (packages/core/voice/extract.ts + adapter):
- Input: transcript, locale, trade catalogue with synonyms from packages/i18n/trade-synonyms.{locale}.json (seed English synonyms; for ml/hi/ta create files containing ONLY what I provide in tests/voice-corpus plus machine translations marked needs_review — never invent Malayalam phrases as ground truth).
- Output zod schema: { tradeCode: TradeCode | null, confidence: number (0..1), urgency: 'normal' | 'emergency' | null, timePreference: 'now' | 'today' | 'tomorrow' | null, problemSummaryEn: string (≤ 140 chars), safetyRisk: boolean, outOfScope: boolean }.
- Invalid JSON or schema failure → one retry with the validation error → then treat as not understood. confidence < 0.6 → clarify. safetyRisk (gas smell, sparks, fire, flooding) → force emergency and speak a safety line (i18n) before continuing.
- Prompt stored in packages/core/voice/prompts/extract.md, versioned; include 8 few-shot examples from the English corpus.

Twilio transport (apps/voice):
- POST /twilio/voice/incoming, /twilio/voice/outbound/:sessionId, /twilio/voice/turn/:sessionId (Gather/Record callbacks), /twilio/voice/status. All validate X-Twilio-Signature with twilio.validateRequest using VOICE_PUBLIC_URL + original path + query (not the internal host). Reject invalid with 403.
- Session state persisted in call_sessions (keyed by CallSid); every webhook loads state, runs flow.step, saves state + transcript turn, returns TwiML.
- Speech input: <Record maxLength="15" timeout="2" playBeep="false" trim="trim-silence" action=".../turn/:id"> ; DTMF: <Gather input="dtmf" numDigits=N timeout="8">. Both prompts and waits are generated from VoiceTurn.expect.
- Fetch the recording with Twilio auth (retry with backoff up to ~3 s because it may not be ready), convert with ffmpeg to the format the Sarvam STT docs require, transcribe, then delete the recording via the Twilio API unless call_recording consent exists.
- TTS: speech adapter returns audio; cache in STORAGE_DIR/tts/{sha256(locale+voice+text)}.wav; serve at GET /audio/:hash.wav; TwiML <Play>. `bun run voice:warm` pre-generates all static prompts for all locales at startup/deploy.
- Outbound calls via telephony adapter (real: Twilio calls.create with url to outbound webhook + statusCallback).
- Wire jobs: IVR channel from Phase 6 now places real worker_offer calls; accept event triggers status_update call to customer.

Smoke scripts (write and RUN each before integrating; read current official docs first):
- smoke:sarvam-stt → transcribes tests/voice-corpus/samples/*.wav, prints transcript + language
- smoke:sarvam-tts → generates ml/en/hi/ta sample WAVs; verify playable
- smoke:llm-extract → runs 5 corpus transcripts, prints validated JSON
- smoke:twilio-call → calls MY_TEST_PHONE and plays one TTS prompt, then hangs up

Simulator & evaluator:
- bun run voice:sim --flow customer_booking --locale ml [--phone +91…] : REPL; type text (speech event) or #digits (dtmf) or /timeout; prints prompts as text (and file path of TTS audio in real mode); executes actions against the dev DB.
- bun run voice:sim --script tests/voice-scripts/*.yaml : scripted dialogs with expected prompts/actions (used in CI with mock adapters).
- bun run voice:eval : for each labels.jsonl row (audio or text, locale, expected {tradeCode, urgency, outOfScope}) → STT (if audio) → extract → metrics per locale: trade accuracy, urgency accuracy, out-of-scope detection, avg latency per stage; writes reports/voice-eval-YYYYMMDD.md. Never overwrite previous reports.

Tests:
- scripted dialog tests for every flow, including: silence ×2 → DTMF fallback, wrong pincode, cancel at quote, safety-risk utterance forces emergency, unknown caller language menu, known caller skip, worker timeout, invalid start OTP.
- webhook signature test (valid passes, tampered fails).
- idempotency: Twilio retrying the same webhook doesn't double-create a booking (use CallSid + turn index as idempotency key).

Acceptance Gate:
- all smoke scripts succeed with real keys (paste output)
- bun run test (mock mode) green including voice scripts
- LIVE: callback to a team phone → book a plumber in Malayalam end to end → keypad phone (DEMO_WORKER_PHONE_1) rings → press 1 → customer gets status call with OTP → booking visible in /app tracking. Record a screen+audio video of this for the demo backup.
- bun run voice:eval report attached; note accuracy honestly.
```

---

## Phase 8 — Voice v2: realtime conversation, voice onboarding, voice rating

```text
PHASE 8 — Realtime voice over Twilio Media Streams (behind a flag), worker voice onboarding interview, post-job voice rating with safety flagging.

Realtime transport (apps/voice/src/realtime):
1. TwiML <Connect><Stream url="wss://…/twilio/media/:sessionId"> for flows where VOICE_MODE=realtime (per-flow env override); webhook mode stays as fallback and is the default until latency targets are met.
2. WebSocket handler: parse Twilio media stream events (connected, start, media, mark, stop) per the official docs; decode μ-law 8 kHz with alawmulaw.
3. Turn detection: energy-based VAD (frame 20 ms, threshold calibrated from first 300 ms of noise, speech end after 700 ms silence, max utterance 15 s). If Sarvam offers a streaming STT API, evaluate it with a smoke script first and use it only if the smoke test proves it works with 8 kHz telephony audio.
4. Audio out: TTS → resample to 8 kHz mono → μ-law → base64 20 ms frames → send media messages; send mark after each prompt.
5. Barge-in: if speech starts while playing, send a "clear" message to stop playback, then process the new utterance.
6. DTMF events from the stream map to dtmf VoiceEvents.
7. Same packages/core/voice flows — zero flow logic in the transport.
8. Metrics per turn: speech_end → stt_done → extract_done → tts_first_byte → playback_start; log and store in call_sessions.transcript entries.

Worker onboarding interview (flow: onboarding):
- Entry: missed-call/callback from an unknown number choosing "I am a worker", or LCS admin triggers "call this worker" from the console.
- Questions (each speech, with DTMF fallback where possible): name; which society (DTMF menu of societies in caller's district, or "don't know"); trades; years of experience; areas/pincode (DTMF); keypad or smartphone (DTMF); consent to profile creation.
- LLM extraction to zod { name, trades: [{ tradeCode, years, selfLevel }], pincode, hasSmartphone } → create user (role worker) + workers status=pending + worker_skills source=voice_interview verified=false.
- Admin verification queue (/admin/society/verification): transcript, extracted fields editable, approve/reject, set certified flag only with an uploaded certificate reference.

Voice rating (flow: rating), scheduled 30 min after completion for customers who booked by voice or have no app activity:
- "Rate from 1 to 5 on the keypad" → "Tell us anything about the service" (speech, optional).
- LLM classify comment → { sentiment, flags: subset of [no_show, late, overcharge, rude, harassment, theft, damage, safety] }.
- harassment|theft|safety → auto-create dispute (status open), notify lcs_admin immediately (SMS + console alert), and suspend new offers to that worker pending review (status stays verified; add workers.offer_hold boolean via migration). Other flags just stored.
- Update rating_sum/rating_count atomically.

Tests:
- VAD unit tests with generated PCM (silence, tone bursts, speech-like noise).
- μ-law encode/decode round-trip tests.
- flow tests for onboarding and rating (scripted).
- dispute auto-creation and offer_hold effect on matching.

Acceptance Gate:
- latency report over 20 live realtime turns: median end-of-speech → first audio < 2.0 s (report actual numbers; if not met, keep webhook mode as default and say so)
- live onboarding call creates a pending worker visible in the verification queue
- live rating call with "he was rude and asked for extra money" creates flags rude+overcharge (no dispute), and a harassment comment creates a dispute + hold
```

---

## Phase 9 — Payments, welfare ledger, invoices, trust layer

```text
PHASE 9 — UPI payments with splits, cash handling, hash-chained ledger, welfare & insurance enrolment tracking, invoices, QR worker ID.

Payments (packages/adapters/payments):
- Interface: createOrder({ bookingId, amountPaise, splits: [{ account, amountPaise }] }), verifyWebhook(rawBody, signature), fetchPayment(id).
- real: Razorpay — read current Orders, Checkout and Route docs first; write smoke:razorpay (create test order, fetch it). Splits: society linked account receives wage + welfare (the cooperative pays its member — realistic), platform account keeps platform fee (+gst). If Route is not activated yet, real adapter creates orders without transfers and logs PENDING_ROUTE; mock adapter simulates everything.
- Customer pay screen after completion: UPI via Razorpay Checkout (script loaded only on this page) or "Paid in cash" (worker confirms cash received from the worker app; customer confirms in app or via voice rating call "press 1 if you paid in cash").
- POST /api/v1/payments/webhook: verify signature on raw body, idempotency via idempotency_keys, on payment.captured → payments captured → ledger entries (AGENTS.md 6.7) → booking stays completed; enqueue rating.

Ledger service (core/services/ledger.ts):
- appendEntries(ctx, entries) inside a transaction: SELECT … FROM ledger_head FOR UPDATE → compute hashes sequentially → insert → update head.
- balances(account) and statement(account, range).
- verifyChain() streaming through all entries; GET /api/v1/admin/ledger/verify → { ok, checked, brokenAtId? } (national/state admin only).
- Cash offsets: when a worker with outstanding cash_offset gets a UPI job, the next payout statement shows the deduction (record as adjustment entries). Never let worker net wage go below 0 for a job; carry the remainder.

Welfare & insurance:
- Worker app "My welfare": welfare contributions (sum of welfare credits attributed to the worker's jobs — attribution stored in entry meta), scheme cards (PMSBY, PMJJBY, society fund) with status. Scheme rules come from welfare_schemes (placeholders flagged) — UI must show "Eligibility to be confirmed by your society" while is_placeholder=true. Never claim a worker is insured unless status = enrolled and set by an admin with a reference.
- LCS admin: enrolment pipeline board (interested → submitted → enrolled/rejected).
- Monthly voice summary job for keypad workers: "This month you earned ₹X; ₹Y was added to your welfare fund".
- e-Shram UAN field: format-only validation (store TODO_VERIFY note on the exact format in PROGRESS.md).

Invoices:
- Gapless numbering per society per fiscal year (April–March, IST): row-locked invoice_sequences; number format <SOCIETYCODE>/<FY>/<000123>.
- PDF via @react-pdf/renderer with Noto fonts for the customer's locale + English; lines: wage, welfare contribution, platform fee, GST (institutions only, with GSTIN fields). Stored in STORAGE_DIR/invoices; download link in customer and institution views.

QR worker ID:
- Signed token (jose, claims { wid, v: qr_key_version }, no expiry in token; validity checked live). Public page /verify/[token]: photo placeholder, name, society, trades, status (verified/suspended), "checked at <time>". Rotating qr_key_version invalidates old cards.
- Printable ID card page for LCS admin (A6, QR + name + society).
- Spoken 6-digit verification code per booking (random, stored hashed on booking) shown to customer and spoken to worker; customer can ask the worker to say it.

Tests:
- split & ledger: UPI and cash paths produce balanced, expected entries; property test on random bookings.
- tamper test: in the test DB, disable the trigger as superuser, alter one amount, re-enable → verifyChain reports that id.
- webhook: bad signature 400, replay does nothing, out-of-order events handled.
- invoice numbering: 50 concurrent invoice creations → numbers unique and gapless.
- QR: revoked version shows invalid; suspended worker shows suspended.

Acceptance Gate:
- bun run test && bun run test:e2e green (e2e: book → complete → pay (mock) → ledger shows 3 entries → worker welfare screen updated)
- smoke:razorpay output
- /admin/ledger/verify returns ok on seeded + demo data
```

---

## Phase 10 — Federation administration console

```text
PHASE 10 — Three-level admin console (/admin) for national (NCCT), state federation, and LCS admins.

Layout: sidebar (collapses on mobile), scope breadcrumb (National › Kerala › <Society>) — national/state admins can drill down; lcs_admin fixed to own society. All data through scoped services; aggregates via SQL views/materialized views in packages/db/src/sql/views/*.sql refreshed every 5 min by an apps/jobs repeatable job (REFRESH MATERIALIZED VIEW CONCURRENTLY with unique indexes).

Pages:
1. Overview: KPI cards (bookings today/7d/30d, completion rate, median time-to-accept, active verified workers, available now, utilisation = booked hours / available hours, welfare fund total, open disputes); trend charts (Recharts).
2. Live map: MapLibre with H3 hexagons (h3-js, resolution 7) — layers: demand (bookings 7d), unmet demand (unassigned/cancelled-before-assign), supply (available workers), forecast (Phase 11) toggle; click hex → breakdown by trade. Aggregation server-side; send GeoJSON only for visible bounds.
3. Workers: roster table (filters: trade, status, availability, society), verification queue (from Phase 8), bulk CSV roster upload with dry-run validation report (row errors listed) then commit; worker detail with skills, ratings, earnings, welfare, offer history with "why offered/not offered".
4. Bookings: filterable table, detail with event timeline, offers with score breakdown, manual assign for unassigned.
5. Fairness: per society/trade Gini trend (30-day rolling), earnings distribution histogram, zero-job share, top/bottom decile comparison; "Fairness proof" panel placeholder for Phase 11 simulation.
6. Welfare: fund balances per society, contributions trend, enrolment pipeline counts.
7. Disputes: queue with SLA timers, resolve/reject with note (writes booking transition disputed → resolved).
8. Surplus & transparency: per society revenue (wages paid, welfare, platform fees), cost placeholders, surplus — a member-facing summary view printable as PDF.
9. Ledger integrity: button calling verify endpoint, shows "Chain intact — N entries checked" or the broken entry.
10. Settings (national only): states activation, state_config and rates editor with audit log (every change stored with who/when/old/new; placeholders highlighted).

Exports: CSV for tables (streamed).

Tests:
- e2e per role: lcs_admin sees only own society; state_admin cannot see TN; national sees all; scope switcher works.
- view refresh job test; aggregates match raw-count queries on seed data.
- performance: with 12 months synthetic data (Phase 11 generator can run early — if not available, generate 50k bookings with a quick TS script), overview and map endpoints respond < 800 ms p95 locally (measure with autocannon-like loop in a script, report numbers).

Acceptance Gate: tests green; screenshots of each page for each role in docs/screens/admin/.
```

---

## Phase 11 — AI: synthetic history, demand forecasting, fairness proof, workforce advice

```text
PHASE 11 — apps/ml forecasting service and simulations. Be scientifically honest: synthetic data is labelled synthetic, metrics are reported as they are.

1. History generator (scripts/sim/generate_history.py, run via uv):
   - Inputs: seeded societies/workers from DB, data/seed/seasonality.yaml (create it: per-trade monthly multipliers, weekday pattern, festival window multipliers per trade, wedding-season multipliers — all values marked as assumptions), festivals table, optional data/raw/rainfall_*.csv (if absent, use a smooth synthetic monsoon curve flagged synthetic_rainfall=true), random seed.
   - Output: 12–18 months of bookings (with outcomes, ratings, payments, ledger entries through core rules — call a TS script via subprocess or write via a dedicated bulk-insert path that reuses the same pricing numbers), every row is_synthetic=true (add column via migration to bookings, payments, ratings; ledger entries carry meta.synthetic=true).
   - Deterministic with seed; a summary JSON of generated volumes per month/trade.
2. Forecasting (apps/ml):
   - Grain: (h3 cell res 7, trade, day). Features: day of week, month, day of year (sin/cos), festival window flag, rainfall (actual or synthetic), lags 7/14/28, rolling mean 7/28, cell and trade as categorical.
   - Model: single LightGBM regressor (Poisson/Tweedie objective), time-based split with last 8 weeks holdout. Baselines: seasonal naive (same weekday last week) and 4-week moving average. Metrics: MAE, WAPE, per trade.
   - Prediction intervals: quantile models (alpha 0.1, 0.9) or residual-based — document the method.
   - Artifacts: models/<version>/model.txt + metrics.json + feature list. model_version = date + git short sha.
   - API: POST /train (admin token), POST /forecast { state_code, horizon_days ≤ 14 } → writes demand_forecasts, GET /metrics/latest. Nightly job in apps/jobs calls /forecast.
3. Workforce advice (core service using forecasts): per society × trade × next 14 days compare forecast demand hours vs expected available worker-hours (from historical availability rates) → recommendations with numbers ("Expected shortfall of ~14 plumber-hours on Aug 22–24 in Kakkanad cells; 5 plumbers from <society> had < 2 jobs last week — ask them to mark available"). Rule-based, explainable, shown in admin Overview and Map (forecast layer).
4. Fairness proof (scripts/sim/fairness_sim.ts, uses core scoring):
   - Replay the same synthetic booking stream through two policies: A = rating-first greedy (closest among top-rated), B = Kaithangu score.
   - Metrics per society/trade: Gini of earnings, zero-job share, average customer distance, average rating of assigned worker, median time-to-accept (from simulated acceptance probability model — document assumptions).
   - Output reports/fairness-sim.json → admin Fairness page "Fairness proof" chart (A vs B bars) with an "assumptions" disclosure.
5. Admin UI badges: any chart backed by synthetic data shows "Synthetic data (pilot pending)".

Tests: pytest for feature building (no leakage: features at day t use only data < t — explicit test), train/predict on a tiny fixture, API contract tests; TS tests for workforce advice and fairness sim determinism.

Acceptance Gate:
- reports/forecast-metrics.md with model vs baselines per trade (honest numbers)
- reports/fairness-sim.json and screenshot of the Fairness proof chart
- forecast layer visible on the admin map
```

---

## Phase 12 — Disaster mode, institutions, live state switch, ONDC prototype

```text
PHASE 12 — Community/disaster relief mode, institutional bookings, multi-state proof, ONDC-compatible catalogue prototype.

Disaster / community mode:
- national/state admin activates a disaster_event for selected districts (multi-select from districts present in societies/pincodes), with relief_rate_mode.
- Effects while active: bookings located in those districts use emergency weights (AGENTS.md 6.3) with no surcharge if relief_rate_mode = no_surcharge; banner in customer app for users in those districts; relief board page (/admin/relief) with map of requests and responders.
- Broadcast: admin selects trades + districts → jobs place voice calls (flow: broadcast — "Relief work needed near <locality>; press 1 if you can help today") to verified workers in scope, rate-limited (BROADCAST_CALLS_PER_MINUTE, default 20), skipping 21:00–07:00 unless flagged urgent; responses set available=true and tag worker as relief responder for the event.
- Bulk relief requests: panchayat/institution_admin creates "N workers × trade × days at location" → system creates N linked bookings and dispatches them.
- Deactivate → summary report (requests, workers mobilised, hours, completion) as PDF.

Institutions (/org):
- Onboarding: institution details, GSTIN (format validation only), members (invite by phone).
- Recurring bookings (weekly/monthly cleaning, gardening): recurrence rule stored, jobs creates bookings 24 h ahead.
- Bulk request form; consolidated monthly invoice with GST on platform fee (Phase 9 invoice engine).

Live state switch (multi-state proof):
- TN config fully seeded (ta locale, rates/schemes placeholders flagged, 2 demo societies in TN districts at real pincode centroids from the dataset — requires TN rows in pincodes.csv).
- national admin toggles state active; customer/worker apps derive default language, rates, schemes, festival calendar from state_config — verify no Kerala-specific value is hardcoded: add a lint/test that fails if the literals 'KL', 'Kerala', or 'ml' appear outside packages/db/src/seed, data/, packages/i18n, or tests.
- Demo panel action: "Switch demo to Tamil Nadu" sets DEFAULT_STATE override in DB (not env) and reloads.

ONDC-compatible catalogue (stretch, clearly labelled prototype):
- Fetch the current ONDC/Beckn services-domain spec from official sources before writing code; list the exact spec version in PROGRESS.md; do not invent fields.
- GET /api/v1/ondc/catalog: services catalogue (trades, society providers, price ranges from quotes, service areas) in that format.
- Mock BAP: /dev/ondc shows a search → on_search round-trip against our endpoint.

Tests: disaster weights applied only inside active districts; broadcast rate limit and quiet hours; recurrence generation idempotent; hardcoded-state test passes; TN customer sees Tamil UI + TN rates.

Acceptance Gate: e2e for relief request → dispatch; demo panel state switch works live; ONDC endpoint validates against the spec's JSON schema if one is published (else document manual validation).
```

---

## Phase 13 — Security and performance hardening

This is your specialisation. Present the threat model and the IDOR suite to judges, not just the features.

```text
PHASE 13 — Security review, fixes, and performance budgets. Findings first, fixes second.

Security:
1. docs/threat-model.md: STRIDE per component (web, voice webhooks, media streams, jobs, ml API, DB, Redis, third parties), data-flow diagram (Mermaid), assets (PII: phone, address, location; money; ledger), trust boundaries, and mitigations mapped to code.
2. Automated checks:
   - route inventory test: enumerate every app/api route handler file; each must call getContext/requireRole (or be on an explicit public allowlist: health, auth, webhooks with signature checks, verify page, ondc catalog). Fails CI on new unprotected routes.
   - IDOR suite expanded to every resource type (bookings, offers, workers, ratings, disputes, invoices, payments, ledger statements, call_sessions) across all roles.
   - rate limits verified: OTP, callback, booking creation, STT upload, voice webhooks per CallSid.
   - webhook replay protection (Twilio, Razorpay).
   - security headers (CSP with nonces for scripts, frame-ancestors none, HSTS in prod, Referrer-Policy, Permissions-Policy allowing geolocation/microphone only on self).
   - cookie flags; session revocation (session_version) works.
   - SQL: grep for string-built SQL; all raw SQL parameterized.
   - logs: phone numbers masked, no OTPs, no tokens (test with log capture).
   - dependency audit (bun audit, pip-audit) and secret scan (gitleaks) in CI.
   - ML API protected by service token; not publicly reachable in deployment config.
   - Media stream WebSocket accepts only sessions created by our TwiML (one-time token in stream URL, expires in 60 s).
3. Optional hardening: Postgres RLS policies for bookings/workers keyed by a session variable set per transaction — only if it does not destabilise the app; otherwise document as future work.

Performance:
- Lighthouse CI budgets (Phase 5) on all customer and worker routes; fix regressions.
- EXPLAIN ANALYZE on top 10 queries (from pg_stat_statements in dev); add missing indexes via migration.
- Load test script (k6 or a Node script if k6 unavailable — ask me): 100 concurrent customers creating quotes+bookings for 5 minutes with mock adapters; report p50/p95 latency, error rate, dispatch completion time.
- Voice: 10 concurrent simulated calls through the webhook transport (mock STT/TTS) — no cross-session state leaks.

Output: reports/security-review.md (finding | severity | status | commit) and reports/performance.md with numbers.

Acceptance Gate: all automated security tests in CI green; zero open blocker/major findings; performance numbers reported.
```

---

## Phase 14 — Testing with real users and real questions

This phase is half agent work (tooling) and half your team's field work. Real-world testing is the strongest proof you can show judges.

### 14a. Agent prompt: test tooling

```text
PHASE 14 — Real-user test tooling: voice corpus capture, evaluation, field test kit, bug bash process.

1. Corpus capture:
   - /dev/corpus page (DEV only, auth as national_admin): participant id (anonymous code), consent checkbox + recorded consent line, locale, scenario card (from tests/field/scenarios.yaml) → record in browser (MediaRecorder) → saves WAV (converted server-side with ffmpeg to 16 kHz mono) + metadata.
   - Telephone-quality capture: outbound call flow "corpus" that plays the scenario prompt and records the reply at 8 kHz via Twilio (realistic keypad-phone audio). Recordings stored only with consent; delete endpoint by participant code.
   - Labelling UI: play audio, edit transcript, set expected tradeCode/urgency/outOfScope → appends to tests/voice-corpus/labels.jsonl (git-tracked metadata; audio in tests/voice-corpus/audio/ git-ignored and synced separately).
2. bun run voice:eval upgrades: per-locale and per-channel (browser vs phone) metrics, confusion matrix per trade, list of worst 20 failures with transcripts, STT word-level comparison when a gold transcript exists (WER), latency percentiles. Compare against the previous report and flag regressions > 3 points.
3. End-to-end voice task success simulator: run scripted callers (text) through full flows with random noise injections (STT dropouts, wrong DTMF) → task success rate.
4. Field test kit in tests/field/:
   - protocol.md: goals, participants (5 workers incl. ≥ 2 keypad-only, 5 customers incl. ≥ 2 aged 55+ or low literacy, 1 LCS admin; adults only), consent script (to be translated and read aloud), facilitator rules (don't help unless stuck > 2 min), tasks, metrics.
   - tasks.yaml: customer tasks (book by call; book by app; check worker identity; cancel; rate), worker tasks (mark available by call; accept a job; start/complete with OTP; hear earnings), admin tasks (verify a voice-onboarded worker; assign an unassigned job; read fairness page).
   - observation sheet CSV template: participant, task, success (y/n/assisted), time_s, errors, fallbacks_to_dtmf, SEQ 1–7 (asked verbally), quotes.
   - analysis script → reports/field-test-YYYYMMDD.md with success rates, median times, top issues.
5. Bug bash: docs/bug-bash.md with severity definitions (S1 blocks demo/booking, S2 wrong data/money, S3 UX, S4 cosmetic), GitHub issue template, triage rule: S1/S2 fixed before any new feature.

Acceptance Gate: corpus UI records and labels a sample; voice:eval produces the upgraded report; field kit files complete; dry-run of the protocol with two teammates recorded in reports/.
```

### 14b. Real test scenarios (your team translates and records them)

Have native speakers phrase each scenario naturally in Malayalam, Manglish, English, Hindi, and Tamil. Don't read the English aloud word for word. Record at least 200 utterances in total, around half of them in Malayalam, and include some over real phone calls.

| #   | Caller says (English meaning)                                | Expected result                                                                                                    |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 1   | Kitchen tap has been leaking since morning                   | plumber, normal                                                                                                    |
| 2   | Water is flooding the bathroom, pipe burst                   | plumber, emergency, safety line                                                                                    |
| 3   | Sparks came from the switch board when I switched on the fan | electrician, emergency, safety line                                                                                |
| 4   | Fan is not working                                           | electrician, normal                                                                                                |
| 5   | The motor is not pumping water                               | ambiguous (plumber vs electrician) → clarification question                                                        |
| 6   | I need someone to look after my mother for two weeks         | caregiver, normal, scheduled                                                                                       |
| 7   | Need a driver tomorrow at 6 in the morning to the airport    | driver, tomorrow                                                                                                   |
| 8   | Want two rooms painted before Onam                           | painter, scheduled                                                                                                 |
| 9   | House needs full cleaning after the flood water went down    | cleaner, emergency/relief                                                                                          |
| 10  | Garden grass is overgrown                                    | gardener                                                                                                           |
| 11  | Door is not closing, hinge broken                            | carpenter                                                                                                          |
| 12  | Washing machine is making noise                              | technician                                                                                                         |
| 13  | I need a maid for daily work                                 | domestic_help, recurring intent                                                                                    |
| 14  | Gas smell in the kitchen                                     | safety line first (advise leaving, calling gas emergency), out of scope for booking, or technician per your policy |
| 15  | Can someone climb the coconut tree                           | out of scope (unless you add the trade) → polite handling                                                          |
| 16  | (Silence)                                                    | repeat, then DTMF fallback                                                                                         |
| 17  | (Heavy traffic/TV noise) plus a request                      | tests STT robustness                                                                                               |
| 18  | Mixed: "fan work aakunnilla, urgent aanu"                    | electrician, emergency (Manglish)                                                                                  |
| 19  | Wrong number / "who is this?"                                | explain the service, offer to continue or end                                                                      |
| 20  | Angry: "the worker yesterday took extra money"               | route to complaint, not booking                                                                                    |
| 21  | Elderly caller speaking slowly with long pauses              | VAD must not cut them off                                                                                          |
| 22  | Caller gives the address by voice instead of a pincode       | re-prompt for the pincode by keypad; landmark stored                                                               |
| 23  | Worker says "I can't come, I'm sick" to an offer call        | decline path (DTMF 2)                                                                                              |
| 24  | Customer asks "how much will it cost?" mid-flow              | answer from quote logic, continue                                                                                  |
| 25  | Hindi-speaking migrant worker in Kerala calls in Hindi       | Hindi flow end to end                                                                                              |

Set pass targets before testing, and report actual results honestly:

- trade accuracy ≥ 90% in Malayalam on phone-quality audio
- pincode entry 100% via DTMF
- end-to-end voice booking success ≥ 85% without assistance
- median call length under 3 minutes

---

## Phase 15 — Deployment and demo hardening

```text
PHASE 15 — Production deployment, deterministic demo, control panel, runbook, fallbacks.

Deployment:
- apps/web → Vercel (env per environment; Node runtime for routes needing DB; region closest to India available).
- apps/voice, apps/jobs, apps/ml, Redis → Railway (or Fly.io) with Dockerfiles (voice image includes ffmpeg); health checks; restart policies; VOICE_PUBLIC_URL on a stable custom domain with HTTPS; Twilio number webhooks updated.
- Postgres → Supabase or Neon with postgis extension; migrations run in CI deploy step (never from a laptop against prod).
- Secrets only in platform secret stores. Separate staging and demo environments.
- Data localisation note: document which components can be hosted in India regions and the plan for NIC/MeghRaj hosting (docs/deployment.md).

Demo determinism:
- bun run demo:reset (demo env only): restores a known snapshot — demo societies/workers, the two physical keypad phones as verified plumber/electrician near DEMO_PINCODE, 12 months synthetic history, precomputed forecasts and fairness report, a disaster scenario ready but inactive, TN config ready but inactive, TTS cache warmed.
- /admin/demo control panel (national_admin + DEMO_MODE=true): buttons — reset demo, place callback to a phone number I type (judge's phone), simulate a booking burst on the map, activate/deactivate disaster mode for a district, switch Kerala ↔ Tamil Nadu, show ledger verify, play the fairness-proof animation.
- Adapter matrix for demo: telephony/speech/llm real, payments mock (clearly labelled "test mode"), SMS mock + dev inbox on a second screen.

Fallbacks (implement and document in docs/demo-runbook.md):
- Venue internet fails → phone hotspot; if calls fail → play the Phase 7 recorded video; if cloud fails → full local stack via docker compose on the laptop with a tunnel.
- LLM provider fails → automatic DTMF trade menu (already built) — rehearse this deliberately so it looks intentional.
- Pre-printed QR worker ID cards for judges to scan.

docs/demo-runbook.md: minute-by-minute 5-minute script, who clicks what, exact phrases to say in the live call, "if X fails do Y" table, pre-demo checklist (balances on Twilio, keys valid, phones charged, SIM signal at venue, TTS cache warm, demo:reset done).

Acceptance Gate: production URLs healthy; 3 consecutive full demo rehearsals from demo:reset with no manual DB fixes; runbook complete.
```

---

## Parallel work plan for a 6-person team

Phases 1–3 must be done first and in order (one or two people, fast). After that, work runs in parallel:

| Person                       | Phases                             | Notes                                                                         |
| ---------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| A — Voice lead               | 7 → 8                              | Highest risk. Start the smoke scripts in week 1, even before Phase 3 is done. |
| B — Backend lead             | 4 → 6 → 9                          | Owns the service-layer pattern and reviews every PR for tenancy.              |
| C — Customer UX              | 5 → 12 (institutions)              | Owns i18n, audio labels, and Lighthouse budgets.                              |
| D — Worker/Admin UX          | Worker part of 6 → 10              | Coordinates with B on APIs.                                                   |
| E — ML                       | 11                                 | Can start the history generator right after Phase 2.                          |
| F — Field + security + pitch | LCS visits, corpus (14), 13, pitch | You, given your security background. Also owns the demo runbook.              |

Git rules:

- Feature branch per phase or sub-task.
- Every PR gets the Review prompt run and a human approval.
- `main` stays green; tag after each gate.
- Nobody merges a migration without pulling main first. Migrations are generated only on an up-to-date branch.

## Final pre-finale checklist

- [ ] Every Acceptance Gate passed and tagged
- [ ] PROGRESS.md TODO_VERIFY list resolved with real values (wages, schemes, festivals), or clearly disclosed as placeholders in the pitch
- [ ] Voice eval and field test reports with honest numbers
- [ ] Security review report with zero open blocker/major findings
- [ ] LCS support letter and field test photos (with consent) in the deck
- [ ] 3 clean rehearsals from `demo:reset`, plus a backup video
