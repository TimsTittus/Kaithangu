# Kaithangu

🏆 Winner — College Level Smart India Hackathon (SIH) 2026 Prelims

Kaithangu is a state-backed household services marketplace built as a fairer
alternative to gig-economy aggregators. It connects households, individual
service workers, and Labour Cooperative Societies (LCS) on one platform,
built around a transparent, government-defined pricing model where the
worker's wage, a welfare fund contribution, and the platform fee are each
broken out and shown to the customer — instead of an opaque commission cut
from an unpublished rate.

The app is a Next.js 16 (App Router) PWA with Supabase-hosted Postgres via
Drizzle ORM, Upstash Redis, Twilio Verify for OTP login, and optional Sarvam
AI speech services. The current pilot targets Kerala (state code `KL`); the
data model already carries a second state, Tamil Nadu (`TN`), seeded
inactive.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Available scripts](#available-scripts)
- [Data model & database](#data-model--database)
- [Authentication](#authentication)
- [Pricing model](#pricing-model)
- [Booking lifecycle](#booking-lifecycle)
- [Internationalization](#internationalization)
- [Progressive Web App](#progressive-web-app)
- [API](#api)
- [Health check](#health-check)

## Features

**Three roles, one app**

- **User** — browses trades, books a job, sees a live price breakdown before
  confirming, tracks bookings, can flag a booking as an emergency, and gets a
  spending analytics view of past bookings.
- **Worker** — manages their profile and verification status, and progresses
  jobs through the booking state machine (accept → en route → in progress →
  completed).
- **Corporate** (Labour Cooperative Society / society admin) — manages the
  society's workers (including verification), reviews the society's
  bookings, and manages the society's profile.

**Transparent, government-set pricing**\
Every quote is computed from seeded, per-state, per-trade rates
(`state_trade_rates`) and per-state percentages (`state_config`) — never
hardcoded — and shown to the customer as separate line items: worker wage
(plus emergency surcharge, when applicable), welfare fund contribution,
platform fee, and GST (for institutional/corporate bookings only). See
[Pricing model](#pricing-model).

**Landing page with a worked comparison**\
A public marketing page includes a live wage calculator and a side-by-side
comparison against typical gig-aggregator economics, aimed at building trust
in the model before a visitor signs up.

**OTP-only authentication**\
No passwords. Sign-in is by Indian mobile number with a 6-digit SMS OTP sent
through Twilio Verify; the first successful login creates the account for
that number with the role chosen at login (user, worker, or corporate).

**Consent tracking**\
Platform terms acceptance is recorded per user before they can use the app
(`consent_purpose = platform_terms`), redirecting back to wherever the user
was headed once accepted.

**Emergency bookings**\
Users can request urgent service; pricing automatically applies the state's
configured emergency surcharge, which is paid to the worker in full.

**Certified-trade gating**\
Trades that require certification (electrician, technician) only match
workers holding the relevant verified skill; this is enforced centrally, not
per call site.

**Accessibility for low-literacy and multilingual users**\
Fixed UI labels can be played back as pre-built audio clips, and any dynamic
text (like a price) can be read aloud via the browser's speech synthesis —
aimed at users who are more comfortable listening than reading. Speech
features (transcription, synthesis, translation) are pluggable, backed by a
mock adapter for local development or Sarvam AI in production.

**Offline-aware PWA**\
Installable as an app (manifest + service worker) with cache-first app shell
and static assets, network-first API and page navigation with fallback to
the last cached response, and an offline banner when connectivity drops.
Cached page/API data is cleared on logout.

**Consistent, typed API errors**\
Every `/api/v1` route returns either `{ data }` or
`{ error: { code, messageKey, requestId } }`, with request IDs propagated
end-to-end for support and log correlation.

**Scoped authorization by design**\
A single, declarative policy table (`lib/core/authz.ts`) governs who can do
what: users only ever see their own bookings, workers their own job records,
and corporates only their own society's data — checks fail closed if a
scope ID is missing on either side.

## Tech stack

| Layer          | Choice                                                             |
| -------------- | ------------------------------------------------------------------ |
| Framework      | [Next.js 16](https://nextjs.org) (App Router, React 19)            |
| API            | [tRPC 11](https://trpc.io) + a typed `/api/v1` REST surface        |
| Database       | Postgres (Supabase) via [Drizzle ORM](https://orm.drizzle.team)    |
| Cache/sessions | [Upstash Redis](https://upstash.com) (REST client)                 |
| SMS / OTP      | [Twilio](https://www.twilio.com) (Verify for OTP, Messaging API for SMS) |
| Speech         | [Sarvam AI](https://www.sarvam.ai) (mockable) — STT, TTS, translation |
| i18n           | [next-intl](https://next-intl.dev), 4 locales (en, ml, hi, ta)     |
| Styling        | Tailwind CSS 4                                                     |
| Validation     | [Zod](https://zod.dev)                                             |
| Logging        | [Pino](https://getpino.io)                                         |
| Language       | TypeScript (strict), runs on [Bun](https://bun.sh)                 |

## Project structure

```
app/                Next.js App Router routes
  api/               REST (v1) + tRPC HTTP handler + health check
  user/ worker/ corporate/   Role-scoped dashboards and pages
  login/             Phone entry + OTP verification
  consent/ language/ Consent capture and locale switching
components/          Shared React components (audio labels, landing page, etc.)
db/                  Drizzle schema, queries, migration & seed scripts
data/seed/           Per-state YAML rate/config source data for db:seed
drizzle/             Generated SQL migrations
lib/
  core/              Framework-agnostic domain logic (pricing, authz, booking
                     state machine, OTP, sessions, money, phone, i18n helpers)
  adapters/          Pluggable external integrations (SMS, speech) behind
                     interfaces, with mock implementations for local dev
  i18n/              Message catalogs (en, hi, ml, ta)
server/              Auth context/session wiring, service composition, HTTP helpers
trpc/                tRPC routers (session, user, worker, corporate) and client
public/              PWA manifest, icons, hand-written service worker
docs/                Project documentation
```

## Getting started

Requires [Bun](https://bun.sh) and Node 22 (see `.nvmrc`).

```bash
cp .env.example .env      # then fill in the values — see below
bun install
bun run db:migrate        # apply schema migrations
bun run db:seed           # seed states, trades, and pricing (no user accounts)
bun run dev
```

The app runs at `http://localhost:3000`. Sign in with a real Indian mobile
number — an OTP is sent by Twilio SMS. There are no seeded login accounts;
the first successful OTP verification for a number creates its account with
the role picked on the login screen (see [docs/demo-accounts.md](docs/demo-accounts.md)).

## Environment variables

Copy `.env.example` to `.env` and fill in every value; the app validates
these eagerly at startup and refuses to run with any missing or malformed
(`lib/core/env.ts`, `env.ts`).

| Variable                     | Required          | Notes                                                                 |
| ----------------------------- | ------------------ | ---------------------------------------------------------------------- |
| `NODE_ENV`                   | No (default `development`) | `development` \| `test` \| `production`                    |
| `NEXT_PUBLIC_URL`             | No (default `http://localhost:3000`) | Public base URL used by the tRPC client        |
| `DATABASE_URL`                | Yes                | Postgres connection string (Supabase pooler URL on port 6543 works; migrations switch to 5432 automatically for that host) |
| `UPSTASH_REDIS_REST_URL`      | Yes                | Upstash Redis REST endpoint                                            |
| `UPSTASH_REDIS_REST_TOKEN`    | Yes                | Upstash Redis REST token                                               |
| `SESSION_SECRET`              | Yes                | ≥ 32 random characters; signs the session cookie                       |
| `OTP_PEPPER`                  | Yes                | ≥ 32 random characters; HMAC key used when hashing OTPs                |
| `DEFAULT_STATE`               | Yes                | Two-letter state code used when none is otherwise known, e.g. `KL`     |
| `TWILIO_ACCOUNT_SID`          | Yes                | Twilio account SID                                                     |
| `TWILIO_AUTH_TOKEN`           | Yes                | Twilio auth token                                                      |
| `TWILIO_PHONE_NUMBER`         | Yes                | E.164 sender number for non-OTP SMS, e.g. `+14155551212`               |
| `TWILIO_VERIFY_SERVICE_SID`   | Yes                | Twilio Verify service SID (`VA...`), used for login OTPs               |
| `SPEECH_MODE`                 | No (default `mock`) | `mock` (canned responses, no external calls) \| `real` (Sarvam AI)    |
| `SARVAM_API_KEY`              | Only if `SPEECH_MODE=real` | Sarvam AI API key                                                |

Never commit a filled-in `.env` — it holds live secrets. `.env` is already
git-ignored in this repo.

## Available scripts

| Command                    | What it does                                    |
| --------------------------- | ------------------------------------------------ |
| `bun run dev`               | Start the dev server                              |
| `bun run build`              | Production build                                  |
| `bun run start`              | Start the production server (after `build`)       |
| `bun run lint`               | Run ESLint                                        |
| `bun run prettier`           | Format the codebase with Prettier                 |
| `bun run db:generate`        | Generate a Drizzle migration from schema changes  |
| `bun run db:migrate`         | Apply pending Drizzle migrations                  |
| `bun run db:push`            | Push the Drizzle schema directly (no migration file) |
| `bun run db:seed`            | Seed states, trades, and pricing from `data/seed/*.yaml` |
| `bun run db:seed:pincodes`   | Seed pincode → state/district reference data      |
| `bun run db:studio`          | Launch Drizzle Studio                             |

## Data model & database

Schema lives under [db/schema](db/schema) (Drizzle, Postgres) and is grouped by
domain: `user`, `worker`, `org` (societies), `region` (states, pincodes),
`bookings`, `consents`, plus shared `columns` and `enums`. Migrations are
generated into [drizzle/](drizzle) and applied with `bun run db:migrate`.

Per-state pricing and configuration are **not** hardcoded — they're defined
in YAML under [data/seed](data/seed) (one file per state) and loaded into
`states`, `state_config`, and `state_trade_rates` by `bun run db:seed`. Rate
files are explicit about which figures are verified vs. placeholder
(`is_placeholder`, `TODO_VERIFY`), since real minimum-wage figures come from
government notifications and are supplied by the project team over time.

## Authentication

Login is phone number + OTP only, no passwords:

1. The user enters an Indian mobile number and picks a role (user, worker,
   or corporate) on first sign-in.
2. Twilio Verify sends a 6-digit SMS OTP to that number.
3. On successful verification, a session is issued (Redis-backed) and, if
   this is a new number, an account is created with the chosen role.
4. Job-level OTPs (used to confirm work has started/completed on site) are a
   separate 4-digit code, generated with a CSPRNG, HMAC-SHA-256 hashed with
   `OTP_PEPPER` before storage, and checked in constant time with a capped
   number of attempts before the booking locks.

Authorization is centralized in a declarative policy
([lib/core/authz.ts](lib/core/authz.ts)): each action (e.g. `booking.read`,
`worker.verify`) maps per role to a scope rule (`own_customer`, `own_worker`,
`society`, `state`, or `any`). Checks fail closed — if either the actor or
the resource is missing the relevant scope ID, access is denied.

## Pricing model

Computed by [lib/core/pricing.ts](lib/core/pricing.ts) from a trade's seeded
rate row and the state's configured percentages — nothing is hardcoded:

```
billable_minutes = max(min_billable_minutes, estimated_minutes)
wage             = ceil(billable_minutes × wage_floor_per_hour_paise / 60) + visit_charge_paise
emergency        = surcharge = round(wage × emergency_surcharge_pct / 100); wage += surcharge
welfare          = round(wage × welfare_pct / 100)
platform_fee     = round(wage × platform_fee_pct / 100)
gst              = institution only: round(platform_fee × gst_pct_on_platform_fee / 100)
total            = wage + welfare + platform_fee + gst
```

All amounts are integer paise and rounding is half-up to the paisa. The
emergency surcharge is paid entirely to the worker. Welfare is added on top
of the customer's total — it is never deducted from the worker's wage.

## Booking lifecycle

Bookings move through a fixed state machine
([lib/core/booking/stateMachine.ts](lib/core/booking/stateMachine.ts)); any
transition not listed below throws:

```
requested → matching → offered → accepted → en_route → in_progress → completed
matching | offered              → unassigned → offered      (manual reassignment)
requested | matching | offered | unassigned | accepted | en_route → cancelled
completed → disputed → resolved
```

## Internationalization

Four locales are supported out of the box: English (`en`), Malayalam
(`ml`), Hindi (`hi`), and Tamil (`ta`), via message catalogs under
[lib/i18n/catalogs](lib/i18n/catalogs) and `next-intl`. Trade names and
other UI strings are resolved by i18n key so new locales only require a new
catalog file.

## Progressive Web App

Kaithangu installs as an app via [public/manifest.webmanifest](public/manifest.webmanifest)
and a hand-written service worker ([public/sw.js](public/sw.js)):

- App shell, static assets, and the active locale's audio labels are cached
  cache-first.
- `/api/*` requests are network-first, falling back to the last cached
  response when offline.
- Page navigations are network-first, falling back to the cached page or the
  app shell.
- Only same-origin `GET` requests are handled by the service worker; map
  tiles always go to the network.
- Cached pages and API responses are private per session and are cleared on
  logout.

## API

Two API surfaces are exposed:

- **tRPC** (`app/api/trpc`) — the primary typed RPC layer for the app UI
  (`session`, `user`, `worker`, `corporate` routers; see
  [trpc/routers/_app.ts](trpc/routers/_app.ts)).
- **REST `/api/v1`** (`app/api/v1`) — `auth` (OTP login/logout), `bookings`,
  `me`, `quotes`, `stt` (speech-to-text), and `admin/workers`. Every
  response is `{ data }` on success or
  `{ error: { code, messageKey, requestId } }` on failure, with the request
  ID echoed back on `x-request-id` for correlation with server logs.

## Health check

`GET /api/health` reports application version plus live Postgres and Redis
connectivity, returning `200` when healthy and `503` otherwise (always
`cache-control: no-store`).