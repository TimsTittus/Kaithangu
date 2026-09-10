import { pushDevInbox, type DevInboxRedis } from '../sms/devInbox';
import { renderCall, type TelephonyAdapter } from './types';

export interface AdapterLogger {
  info(object: Record<string, unknown>, message: string): void;
}

export interface MockTelephonyOptions {
  redis: DevInboxRedis;
  logger: AdapterLogger;
  now?: () => Date;
}

/** Logs "would call" and writes to the shared dev inbox instead of dialling. */
export function createMockTelephonyAdapter({
  redis,
  logger,
  now = () => new Date(),
}: MockTelephonyOptions): TelephonyAdapter {
  return {
    async call(input) {
      const text = renderCall(input);
      await pushDevInbox(redis, { to: input.to, text: `[call] ${text}`, at: now().toISOString() });
      logger.info({ to: input.to, templateKey: input.templateKey }, 'would call (mock telephony)');
    },
  };
}
