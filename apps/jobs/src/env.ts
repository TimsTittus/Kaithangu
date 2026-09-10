import { parseEnv } from '@kaithangu/core';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  RABBITMQ_URL: z.url({ protocol: /^amqps?$/ }),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  OTP_PEPPER: z.string().min(32),
  // Seconds a worker has to accept a dispatch offer (AGENTS.md 6.4 default: 45).
  OFFER_TIMEOUT_SECONDS: z.coerce.number().int().min(5).default(45),
  ADAPTER_MODE: z.enum(['mock', 'real']).optional(),
  SMS_MODE: z.enum(['mock', 'real']).optional(),
  TELEPHONY_MODE: z.enum(['mock', 'real']).optional(),
});

export type JobsEnv = z.output<typeof schema>;

export function loadEnv(env: NodeJS.ProcessEnv = process.env): JobsEnv {
  return parseEnv(schema, env);
}
