import { getLocale, getTranslations } from 'next-intl/server';
import { LanguageDropdown } from '@/components/landing/LanguageDropdown';
import type { Locale } from '@/lib/i18n';

/**
 * The landing page's language dropdown, returning to the customer screen it was
 * opened from instead of the public landing page.
 */
export async function UserLanguageDropdown({ next }: { next: string }) {
  const [tLang, currentLocale] = await Promise.all([
    getTranslations('language.name'),
    getLocale() as Promise<Locale>,
  ]);
  const localeNames: Record<Locale, string> = {
    en: tLang('en'),
    ml: tLang('ml'),
    hi: tLang('hi'),
    ta: tLang('ta'),
  };
  return <LanguageDropdown currentLocale={currentLocale} localeNames={localeNames} next={next} />;
}
