import { resolveAdapterMode } from '../index';
import type { DevInboxRedis } from '../sms/devInbox';
import { createMockTelephonyAdapter, type AdapterLogger } from './mock';
import { createRealTelephonyAdapter } from './real';
import type { TelephonyAdapter } from './types';

export { createMockTelephonyAdapter, type AdapterLogger, type MockTelephonyOptions } from './mock';
export { createRealTelephonyAdapter } from './real';
export {
  isNotConfiguredError,
  NotConfiguredError,
  renderCall,
  TELEPHONY_TEMPLATE_KEYS,
  type TelephonyAdapter,
  type TelephonyCall,
  type TelephonyTemplateKey,
} from './types';

export interface TelephonyAdapterOptions {
  env: Readonly<Record<string, string | undefined>>;
  redis: DevInboxRedis;
  logger: AdapterLogger;
}

/** The telephony adapter selected by TELEPHONY_MODE, else ADAPTER_MODE, else mock. */
export function createTelephonyAdapter({
  env,
  redis,
  logger,
}: TelephonyAdapterOptions): TelephonyAdapter {
  return resolveAdapterMode(env, 'telephony') === 'real'
    ? createRealTelephonyAdapter()
    : createMockTelephonyAdapter({ redis, logger });
}
