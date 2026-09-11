// Client-safe money formatting: core/money.ts has no runtime dependencies,
// and amounts stay integer paise until Intl formats an exact decimal string.
import { formatINR, paise } from '@/lib/core/money';
import type { Locale } from '@/lib/i18n';

export function formatPaise(amount: number, locale: string): string {
  return formatINR(paise(amount), locale as Locale);
}
