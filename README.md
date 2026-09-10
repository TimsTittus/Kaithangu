# Kaithangu

Cooperative-owned household and community services marketplace for Labour
Cooperative Societies. Kerala pilot. See [AGENTS.md](AGENTS.md) for the binding
product and engineering rules, [docs/architecture.md](docs/architecture.md) for
the layer overview and [PROGRESS.md](PROGRESS.md) for what is built.

## Prerequisites

| Tool                    | Version                       | Notes                              |
| ----------------------- | ----------------------------- | ---------------------------------- |
| Bun                     | 1.3.14 (see `packageManager`) | package manager and script runner  |
| Node.js                 | 22 (see `.nvmrc`)             | production runtime; `nvm use`      |
| Docker + Docker Compose | Compose v2+                   | Postgres/PostGIS, Redis, RabbitMQ  |
| uv                      | recent                        | installs Python 3.12 for `apps/ml` |

## Quickstart

### 1. Set up the database

**Option A: Supabase (recommended for team development)**

1. Create or use an existing Supabase project at https://supabase.com
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` from Supabase's connection string
3. Run migrations:
   ```bash
   bun install
   bun run db:migrate                # applies schema to Supabase
   ```

**Option B: Local Docker (for offline work)**

```bash
cp .env.example .env
# Fill in POSTGRES_PASSWORD, RABBITMQ_DEFAULT_PASS, SESSION_SECRET, OTP_PEPPER.
# Set DATABASE_URL to postgres://kaithangu:PASSWORD@localhost:POSTGRES_PORT/kaithangu
# (adjust POSTGRES_PORT if 5432 is already taken).

docker compose up -d
docker compose ps                     # postgres, redis, rabbitmq → (healthy)
bun install
bun run db:migrate                    # applies schema to local Docker DB
```

### 2. Start development

```bash
bun install                           # (if not already done)
bun run smoke:datastores              # optional: checks all three datastores
bun run dev                           # web :3000, voice :4000, jobs, ml :8000
```

Health checks:

```bash
curl localhost:3000/api/health        # {"ok":true,"version":"…","db":"up","redis":"up"}
curl localhost:4000/health            # {"ok":true,"version":"…"}
curl localhost:8000/health            # {"ok":true,"service":"ml"}
```

RabbitMQ management UI: <http://localhost:15672> (credentials from `.env`).

## Commands

| Command                    | What it does                                        |
| -------------------------- | --------------------------------------------------- |
| `bun run dev`              | all apps in watch mode (Turborepo)                  |
| `bun run build`            | production builds (Next.js, tsup)                   |
| `bun run typecheck`        | `tsc --noEmit` in every workspace                   |
| `bun run lint`             | ESLint (typescript-eslint, type-checked) everywhere |
| `bun run test`             | Vitest in every workspace + pytest in `apps/ml`     |
| `bun run test:coverage`    | Vitest across all projects with v8 coverage         |
| `bun run format`           | Prettier                                            |
| `bun run smoke:datastores` | live check of Postgres, Redis and RabbitMQ          |
| `bun run smoke:supabase`   | read-only check of Supabase connectivity (optional) |
| `bun run db:generate`      | generate Drizzle migrations from schema changes     |
| `bun run db:migrate`       | apply pending migrations to `DATABASE_URL`          |
| `bun run db:studio`        | open Drizzle Studio (web UI) for the database       |
| `bun run --filter ml dev`  | only the ML service                                 |

Always use `bun run <script>`: `bun test` and `bun build` are Bun built-ins,
not our Vitest / Next.js / tsup scripts.

## Database (Phase 2)

The schema is defined in `packages/db/src/schema/` (Drizzle ORM, PostgreSQL + PostGIS).
Migrations live in `packages/db/drizzle/` and are applied with `bun run db:migrate`.

### Key features

- **Geography:** all location columns use `geometry(Point, 4326)` with GIST indexes
- **Ledger:** append-only, hash-chained `ledger_entries` (rejects UPDATE/DELETE)
- **Enums:** 23 PostgreSQL enums for roles, statuses, channels, etc.
- **Triggers:** enforce ledger immutability and check total = sum of parts on bookings
- **PostGIS:** extension installed by migration `0000_extensions.sql`

### Demo data (not yet seeded)

See [docs/demo-accounts.md](docs/demo-accounts.md) for the fixed phone numbers and
other demo entities. The seed is planned but not yet wired to the database.

### Environment variables

- `DATABASE_URL`: Postgres connection (Supabase pooler or local Docker)
- `DEMO_PINCODE`: demo location (must be in the imported pincode table; optional)
- `DEMO_WORKER_PHONE_1`, `DEMO_WORKER_PHONE_2`: physical keypad demo phones (optional)
