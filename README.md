# Kaithangu

Household services marketplace. Next.js app with Supabase (Drizzle), Upstash Redis, and Twilio SMS.

```bash
cp .env.example .env
bun install
bun run db:migrate
bun run db:seed
bun run dev
```

Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` so login OTPs are sent to real phones.

| Command              | What it does                     |
| -------------------- | -------------------------------- |
| `bun run dev`        | Dev server                       |
| `bun run build`      | Production build                 |
| `bun run db:migrate` | Apply Drizzle migrations         |
| `bun run db:seed`    | Seed states, trades, and pricing |
| `bun run db:studio`  | Drizzle Studio                   |
