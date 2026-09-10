import { NotConfiguredError, type SmsAdapter } from './types';

/**
 * Real SMS delivery needs a DLT-registered provider (not chosen yet). Until
 * then every send fails loudly rather than silently dropping messages.
 */
export function createRealSmsAdapter(): SmsAdapter {
  return {
    send() {
      return Promise.reject(new NotConfiguredError('sms'));
    },
  };
}
