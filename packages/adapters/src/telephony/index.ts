import { resolveAdapterMode } from '../index';
import { createMockTelephonyAdapter } from './mock';
import { createRealTelephonyAdapter } from './real';
import type { TelephonyAdapter } from './types';

export { createMockTelephonyAdapter } from './mock';
export { createRealTelephonyAdapter, type RealTelephonyOptions } from './real';
export type { PlaceCallInput, RecordingFetch, TelephonyAdapter } from './types';

export interface TelephonyAdapterOptions {
  env: Readonly<Record<string, string | undefined>>;
  fetch?: typeof fetch;
}

/** The telephony adapter selected by TELEPHONY_MODE, else ADAPTER_MODE, else mock. Real = Twilio. */
export function createTelephonyAdapter({ env, fetch }: TelephonyAdapterOptions): TelephonyAdapter {
  return resolveAdapterMode(env, 'telephony') === 'real'
    ? createRealTelephonyAdapter({
        accountSid: env.TWILIO_ACCOUNT_SID,
        authToken: env.TWILIO_AUTH_TOKEN,
        fromNumber: env.TWILIO_PHONE_NUMBER,
        fetch,
      })
    : createMockTelephonyAdapter();
}
