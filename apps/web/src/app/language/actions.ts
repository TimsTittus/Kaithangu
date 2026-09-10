'use server';

import { isSupportedLocale } from '@kaithangu/i18n';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getEnv } from '@/env';
import { getContext } from '@/server/auth/context';
import { LOCALE_COOKIE, safeNext } from '@/server/auth/routes';
import { getAuthService } from '@/server/services';

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/** Remember the chosen language (cookie, and the profile when signed in). */
export async function chooseLocale(formData: FormData): Promise<void> {
  const locale = formData.get('locale');
  const next = formData.get('next');
  if (typeof locale === 'string' && isSupportedLocale(locale)) {
    const cookieStore = await cookies();
    cookieStore.set(LOCALE_COOKIE, locale, {
      httpOnly: true,
      sameSite: 'lax',
      secure: getEnv().NODE_ENV === 'production',
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
    });
    const ctx = await getContext();
    if (ctx !== null) await getAuthService().setLocale(ctx, locale);
  }
  redirect(safeNext(typeof next === 'string' ? next : null, '/login'));
}
