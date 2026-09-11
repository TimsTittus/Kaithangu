import {
  ArrowRight,
  Award,
  ChevronDown,
  Landmark,
  PhoneCall,
  Shield,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function HeroSection() {
  const t = await getTranslations('landing');

  return (
    <section className="relative overflow-hidden pt-10 pb-16 md:pt-16 md:pb-24">
      {/* Subtle decorative background glow */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-96 w-full max-w-4xl -translate-x-1/2 rounded-full bg-gradient-to-tr from-emerald-400/20 via-teal-300/15 to-amber-300/10 blur-3xl dark:from-emerald-900/30 dark:via-teal-900/20 dark:to-transparent"
        aria-hidden="true"
      />

      <div className="mx-auto flex max-w-5xl flex-col items-center px-4 text-center">
        {/* Kerala Pilot & NCCT Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-600/30 bg-emerald-50/80 px-4 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm backdrop-blur-sm dark:border-emerald-500/30 dark:bg-emerald-950/60 dark:text-emerald-300">
          <Landmark
            className="size-3.5 text-emerald-700 dark:text-emerald-400"
            aria-hidden="true"
          />
          <span>{t('kerala_pilot')}</span>
          <span className="hidden sm:inline-block size-1 rounded-full bg-emerald-500" />
          <span className="hidden sm:inline-block text-emerald-600 dark:text-emerald-400 font-medium">
            {t('hero_badge')}
          </span>
        </div>

        {/* Hero Title */}
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-neutral-950 sm:text-5xl md:text-6xl dark:text-white max-w-4xl leading-[1.15]">
          <span className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 bg-clip-text text-transparent dark:from-emerald-300 dark:via-teal-200 dark:to-emerald-400">
            {t('hero_title')}
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="mt-6 max-w-2xl text-base sm:text-lg text-neutral-700 dark:text-neutral-300 leading-relaxed">
          {t('hero_subtitle')}
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/language?next=%2Flogin"
            className="inline-flex min-h-14 flex-1 items-center justify-center gap-3 rounded-2xl bg-emerald-700 px-6 text-lg font-bold text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-800 active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-emerald-600"
          >
            <span>{t('cta_enter')}</span>
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>

          <a
            href="#comparison"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-neutral-300 bg-white/90 px-6 text-base font-semibold text-neutral-800 shadow-sm transition-all hover:bg-neutral-50 active:scale-[0.98] dark:border-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <span>{t('cta_explore')}</span>
            <ChevronDown className="size-4 text-neutral-500" aria-hidden="true" />
          </a>
        </div>

        {/* 4 Psychological Pillars Metrics Cards */}
        <div className="mt-14 grid w-full grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 text-left">
          {/* Stat 1 */}
          <div className="flex flex-col rounded-3xl border border-emerald-900/10 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#111e18]/80">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Sparkles className="size-4 shrink-0" aria-hidden="true" />
              <span className="text-xs font-semibold tracking-wide uppercase">
                {t('stat_wage_label')}
              </span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
              {t('stat_wage_entitlement')}
            </div>
          </div>

          {/* Stat 2 */}
          <div className="flex flex-col rounded-3xl border border-emerald-900/10 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#111e18]/80">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Shield className="size-4 shrink-0" aria-hidden="true" />
              <span className="text-xs font-semibold tracking-wide uppercase">
                {t('stat_welfare_label')}
              </span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
              {t('stat_welfare_benefit')}
            </div>
          </div>

          {/* Stat 3 */}
          <div className="flex flex-col rounded-3xl border border-emerald-900/10 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#111e18]/80">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <PhoneCall className="size-4 shrink-0" aria-hidden="true" />
              <span className="text-xs font-semibold tracking-wide uppercase">
                {t('stat_access_label')}
              </span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
              {t('stat_access')}
            </div>
          </div>

          {/* Stat 4 */}
          <div className="flex flex-col rounded-3xl border border-emerald-900/10 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#111e18]/80">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Award className="size-4 shrink-0" aria-hidden="true" />
              <span className="text-xs font-semibold tracking-wide uppercase">
                {t('stat_audit_label')}
              </span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
              {t('stat_audit')}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
