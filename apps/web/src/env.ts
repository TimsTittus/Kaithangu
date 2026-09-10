import { MIN_SESSION_SECRET_LENGTH, parseEnv } from '@kaithangu/core';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  SESSION_SECRET: z.string().min(MIN_SESSION_SECRET_LENGTH),
  OTP_PEPPER: z.string().min(32),
  DEFAULT_STATE: z.string().regex(/^[A-Z]{2}$/, 'must be a 2-letter state code, e.g. KL'),
  // The /dev/inbox page exists only when this is exactly "true".
  DEV_INBOX: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
});

export type WebEnv = z.output<typeof schema>;

let cached: WebEnv | undefined;

/** Parsed server environment. Validated once at startup by instrumentation.ts. */
export function getEnv(): WebEnv {
  cached ??= parseEnv(schema, process.env);
  return cached;
}
