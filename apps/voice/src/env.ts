import { parseEnv } from '@kaithangu/core';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  VOICE_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  VOICE_HOST: z.string().default('127.0.0.1'),
  VOICE_PUBLIC_URL: z.url({ protocol: /^https?$/ }),
});

export type VoiceEnv = z.output<typeof schema>;

export function loadEnv(env: NodeJS.ProcessEnv = process.env): VoiceEnv {
  return parseEnv(schema, env);
}
