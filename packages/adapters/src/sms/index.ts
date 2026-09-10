import { resolveAdapterMode } from '../index';
import type { DevInboxRedis } from './devInbox';
import { createMockSmsAdapter, type AdapterLogger } from './mock';
import { createRealSmsAdapter } from './real';
import type { SmsAdapter } from './types';

export {
  DEV_INBOX_CAP,
  DEV_INBOX_KEY,
  devInboxEntrySchema,
  pushDevInbox,
  readDevInbox,
  type DevInboxEntry,
  type DevInboxRedis,
} from './devInbox';
export { createMockSmsAdapter, type AdapterLogger, type MockSmsOptions } from './mock';
export { createRealSmsAdapter } from './real';
export {
  isNotConfiguredError,
  NotConfiguredError,
  renderSms,
  SMS_TEMPLATE_KEYS,
  type SmsAdapter,
  type SmsMessage,
  type SmsTemplateKey,
} from './types';

export interface SmsAdapterOptions {
  env: Readonly<Record<string, string | undefined>>;
  redis: DevInboxRedis;
  logger: AdapterLogger;
}

/** The SMS adapter selected by SMS_MODE, else ADAPTER_MODE, else mock. */
export function createSmsAdapter({ env, redis, logger }: SmsAdapterOptions): SmsAdapter {
  return resolveAdapterMode(env, 'sms') === 'real'
    ? createRealSmsAdapter()
    : createMockSmsAdapter({ redis, logger });
}
