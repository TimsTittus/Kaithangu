import { EnvValidationError } from '@kaithangu/core';
import { describe, expect, it } from 'vitest';
import { loadDbScriptEnv, migrationUrl } from './env';

// Example URLs only; no real credentials.
const POOLER = 'postgresql://u:p@pooler.example.com:6543/postgres';
const SESSION = 'postgresql://u:p@pooler.example.com:5432/postgres';

describe('loadDbScriptEnv', () => {
  it('parses a minimal environment with defaults', () => {
    const env = loadDbScriptEnv({ DATABASE_URL: POOLER });
    expect(env.NODE_ENV).toBe('development');
    expect(migrationUrl(env)).toBe(POOLER);
  });

  it('runs schema changes over the Supabase session pooler', () => {
    const env = loadDbScriptEnv({
      DATABASE_URL: 'postgresql://u:p@aws-0-xx.pooler.supabase.com:6543/postgres',
    });
    expect(migrationUrl(env)).toBe('postgresql://u:p@aws-0-xx.pooler.supabase.com:5432/postgres');
    expect(migrationUrl(loadDbScriptEnv({ DATABASE_URL: SESSION }))).toBe(SESSION);
  });

  it('treats empty optional values as unset', () => {
    const env = loadDbScriptEnv({
      DATABASE_URL: POOLER,
      DEMO_PINCODE: '',
      DEMO_WORKER_PHONE_1: '',
    });
    expect(env.DEMO_PINCODE).toBeUndefined();
    expect(env.DEMO_WORKER_PHONE_1).toBeUndefined();
  });

  it('reports every invalid value at once', () => {
    try {
      loadDbScriptEnv({
        DATABASE_URL: 'mysql://u:p@example.com/db',
        DEMO_PINCODE: '12345',
        DEMO_WORKER_PHONE_1: '9876543210',
      });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const issues = (error as EnvValidationError).issues.join('\n');
      expect(issues).toMatch(/DATABASE_URL/);
      expect(issues).toMatch(/DEMO_PINCODE/);
      expect(issues).toMatch(/DEMO_WORKER_PHONE_1: must be E.164/);
    }
  });

  it('requires DATABASE_URL', () => {
    expect(() => loadDbScriptEnv({})).toThrow(/DATABASE_URL: required but not set/);
  });
});
