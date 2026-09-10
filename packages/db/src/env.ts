import { parseEnv } from '@kaithangu/core';
import { z } from 'zod';
import { sessionModeUrl } from './client';

const e164 = z.string().regex(/^\+[1-9][0-9]{7,14}$/, 'must be E.164, e.g. +91XXXXXXXXXX');
const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ });

/** Environment for db:migrate / db:seed / db:reset (validated at startup). */
export const dbScriptEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: postgresUrl,
  DEMO_PINCODE: z
    .string()
    .regex(/^[1-9][0-9]{5}$/)
    .optional(),
  DEMO_WORKER_PHONE_1: e164.optional(),
  DEMO_WORKER_PHONE_2: e164.optional(),
});

export type DbScriptEnv = z.output<typeof dbScriptEnvSchema>;

export function loadDbScriptEnv(env: Readonly<Record<string, string | undefined>>): DbScriptEnv {
  return parseEnv(dbScriptEnvSchema, env);
}

/** URL used for schema changes (migrations, reset). */
export function migrationUrl(env: DbScriptEnv): string {
  return sessionModeUrl(env.DATABASE_URL);
}
