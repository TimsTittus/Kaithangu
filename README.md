# Kaithangu

Cooperative-owned household and community services marketplace for Labour
Cooperative Societies under Labour Cooperative Federations (NCCT / Ministry of
Cooperation). Kerala pilot.

See [AGENTS.md](AGENTS.md) for binding product and architectural rules,
[docs/architecture.md](docs/architecture.md) for the layer overview,
[docs/demo-accounts.md](docs/demo-accounts.md) for seeded role phone numbers, and
[PROGRESS.md](PROGRESS.md) for phase completion logs.

---

## Prerequisites

| Tool                    | Version                       | Notes                               |
| ----------------------- | ----------------------------- | ----------------------------------- |
| Bun                     | 1.3.14 (see `packageManager`) | package manager and script runner   |
| Node.js                 | 22 (see `.nvmrc`)             | production runtime; `nvm use`       |
| Docker + Docker Compose | Compose v2+                   | PostgreSQL/PostGIS, Redis, RabbitMQ |
| uv                      | recent                        | installs Python 3.12 for `apps/ml`  |

---

## Quickstart

### 1. Configure Environment

Copy the example configuration:

```bash
cp .env.example .env
```

Key environment variables configured for local offline development:

- `ADAPTER_MODE=mock`: runs SMS, telephony, and speech offline without external API keys.
- `DEV_INBOX=true`: activates the live developer inbox at `/dev/inbox`.
- `POSTGRES_PORT=5434`: host port mapped in `docker-compose.yml` (avoids colliding with local port 5432).
- `DATABASE_URL`: points to local Postgres container (`postgresql://kaithangu:...@localhost:5434/kaithangu`) or Supabase.

### 2. Start Local Infrastructure

Start PostgreSQL with PostGIS, Redis, and RabbitMQ:

```bash
docker compose up -d
docker compose ps
```

Ensure all containers show as healthy.

### 3. Apply Migrations & Seed Data

```bash
bun install
bun run db:migrate         # applies Drizzle schema migrations to DATABASE_URL
bun run db:seed            # seeds reference states, trades, and pricing configurations
bun run db:seed:pincodes   # imports India Post pincodes for serviceable states
```

### 4. Start Development Servers

To start all services concurrently (Web on `:3000`, Voice on `:4000`, RabbitMQ background workers, and ML on `:8000`):

```bash
bun run dev
```

To run only the web application:

```bash
bun run --filter web dev
```

Health check endpoints:

```bash
curl http://localhost:3000/api/health   # {"ok":true,"db":"up","redis":"up"}
curl http://localhost:4000/health       # {"ok":true}
curl http://localhost:8000/health       # {"ok":true,"service":"ml"}
```

RabbitMQ Management UI is available at <http://localhost:15672> (credentials from `.env`).

---

## Local Login & Developer Inbox Walkthrough

Kaithangu uses phone OTP authentication. In local development (`ADAPTER_MODE=mock`), **no real SMS is sent**; all SMS messages (login codes, job offers, OTPs) are routed to an in-memory developer inbox backed by Redis.

### Step 1: Open the Application

Navigate to [http://localhost:3000](http://localhost:3000). On your first visit, select your preferred language at `/language` (**മലയാളം**, **English**, **हिन्दी**, or **தமிழ்**).

### Step 2: Sign In with Phone Number

You will be redirected to [`/login`](http://localhost:3000/login). Enter any 10-digit Indian phone number:

| Target Role        | Phone Number                 | Description / Landing Page                                                      |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------------- |
| **Customer**       | `9876543210` or `9000000001` | Default role; lands on [`/app`](http://localhost:3000/app)                      |
| **LCS Admin**      | `9000000010` … `9000000014`  | Society admin (societies 1–5); lands on [`/admin`](http://localhost:3000/admin) |
| **State Admin**    | `9000000020`                 | Kerala state admin; lands on [`/admin`](http://localhost:3000/admin)            |
| **National Admin** | `9000000030`                 | NCCT admin; lands on [`/admin`](http://localhost:3000/admin)                    |
| **Worker**         | `9000100000` … `9000100499`  | Service worker; lands on [`/w`](http://localhost:3000/w)                        |

Click **Send Code**.

### Step 3: Retrieve the OTP Code

Open the **Developer SMS Inbox** in another browser tab:

👉 **[http://localhost:3000/dev/inbox](http://localhost:3000/dev/inbox)**

The inbox auto-refreshes every 3 seconds. The top message will display your code:

```text
XXXXXX is your Kaithangu sign-in code. It is valid for 5 minutes. Do not share it with anyone.
```

_(The OTP code is also printed in the terminal console where the server is running)._

### Step 4: Verify and Accept Terms

1. Return to the [`/login/verify`](http://localhost:3000/login/verify) tab and enter the 6-digit code.
2. If logging in for the first time, you will be redirected to [`/consent`](http://localhost:3000/consent) to review terms (includes audio playback buttons). Click **Accept**.
3. You will arrive at your role-specific dashboard:
   - **Customer Home ([`/app`](http://localhost:3000/app))**: 10 trade tiles (Plumber, Electrician, Carpenter, etc.) with audio playback, emergency booking, and active booking tracking.
   - **Booking Wizard ([`/app/book/[trade]`](http://localhost:3000/app/book/plumber))**: speech-to-text problem box, MapLibre location picker, slot selector, and transparent pricing breakdown (wage + welfare + platform fee).
   - **Worker Portal ([`/w`](http://localhost:3000/w))**: availability toggle, job offers, en route status, start/complete job OTP verification, and earnings.
   - **LCS Admin ([`/admin`](http://localhost:3000/admin))**: unassigned booking dispatch, candidate rankings, and worker verification.

---

## Core Commands

| Command                    | What it does                                                       |
| -------------------------- | ------------------------------------------------------------------ |
| `bun run dev`              | Run all applications in watch mode (Turborepo)                     |
| `bun run build`            | Build production artifacts (Next.js, tsup)                         |
| `bun run typecheck`        | Run `tsc --noEmit` across all 10 packages                          |
| `bun run lint`             | ESLint (typescript-eslint) + i18n catalog completeness check       |
| `bun run test`             | Run Vitest unit & integration test suites                          |
| `bun run test:e2e`         | Run Playwright mobile viewport (360×640) end-to-end tests          |
| `bun run test:coverage`    | Vitest coverage across all packages with v8                        |
| `bun run format`           | Format code style with Prettier                                    |
| `bun run format:check`     | Verify code conforms to Prettier style                             |
| `bun run db:migrate`       | Apply Drizzle schema migrations to `DATABASE_URL`                  |
| `bun run db:seed`          | Seed reference states, trades, and pricing data                    |
| `bun run db:seed:pincodes` | Seed India Post pincodes for serviceable states                    |
| `bun run i18n:check`       | Verify translation catalogs have identical keys across en/ml/hi/ta |
| `bun run i18n:translate`   | Machine-translate missing keys in ml/hi/ta catalogs                |
| `bun run smoke:datastores` | Live health probe of Postgres, Redis, and RabbitMQ                 |

> **Note**: Always invoke scripts with `bun run <script>` (not `bun test` or `bun build`, which trigger Bun's built-in tools instead of Vitest/Next.js/tsup).