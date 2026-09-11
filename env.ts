import { MIN_SESSION_SECRET_LENGTH, parseEnv } from '@/lib/core';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  UPSTASH_REDIS_REST_URL: z.url({ protocol: /^https?$/ }),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  SESSION_SECRET: z.string().min(MIN_SESSION_SECRET_LENGTH),
  OTP_PEPPER: z.string().min(32),
  DEFAULT_STATE: z.string().regex(/^[A-Z]{2}$/, 'must be a 2-letter state code, e.g. KL'),
  TWILIO_ACCOUNT_SID: z.string().min(1),
  TWILIO_AUTH_TOKEN: z.string().min(1),
  TWILIO_PHONE_NUMBER: z.string().regex(/^\+[1-9]\d{7,14}$/, 'must be E.164, e.g. +91XXXXXXXXXX'),
  /** Verify service SID from https://www.twilio.com/console/verify/services */
  TWILIO_VERIFY_SERVICE_SID: z.string().regex(/^VA[0-9a-fA-F]{32}$/, 'must be a Verify service SID (VA...)'),
});

export type WebEnv = z.output<typeof schema>;

let cached: WebEnv | undefined;

/** Parsed server environment. */
export function getEnv(): WebEnv {
  cached ??= parseEnv(schema, process.env);
  return cached;
}
