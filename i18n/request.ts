// next-intl without locale-prefixed routing (AGENTS.md 3): the locale comes
// from the user's profile, else the NEXT_LOCALE cookie, else the state default.
import { catalogs } from '@/lib/i18n';
import { getRequestConfig } from 'next-intl/server';
import { getRequestLocale } from '@/server/auth/context';

export default getRequestConfig(async () => {
  const locale = await getRequestLocale();
  return { locale, messages: catalogs[locale], timeZone: 'Asia/Kolkata' };
});
