import { parseEnv } from '@kaithangu/core';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
});

export type WebEnv = z.output<typeof schema>;

let cached: WebEnv | undefined;

/** Parsed server environment. Validated once at startup by instrumentation.ts. */
export function getEnv(): WebEnv {
  cached ??= parseEnv(schema, process.env);
  return cached;
}
