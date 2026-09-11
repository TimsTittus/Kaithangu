import { ArrowRight, Landmark } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function GovtFooter() {
  const t = await getTranslations('landing');

  return (
    <footer className="w-full border-t border-emerald-950/10 bg-white dark:border-white/10 dark:bg-[#08120d]">
      {/* Big Action Banner */}
      <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-900 p-8 md:p-12 text-center text-white shadow-xl relative overflow-hidden">
          {/* Subtle background ornamentation */}
          <div
            className="pointer-events-none absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-white/10 blur-2xl"
            aria-hidden="true"
          />

          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            {t('cta_banner_title')}
          </h2>

          <p className="mt-4 max-w-xl mx-auto text-sm sm:text-base text-emerald-100 leading-relaxed">
            {t('cta_banner_subtitle')}
          </p>

          <div className="mt-8 flex justify-center">
            <Link
              href="/language?next=%2Flogin"
              className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-white px-8 text-lg font-bold text-emerald-900 shadow-lg transition-all hover:bg-emerald-50 active:scale-95 focus-visible:outline-3 focus-visible:outline-white"
            >
              <span>{t('cta_banner_btn')}</span>
              <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      {/* Official Government & Ministerial Disclaimer Bar */}
      <div className="border-t border-emerald-900/10 bg-neutral-50 px-4 py-8 dark:border-white/10 dark:bg-[#060c09]">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-600 text-white">
              <Landmark className="size-5" />
            </div>
            <div className="text-left">
              <div className="text-xs font-extrabold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                {t('govt_title')} • {t('govt_subtitle')}
              </div>
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {t('ncct_title')}
              </div>
            </div>
          </div>

          <p className="max-w-2xl text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {t('footer_disclaimer')}
          </p>

          <div className="flex flex-wrap justify-center gap-4 text-xs text-neutral-600 dark:text-neutral-400 pt-2 border-t border-neutral-200 dark:border-neutral-800 w-full">
            <span>{t('footer_rights')}</span>
            <span>•</span>
            <span>{t('footer_ncct')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
