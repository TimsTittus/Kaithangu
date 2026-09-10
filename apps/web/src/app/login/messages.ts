import { getTranslations } from 'next-intl/server';
import type { Messages } from '@/components/api';

const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'INVALID_PHONE',
  'OTP_INVALID',
  'OTP_EXPIRED',
  'OTP_ATTEMPTS_EXCEEDED',
  'RATE_LIMITED',
  'NOT_CONFIGURED',
  'INTERNAL',
] as const;

/** Translated error messages for the sign-in screens, keyed by messageKey. */
export async function signInMessages(): Promise<Messages> {
  const [errors, common] = await Promise.all([getTranslations('error'), getTranslations('common')]);
  const messages: Record<string, string> = { 'common.offline': common('offline') };
  for (const code of ERROR_CODES) messages[`error.${code}`] = errors(code);
  return messages;
}
