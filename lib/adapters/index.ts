import { z } from 'zod';

export const adapterModeSchema = z.enum(['mock', 'real']);
export type AdapterMode = z.infer<typeof adapterModeSchema>;

/** Speech can still run mocked; SMS is always Twilio. */
export function resolveAdapterMode(
  env: Readonly<Record<string, string | undefined>>,
  adapter: 'speech',
): AdapterMode {
  const raw = env.SPEECH_MODE || env.ADAPTER_MODE || 'mock';
  return adapterModeSchema.parse(raw);
}
