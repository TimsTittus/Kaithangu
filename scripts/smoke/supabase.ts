/**
 * Read-only smoke test for the Supabase Postgres used as the dev database.
 * Verifies connectivity, PostGIS availability and where extensions live.
 * Run: bun run smoke:supabase. Checks DATABASE_URL, and DATABASE_URL_MIGRATE /
 * DATABASE_URL_TEST when they are set. Never writes anything.
 */
import postgres from 'postgres';

const TRANSACTION_POOLER_PORT = '6543';

function redact(url: string): string {
  const parsed = new URL(url);
  if (parsed.password !== '') parsed.password = '***';
  return parsed.toString();
}

async function probe(name: string, url: string): Promise<void> {
  // Supabase's transaction pooler does not support prepared statements.
  const prepare = new URL(url).port !== TRANSACTION_POOLER_PORT;
  const sql = postgres(url, { max: 1, prepare, ssl: 'require', connect_timeout: 10 });
  try {
    const [info] = await sql<{ version: string; db: string; user: string; search_path: string }[]>`
      SELECT version(), current_database() AS db, current_user AS user,
             current_setting('search_path') AS search_path`;
    const available = await sql<
      { name: string; default_version: string; installed_version: string | null }[]
    >`
      SELECT name, default_version, installed_version FROM pg_available_extensions
      WHERE name IN ('postgis', 'pgcrypto') ORDER BY name`;
    const installed = await sql<{ extname: string; schema: string }[]>`
      SELECT e.extname, n.nspname AS schema FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace ORDER BY e.extname`;
    console.log(`${name}: ${redact(url)} (prepare=${prepare})`);
    console.log('  server:', info);
    console.log('  available:', available);
    console.log('  installed:', installed.map((e) => `${e.extname}@${e.schema}`).join(', '));
  } finally {
    await sql.end({ timeout: 2 });
  }
}

const targets = ['DATABASE_URL', 'DATABASE_URL_MIGRATE', 'DATABASE_URL_TEST'] as const;
try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  for (const name of targets) {
    const url = process.env[name];
    if (url) await probe(name, url);
    else console.log(`${name}: not set, skipped`);
  }
  console.log('smoke:supabase OK');
} catch (error) {
  console.error('smoke:supabase FAILED', error);
  process.exitCode = 1;
}
