/**
 * Environment for integration and e2e tests. Loads the root .env (without
 * overriding real variables), then points DATABASE_URL and REDIS_URL at the
 * test database / Redis DB so tests never touch development or shared data.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT_ENV = fileURLToPath(new URL('../../../../.env', import.meta.url));

// Test-only fallbacks so unit tests run without a local .env (CI sets its own).
const FALLBACKS = {
  SESSION_SECRET: 'test-only-session-secret-0123456789abcdef',
  OTP_PEPPER: 'test-only-otp-pepper-0123456789abcdef0123',
  DEFAULT_STATE: 'KL',
  REDIS_URL_TEST: 'redis://localhost:6379/15',
} as const;

// Used only when DATABASE_URL_TEST is missing; integration tests then fail
// with a clear message from assertTestDatabaseUrl instead of connecting here.
const MISSING_TEST_DB = 'postgres://missing@127.0.0.1:1/missing_test';

export function loadTestEnv(): void {
  if (existsSync(ROOT_ENV)) process.loadEnvFile(ROOT_ENV);
  for (const [name, value] of Object.entries(FALLBACKS)) {
    if (!process.env[name]) process.env[name] = value;
  }
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || MISSING_TEST_DB;
  process.env.REDIS_URL = assertTestRedisUrl(process.env.REDIS_URL_TEST);
  process.env.ADAPTER_MODE = 'mock';
  process.env.SMS_MODE = 'mock';
}

/** Tests flush their Redis DB, so it must not be DB 0 (the development default). */
export function assertTestRedisUrl(url: string | undefined): string {
  const index = Number(new URL(url ?? '').pathname.replace(/^\//, '') || '0');
  if (!Number.isInteger(index) || index < 1) {
    throw new Error(`REDIS_URL_TEST must select a non-zero Redis DB (e.g. /15), got ${url}`);
  }
  return url as string;
}
