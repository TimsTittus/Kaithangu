import { z } from 'zod';

export const adapterModeSchema = z.enum(['mock', 'real']);
export type AdapterMode = z.infer<typeof adapterModeSchema>;

export const ADAPTER_NAMES = ['telephony', 'speech', 'llm', 'payments', 'sms'] as const;
export type AdapterName = (typeof ADAPTER_NAMES)[number];

const MODE_ENV_VAR: Record<AdapterName, string> = {
  telephony: 'TELEPHONY_MODE',
  speech: 'SPEECH_MODE',
  llm: 'LLM_MODE',
  payments: 'PAYMENTS_MODE',
  sms: 'SMS_MODE',
};

type EnvLike = Readonly<Record<string, string | undefined>>;

/**
 * Resolve an adapter's mode: the per-adapter override (e.g. PAYMENTS_MODE)
 * wins, otherwise ADAPTER_MODE, otherwise 'mock' so the system runs offline.
 * Empty strings count as unset. Invalid values throw.
 */
export function resolveAdapterMode(env: EnvLike, adapter: AdapterName): AdapterMode {
  const override = env[MODE_ENV_VAR[adapter]];
  const global = env.ADAPTER_MODE;
  const raw = override || global || 'mock';
  return adapterModeSchema.parse(raw);
}
