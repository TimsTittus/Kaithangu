import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { CommonStringsProvider } from '@/components/CommonStrings';
import { OfflineBanner } from '@/components/OfflineBanner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kaithangu',
};

// Locale: profile → NEXT_LOCALE cookie → state default (src/i18n/request.ts).
// TODO_VERIFY-free note: per-locale Noto fonts are not loaded yet (PROGRESS.md).
export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const locale = await getLocale();
  const t = await getTranslations('common');
  const common = {
    locale,
    offline: t('offline'),
    errorTitle: t('error_title'),
    retry: t('retry'),
    loading: t('loading'),
    playAudio: t('play_audio'),
  };
  return (
    <html lang={locale} className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <CommonStringsProvider value={common}>
          <OfflineBanner />
          {children}
        </CommonStringsProvider>
      </body>
    </html>
  );
}
