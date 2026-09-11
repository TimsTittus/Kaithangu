/**
 * Apply pending drizzle migrations (drizzle) to DATABASE_URL.
 * Run: bun run db:migrate
 */
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb } from '..';
import { loadDbScriptEnv, migrationUrl } from '../env';
import { redactDatabaseUrl } from '../index';

export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function runMigrations(databaseUrl: string): Promise<void> {
  const { db, client } = createDb(databaseUrl, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await client.end({ timeout: 5 });
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const url = migrationUrl(loadDbScriptEnv(process.env));
    console.log(`db:migrate → ${redactDatabaseUrl(url)}`);
    await runMigrations(url);
    console.log('db:migrate OK');
  } catch (error) {
    console.error('db:migrate FAILED', error);
    process.exitCode = 1;
  }
}
