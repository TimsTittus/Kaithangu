import { getEnv } from '@/env';

/** The /dev/inbox page exists only when DEV_INBOX=true. */
export function isDevInboxEnabled(): boolean {
  return getEnv().DEV_INBOX;
}
