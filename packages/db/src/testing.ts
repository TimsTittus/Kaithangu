/**
 * Helpers for integration and e2e test setup (`@kaithangu/db/testing`). Kept
 * out of the package root so app bundles never import migration code.
 */
export { runMigrations } from './scripts/migrate';
export { seedReferenceData } from './scripts/seed';

/**
 * Integration tests write fixtures, so they only run against a database whose
 * name ends in `_test` (e.g. kaithangu_test from infra/db/init.sql).
 */
export function assertTestDatabaseUrl(databaseUrl: string | undefined): string {
  if (databaseUrl === undefined || databaseUrl === '') {
    throw new Error(
      'DATABASE_URL_TEST is not set. Start `docker compose up -d postgres` and set it in .env ' +
        '(see .env.example).',
    );
  }
  const name = new URL(databaseUrl).pathname.replace(/^\//, '');
  if (!name.endsWith('_test')) {
    throw new Error(`refusing to use database "${name}" for tests: its name must end in _test`);
  }
  return databaseUrl;
}
