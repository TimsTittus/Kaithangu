import { ERROR_CODES, errorMessageKey } from '@/lib/core';
import { getTranslations } from 'next-intl/server';

/**
 * Raw catalog messages (placeholders unformatted) for client components, so
 * the client bundle carries no i18n runtime. Server-only.
 */
export async function rawMessages(keys: readonly string[]): Promise<Record<string, string>> {
  const t = await getTranslations();
  return Object.fromEntries(keys.map((key) => [key, String(t.raw(key))]));
}

/** Every error.* message plus common.offline, keyed by messageKey. */
export function errorMessages(): Promise<Record<string, string>> {
  return rawMessages([...ERROR_CODES.map(errorMessageKey), 'common.offline']);
}
