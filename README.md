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

```bash
cp .env.example .env
# Fill in POSTGRES_PASSWORD, RABBITMQ_DEFAULT_PASS, SESSION_SECRET, OTP_PEPPER
# and the DATABASE_URL / DATABASE_URL_TEST / RABBITMQ_URL values that use them.
# If port 5432 is taken locally, set POSTGRES_PORT (and the URLs) to another port.

docker compose up -d
docker compose ps                     # postgres, redis, rabbitmq → (healthy)

bun install
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
| `bun run --filter ml dev`  | only the ML service                                 |

Always use `bun run <script>`: `bun test` and `bun build` are Bun built-ins,
not our Vitest / Next.js / tsup scripts.
