import type { Locale } from '@kaithangu/i18n';
import { PhoneCall, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { LanguageDropdown } from './LanguageDropdown';

export async function GovtHeader() {
  const t = await getTranslations('landing');
  const tLang = await getTranslations('language.name');
  const currentLocale = (await getLocale()) as Locale;

  const localeNames: Record<Locale, string> = {
    en: tLang('en'),
    ml: tLang('ml'),
    hi: tLang('hi'),
    ta: tLang('ta'),
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-emerald-900/10 bg-white/95 backdrop-blur-md dark:border-white/10 dark:bg-[#0c1813]/95">
      {/* Indian National Tricolor indicator */}
      <div
        className="h-1.5 w-full bg-gradient-to-r from-[#FF9933] via-[#FFFFFF] to-[#138808]"
        aria-hidden="true"
      />

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        {/* Emblem & Ministry Masthead */}
        <div className="flex items-center gap-3">
          {/* Ashoka / National Seal emblem stylized badge */}
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-sm ring-2 ring-amber-400/30 dark:from-amber-600 dark:to-amber-900">
            <ShieldCheck className="size-6 text-white" aria-hidden="true" />
          </div>

          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-neutral-600 dark:text-neutral-400">
              <span>{t('govt_title')}</span>
              <span className="text-emerald-600 dark:text-emerald-400">•</span>
              <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                {t('govt_subtitle')}
              </span>
            </div>
            <div className="text-sm font-bold text-neutral-900 dark:text-white sm:text-base flex items-center gap-2">
              <span>{t('ncct_title')}</span>
              <span className="hidden sm:inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/40">
                {t('initiative_badge')}
              </span>
            </div>
          </div>
        </div>

        {/* Right side: Helpline + Google Translate dropdown + Sign In CTA */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Toll-free phone callout for keypad phones */}
          <a
            href="tel:18004250100"
            className="hidden lg:flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-1.5 text-xs font-medium text-emerald-900 transition-colors hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            <PhoneCall className="size-3.5 text-emerald-700 dark:text-emerald-400 animate-pulse" />
            <span>{t('helpline_text')}</span>
          </a>

          {/* Google Translate Style Language Dropdown */}
          <LanguageDropdown currentLocale={currentLocale} localeNames={localeNames} />

          {/* Sign In / Portal CTA -> /language?next=%2Flogin */}
          <Link
            href="/language?next=%2Flogin"
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-800 active:scale-95 focus-visible:outline-2 focus-visible:outline-emerald-600"
          >
            <span>{t('choose_lang_btn')}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}