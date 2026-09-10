import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EnvValidationError, parseEnv } from './env';

const schema = z.object({
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  PORT: z.coerce.number().int().default(4000),
});

describe('parseEnv', () => {
  it('returns parsed, defaulted values', () => {
    const env = parseEnv(schema, {
      DATABASE_URL: 'postgres://localhost/db',
      REDIS_URL: 'redis://localhost:6379',
    });
    expect(env).toEqual({
      DATABASE_URL: 'postgres://localhost/db',
      REDIS_URL: 'redis://localhost:6379',
      PORT: 4000,
    });
  });

  it('lists every missing or invalid variable, treating empty strings as missing', () => {
    let caught: unknown;
    try {
      parseEnv(schema, { DATABASE_URL: '', REDIS_URL: 'not-a-url' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(EnvValidationError);
    const issues = (caught as EnvValidationError).issues;
    expect(issues).toHaveLength(2);
    expect(issues[0]).toBe('DATABASE_URL: required but not set');
    expect(issues[1]).toMatch(/^REDIS_URL: /);
    expect((caught as Error).message).toContain('  - DATABASE_URL: required but not set');
  });
});
