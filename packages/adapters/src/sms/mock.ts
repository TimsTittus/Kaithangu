import { pushDevInbox, type DevInboxRedis } from './devInbox';
import { renderSms, type SmsAdapter } from './types';

export interface AdapterLogger {
  info(object: Record<string, unknown>, message: string): void;
}

export interface MockSmsOptions {
  redis: DevInboxRedis;
  logger: AdapterLogger;
  now?: () => Date;
}

/** Writes messages to the dev inbox instead of sending them. Works offline. */
export function createMockSmsAdapter({
  redis,
  logger,
  now = () => new Date(),
}: MockSmsOptions): SmsAdapter {
  return {
    async send(message) {
      const text = renderSms(message);
      await pushDevInbox(redis, { to: message.to, text, at: now().toISOString() });
      // The text may contain a code, so only the template is logged.
      logger.info({ to: message.to, templateKey: message.templateKey }, 'mock sms queued');
    },
  };
}
