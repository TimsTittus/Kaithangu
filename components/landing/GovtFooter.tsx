import { ArrowRight, Landmark } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function GovtFooter() {
  const t = await getTranslations('landing');

  return (
    <footer className="w-full bg-white border-t border-slate-200">
      {/* Big Action Banner in Official Government Navy */}
      <div className="mx-auto max-w-5xl px-4 py-12 md:py-16">
        <div className="rounded-3xl bg-gradient-to-r from-[#07254d] via-[#0b3a75] to-[#0e3b79] p-8 md:p-12 text-center text-white shadow-lg relative overflow-hidden border border-blue-900/40">
          {/* Subtle national flag glow accent */}
          <div
            className="pointer-events-none absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-[#138808]/20 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -top-10 -left-10 h-64 w-64 rounded-full bg-[#ff9933]/15 blur-3xl"
            aria-hidden="true"
          />

          <div className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300 border border-white/15 mb-4">
            <span>🇮🇳 Sahakar Se Samriddhi • സഹകരണത്തിലൂടെ സമൃദ്ധി</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
            {t('cta_banner_title')}
          </h2>

          <p className="mt-4 max-w-xl mx-auto text-sm sm:text-base text-blue-100 leading-relaxed">
            {t('cta_banner_subtitle')}
          </p>

          <div className="mt-8 flex justify-center">
            <Link
              href="/language?next=%2Flogin"
              className="inline-flex min-h-13 items-center justify-center gap-2.5 rounded-xl bg-white px-8 text-base font-bold text-[#0b3a75] shadow-md transition-all hover:bg-amber-50 active:scale-95 focus-visible:outline-2 focus-visible:outline-white"
            >
              <span>{t('cta_banner_btn')}</span>
              <ArrowRight className="size-4.5 text-[#ea580c]" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      {/* Official Government & Ministerial Disclaimer Bar */}
      <div className="border-t border-slate-200 bg-[#f8fafc] px-4 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#0b3a75] text-amber-300 shadow-2xs">
              <Landmark className="size-5" />
            </div>
            <div className="text-left">
              <div className="text-xs font-black uppercase tracking-wider text-slate-800">
                {t('govt_title')} • {t('govt_subtitle')}
              </div>
              <div className="text-xs font-bold text-[#0b3a75]">
                {t('ncct_title')}
              </div>
            </div>
          </div>

          <p className="max-w-2xl text-xs text-slate-600 leading-relaxed font-medium">
            {t('footer_disclaimer')}
          </p>

          {/* Standard Indian Govt Portal Quick Accessibility Links */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-bold text-slate-700 pt-2 border-t border-slate-200 w-full">
            <span>Toll-Free Helpline: 9946 116 910</span>
            <span>•</span>
            <span>National Portal of India (india.gov.in)</span>
            <span>•</span>
            <span>Ministry of Cooperation (cooperation.gov.in)</span>
          </div>

          <div className="flex flex-wrap justify-center gap-4 text-[11px] text-slate-500 pt-1 w-full">
            <span>{t('footer_rights')}</span>
            <span>•</span>
            <span>{t('footer_ncct')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
