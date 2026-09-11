import { parseEnv } from '@/lib/core';
import { z } from 'zod';

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ });

export const dbScriptEnvSchema = z.object({
  DATABASE_URL: postgresUrl,
});

export function loadDbScriptEnv(env: Readonly<Record<string, string | undefined>>) {
  return parseEnv(dbScriptEnvSchema, env);
}

export function migrationUrl(env: { DATABASE_URL: string }): string {
  const url = new URL(env.DATABASE_URL);
  if (url.hostname.endsWith('.pooler.supabase.com') && url.port === '6543') {
    url.port = '5432';
  }
  return url.toString();
}
