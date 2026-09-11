/**
 * Boundary validation (AGENTS.md 4.3): parse input with zod and turn failures
 * into AppError('VALIDATION_FAILED') listing the offending fields.
 */
import type { z } from 'zod';
import { AppError } from './errors';

export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError('VALIDATION_FAILED', undefined, undefined, {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
      })),
    });
  }
  return result.data;
}
