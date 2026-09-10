# Architecture

Kaithangu is a Bun-workspaces + Turborepo monorepo. Apps run on Node 22 in
production; Bun is only the package manager and script runner. The binding
rules live in [AGENTS.md](../AGENTS.md); this page is the map.

## Layers

```
            browsers / PWA           phone calls (IVR + voice)
                  │                          │
          ┌───────▼───────┐          ┌───────▼───────┐
          │   apps/web    │          │  apps/voice   │   thin: parse → call
          │ Next.js (RSC) │          │   Fastify     │   service → map result
          │ tRPC + REST   │          │  Twilio hooks │
          └───────┬───────┘          └───────┬───────┘
                  │        ┌─────────────┐   │
                  ├────────►  apps/jobs  ◄───┤   RabbitMQ queues
                  │        │  consumers  │   │   (dispatch, notifications,
                  │        └──────┬──────┘   │    broadcasts, schedules)
          ┌───────▼───────────────▼──────────▼───────┐
          │              packages/core               │  domain logic + services,
          │  (authz, pricing, matching, ledger, …)   │  ctx: RequestContext first
          └──────┬───────────────┬───────────────────┘
                 │               │ interfaces only
       ┌─────────▼──────┐  ┌─────▼───────────────────┐
       │  packages/db   │  │   packages/adapters     │  mock | real per adapter
       │ Drizzle + SQL  │  │ telephony, speech, llm, │  (ADAPTER_MODE and
       │ PostGIS        │  │ payments, sms, geocode, │   <NAME>_MODE overrides)
       └────────────────┘  │ storage                 │
                           └─────────────────────────┘
   packages/i18n — en/ml/hi/ta catalogs (UI, voice prompts, trade synonyms)
   packages/config — tsconfig base, ESLint flat config, Prettier
   apps/ml — Python 3.12 FastAPI service called over HTTP (ML_SERVICE_URL)
```

## Rules of the road

- **Business logic lives in `packages/core`.** tRPC procedures, REST webhook
  handlers, voice handlers and queue consumers only parse input (zod), call a
  service and map the result or `AppError`.
- **Every service takes `ctx: RequestContext` first** and enforces authorization
  and tenancy (national → state → society) itself.
- **`packages/core` imports interfaces, never implementations**: no `next`,
  `fastify`, `amqplib` or adapter code.
- **External services only through `packages/adapters`.** With
  `ADAPTER_MODE=mock` the whole system runs offline without API keys.
- **API style.** The web app's own API is tRPC (`/api/trpc`). Plain REST is kept
  for things tRPC cannot serve: health checks, signed third-party webhooks
  (Twilio, Razorpay) and any external client.
- **Queues.** `apps/jobs` consumes durable RabbitMQ queues. Redis is still used
  for short-lived coordination such as the booking accept lock (`SET NX`).
- **Configuration over code.** State-specific values (rates, locales, fees) come
  from config tables and data files, never literals.

## Runtime infrastructure

| Service                     | Local (docker compose)             | Used by                           |
| --------------------------- | ---------------------------------- | --------------------------------- |
| PostgreSQL 16 + PostGIS 3.4 | `postgres` :5432 (`POSTGRES_PORT`) | web, voice, jobs, ml              |
| Redis 7                     | `redis` :6379                      | locks, sessions, rate limits      |
| RabbitMQ 4.3                | `rabbitmq` :5672, UI :15672        | jobs (and producers in web/voice) |

Each TypeScript app validates its environment with zod in `src/env.ts` at
startup and exits with a list of missing variables.
