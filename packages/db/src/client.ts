import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Supabase's Supavisor transaction pooler listens on 6543 and cannot run
// prepared statements (https://supabase.com/docs/guides/database/connecting-to-postgres).
const TRANSACTION_POOLER_PORT = '6543';
const SESSION_POOLER_PORT = '5432';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function isTransactionPooler(databaseUrl: string): boolean {
  return new URL(databaseUrl).port === TRANSACTION_POOLER_PORT;
}

/**
 * URL for DDL. Supabase documents migrations over a session/direct connection,
 * and its session pooler is the same pooler host and credentials on port 5432,
 * so a transaction-pooler URL is switched to that port. Other URLs pass through.
 */
export function sessionModeUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  if (url.hostname.endsWith('.pooler.supabase.com') && url.port === TRANSACTION_POOLER_PORT) {
    url.port = SESSION_POOLER_PORT;
    return url.toString();
  }
  return databaseUrl;
}

/** True for a database on this machine (docker compose / CI service). */
export function isLocalDatabase(databaseUrl: string): boolean {
  return LOCAL_HOSTS.has(new URL(databaseUrl).hostname);
}

export interface CreateDbOptions {
  max?: number;
}

export function createDb(databaseUrl: string, options: CreateDbOptions = {}) {
  const client = postgres(databaseUrl, {
    max: options.max ?? 10,
    prepare: !isTransactionPooler(databaseUrl),
    // Remote (Supabase) connections must use TLS; local containers have none.
    ssl: isLocalDatabase(databaseUrl) ? false : 'require',
    onnotice: () => {},
  });
  const db = drizzle(client, { schema });
  return { db, client };
}

export type Database = ReturnType<typeof createDb>['db'];
export type SqlClient = ReturnType<typeof createDb>['client'];
