import type { Locale } from '@/lib/i18n';
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
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/90 bg-white/98 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] backdrop-blur-md">
      {/* Indian National Tricolor top bar */}
      <div
        className="h-1.5 w-full bg-gradient-to-r from-[#FF9933] via-[#FFFFFF] to-[#138808]"
        aria-hidden="true"
      />

      {/* Official Government Accessibility & National Utility Strip */}
      <div className="border-b border-slate-100 bg-[#f8fafc] px-4 py-1 text-[11px] text-slate-600">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
              <span className="text-xs" aria-hidden="true">🇮🇳</span>
              <span>भारत सरकार</span>
              <span className="text-slate-400">|</span>
              <span>Government of India</span>
            </span>
            <span className="hidden md:inline-block text-slate-300">•</span>
            <span className="hidden md:inline-block text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/70">
              {t('kerala_pilot')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Toll-free phone callout */}
            <a
              href="tel:9946116910"
              className="flex items-center gap-1.5 font-bold text-[#0b3a75] hover:underline"
              title="Toll-free IVR Voice Dial-in for basic phones"
            >
              <PhoneCall className="size-3 text-[#ea580c]" />
              <span className="hidden sm:inline">Toll-Free:</span>
              <span>9946 116 910</span>
            </a>

            {/* Accessibility text resize standard in Indian Govt portals */}
            <div className="hidden lg:flex items-center gap-1 pl-2 border-l border-slate-200 text-slate-700 font-semibold">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider mr-1">Text:</span>
              <span className="cursor-default px-1 py-0.2 rounded hover:bg-slate-200 text-[10px]" title="Default Size">A</span>
              <span className="cursor-default px-1 py-0.2 rounded hover:bg-slate-200 text-[11px] font-bold" title="Large Size">A+</span>
            </div>
          </div>
        </div>
      </div>

      {/* Official Ministry Masthead & Navigation */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        {/* Emblem & Ministry Titles */}
        <div className="flex items-center gap-3.5">
          {/* Ashoka / National Seal emblem badge */}
          <div className="relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0b3a75] to-[#07254d] text-white shadow-md ring-2 ring-amber-400/50">
            <ShieldCheck className="size-6 text-amber-300" aria-hidden="true" />
            <div className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[8px] font-black text-white shadow">
              ★
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold tracking-wide uppercase text-slate-700">
              <span className="text-[#0b3a75]">{t('govt_title')}</span>
              <span className="text-slate-300">•</span>
              <span className="text-[#138808]">
                {t('govt_subtitle')}
              </span>
            </div>
            <div className="text-sm font-extrabold text-slate-900 sm:text-base flex items-center gap-2">
              <span>{t('ncct_title')}</span>
              <span className="hidden sm:inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 border border-amber-300/80 shadow-xs">
                {t('initiative_badge')}
              </span>
            </div>
          </div>
        </div>

        {/* Right side: Language Selector + Sign In / Portal CTA */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Google Translate Style Regional Language Dropdown */}
          <LanguageDropdown currentLocale={currentLocale} localeNames={localeNames} />

          {/* Sign In / Portal CTA */}
          <Link
            href="/language?next=%2Flogin"
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[#0b3a75] hover:bg-[#07254d] px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm transition-all hover:shadow active:scale-95 focus-visible:outline-2 focus-visible:outline-[#0b3a75]"
          >
            <span>{t('choose_lang_btn')}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
