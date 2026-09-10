import { parseEnv } from '@kaithangu/core';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  RABBITMQ_URL: z.url({ protocol: /^amqps?$/ }),
});

export type JobsEnv = z.output<typeof schema>;

export function loadEnv(env: NodeJS.ProcessEnv = process.env): JobsEnv {
  return parseEnv(schema, env);
}
