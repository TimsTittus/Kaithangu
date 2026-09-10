import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs from packages/db; load the root .env without overriding real env.
const rootEnv = resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  // Only `drizzle-kit studio` connects; `generate` works offline. Migrations run
  // through src/scripts/migrate.ts, not drizzle-kit migrate.
  dbCredentials: { url: process.env.DATABASE_URL_MIGRATE ?? process.env.DATABASE_URL ?? '' },
  // Hide PostGIS's own tables (spatial_ref_sys, …) from drizzle-kit.
  extensionsFilters: ['postgis'],
  strict: true,
  verbose: true,
});
