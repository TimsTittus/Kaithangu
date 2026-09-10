import { NotConfiguredError, type TelephonyAdapter } from './types';

/**
 * Real IVR calls need Twilio wiring in apps/voice, which does not exist yet
 * (a later voice phase). Until then every call fails loudly rather than
 * silently dropping the notification.
 */
export function createRealTelephonyAdapter(): TelephonyAdapter {
  return {
    call() {
      return Promise.reject(new NotConfiguredError('telephony'));
    },
  };
}
