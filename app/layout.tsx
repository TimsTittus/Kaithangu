import type { Metadata, Viewport } from 'next';
import {
  Noto_Sans,
  Noto_Sans_Devanagari,
  Noto_Sans_Malayalam,
  Noto_Sans_Tamil,
} from 'next/font/google';
import { getLocale, getTranslations } from 'next-intl/server';
import { CommonStringsProvider } from '@/components/CommonStrings';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { TRPCProvider } from '@/trpc/client';
import { HydrateClient } from '@/trpc/server';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kaithangu',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#047857',
};

// One Noto family per locale (AGENTS.md 7). None is preloaded and only the
// active locale's class is applied, so the browser downloads only that font.
const notoSans = Noto_Sans({ subsets: ['latin'], display: 'swap', preload: false });
const notoMalayalam = Noto_Sans_Malayalam({
  subsets: ['malayalam', 'latin'],
  display: 'swap',
  preload: false,
});
const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari', 'latin'],
  display: 'swap',
  preload: false,
});
const notoTamil = Noto_Sans_Tamil({ subsets: ['tamil', 'latin'], display: 'swap', preload: false });

const FONT_CLASS: Readonly<Record<string, string>> = {
  en: notoSans.className,
  ml: notoMalayalam.className,
  hi: notoDevanagari.className,
  ta: notoTamil.className,
};

// Locale: profile → NEXT_LOCALE cookie → state default (i18n/request.ts).
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
    <html
      lang={locale}
      className={`${FONT_CLASS[locale] ?? notoSans.className} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TRPCProvider>
          <HydrateClient>
            <CommonStringsProvider value={common}>
              <OfflineBanner />
              <ServiceWorkerRegister />
              {children}
            </CommonStringsProvider>
          </HydrateClient>
        </TRPCProvider>
      </body>
    </html>
  );
}
