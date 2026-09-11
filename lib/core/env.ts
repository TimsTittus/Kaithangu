import type { z } from 'zod';

export class EnvValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

/**
 * Validate environment variables against a zod schema. Empty strings count as
 * unset (so blank lines copied from .env.example are reported as missing).
 * Throws EnvValidationError listing every problem at once.
 */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  env: Readonly<Record<string, string | undefined>>,
): z.output<T> {
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const name = issue.path.join('.') || '(root)';
      const missing = issue.code === 'invalid_type' && !(name in cleaned);
      return missing ? `${name}: required but not set` : `${name}: ${issue.message}`;
    });
    throw new EnvValidationError(issues);
  }
  return result.data;
}
