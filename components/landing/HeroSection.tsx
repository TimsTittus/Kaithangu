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
    <section className="relative overflow-hidden bg-white pt-8 pb-16 md:pt-14 md:pb-20 border-b border-slate-200/80">
      {/* Subtle Government Tricolor top aura */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 -z-10 h-72 w-full max-w-6xl -translate-x-1/2 bg-gradient-to-b from-orange-50/50 via-blue-50/30 to-transparent blur-2xl"
        aria-hidden="true"
      />

      <div className="mx-auto flex max-w-5xl flex-col items-center px-4 text-center">
        {/* Kerala Pilot & NCCT Badge in Official Government Style */}
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-900/20 bg-blue-50/70 px-4 py-1.5 text-xs font-bold text-[#0b3a75] shadow-xs">
          <Landmark className="size-3.5 text-[#0b3a75]" aria-hidden="true" />
          <span>{t('kerala_pilot')}</span>
          <span className="hidden sm:inline-block size-1 rounded-full bg-[#ff9933]" />
          <span className="hidden sm:inline-block text-[#138808] font-semibold">
            {t('hero_badge')}
          </span>
        </div>

        {/* Hero Title in Official Government Navy Typography */}
        <h1 className="mt-5 text-3xl font-black tracking-tight text-[#07254d] sm:text-5xl md:text-6xl max-w-4xl leading-[1.15]">
          {t('hero_title')}
        </h1>

        {/* Hero Subtitle */}
        <p className="mt-5 max-w-3xl text-base sm:text-lg text-slate-700 leading-relaxed font-normal">
          {t('hero_subtitle')}
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/language?next=%2Flogin"
            className="inline-flex min-h-13 flex-1 items-center justify-center gap-2.5 rounded-xl bg-[#0b3a75] hover:bg-[#07254d] px-6 text-base font-bold text-white shadow-md shadow-blue-950/15 transition-all hover:shadow-lg active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-[#0b3a75]"
          >
            <span>{t('cta_enter')}</span>
            <ArrowRight className="size-4.5 text-amber-300" aria-hidden="true" />
          </Link>

          <a
            href="#comparison"
            className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-6 text-base font-bold text-slate-800 shadow-xs transition-all hover:bg-slate-50 hover:border-slate-400 active:scale-[0.99]"
          >
            <span>{t('cta_explore')}</span>
            <ChevronDown className="size-4 text-slate-500" aria-hidden="true" />
          </a>
        </div>

        {/* ========================================================= */}
        {/* ATTACHED UI FEATURE SHOWCASE: "JUST ONE CALL" KEYPAD PHONE */}
        {/* Basic phone voice dial-in (Nokia 3310 style) for 9946 116 910 */}
        {/* ========================================================= */}
        <div className="mt-12 w-full max-w-3xl rounded-3xl border-2 border-slate-200 bg-gradient-to-b from-[#f8fafc] to-white p-6 sm:p-8 shadow-md relative overflow-hidden text-left">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* Left: Explanatory Badges & Headline */}
            <div className="flex-1 space-y-3">
              <div className="inline-flex items-center gap-1.5 rounded-md bg-[#ff9933]/15 px-2.5 py-1 text-xs font-black tracking-wide uppercase text-[#c2410c] border border-[#ff9933]/40">
                <Sparkles className="size-3 text-[#ea580c]" />
                <span>JUST ONE CALL • യാതൊരു സ്മാർട്ട്‌ഫോണും ആവശ്യമില്ല</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-[#07254d]">
                Universal Keypad Phone Voice Booking
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Senior citizens and informal workers without smartphones can dial our 24x7 toll-free IVR helpline in <span className="font-bold text-slate-900">Malayalam, Hindi, Tamil, or English</span>. Instant cooperative service dispatch right to your doorstep.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-bold text-slate-700">
                <span className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 border border-slate-200 shadow-2xs">
                  📞 Toll-Free: 9946 116 910
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 border border-emerald-200 text-emerald-800 shadow-2xs">
                  ✓ Any Basic 2G/4G Keypad Phone
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 border border-blue-200 text-[#0b3a75] shadow-2xs">
                  ✓ Zero Internet Needed
                </span>
              </div>
            </div>

            {/* Right: Tactile Nokia Keypad Phone Mockup with Service Badges */}
            <div className="relative flex flex-col items-center shrink-0">
              {/* Phone Device Body */}
              <div className="w-48 rounded-[36px] bg-slate-900 p-3 shadow-xl border-4 border-slate-800 ring-2 ring-slate-400/30">
                {/* Earpiece */}
                <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-700 mb-2" />

                {/* Nokia Branding Tag */}
                <div className="text-center text-[9px] font-black tracking-widest text-slate-400 uppercase mb-1.5">
                  KAITHANGU • IVR
                </div>

                {/* Classic Green Monochrome Screen */}
                <div className="rounded-xl bg-[#92b56e] p-2.5 text-slate-950 font-mono text-[10px] shadow-inner border border-[#7a9957] space-y-1">
                  <div className="flex justify-between text-[8px] font-bold border-b border-[#7a9957]/50 pb-0.5">
                    <span>📶 4G BSNL</span>
                    <span>🔋 100%</span>
                  </div>
                  <div className="text-center font-bold text-[10px] pt-1">
                    DIALING...
                  </div>
                  <div className="text-center font-black text-xs text-[#0f2b18] bg-[#81a45d]/40 rounded py-0.5 border border-[#7a9957]/40">
                    9946 116 910
                  </div>
                  <div className="text-center text-[8px] font-semibold text-slate-800">
                    ALL SERVICES IN ONE CALL
                  </div>
                </div>

                {/* Keypad Navigation buttons */}
                <div className="mt-2.5 grid grid-cols-3 gap-1">
                  <div className="h-4 rounded bg-slate-800 flex items-center justify-center text-[7px] text-emerald-400 font-bold">CALL</div>
                  <div className="h-4 rounded bg-slate-700 flex items-center justify-center text-[7px] text-white font-bold">MENU</div>
                  <div className="h-4 rounded bg-slate-800 flex items-center justify-center text-[7px] text-rose-400 font-bold">END</div>
                </div>

                {/* Number Keys (1-9, *, 0, #) */}
                <div className="mt-1.5 grid grid-cols-3 gap-1 text-[8px] font-bold text-slate-300">
                  <div className="h-5 rounded-md bg-slate-800/90 flex flex-col items-center justify-center shadow-2xs border border-slate-700/50">1</div>
                  <div className="h-5 rounded-md bg-slate-800/90 flex flex-col items-center justify-center shadow-2xs border border-slate-700/50">2</div>
                  <div className="h-5 rounded-md bg-slate-800/90 flex flex-col items-center justify-center shadow-2xs border border-slate-700/50">3</div>
                  <div className="h-5 rounded-md bg-slate-800/90 flex flex-col items-center justify-center shadow-2xs border border-slate-700/50">4</div>
                  <div className="h-5 rounded-md bg-slate-800/90 flex flex-col items-center justify-center shadow-2xs border border-slate-700/50">5</div>
                  <div className="h-5 rounded-md bg-slate-800/90 flex flex-col items-center justify-center shadow-2xs border border-slate-700/50">6</div>
                  <div className="h-5 rounded-md bg-slate-800/90 flex flex-col items-center justify-center shadow-2xs border border-slate-700/50">7</div>
                  <div className="h-5 rounded-md bg-slate-800/90 flex flex-col items-center justify-center shadow-2xs border border-slate-700/50">8</div>
                  <div className="h-5 rounded-md bg-slate-800/90 flex flex-col items-center justify-center shadow-2xs border border-slate-700/50">9</div>
                  <div className="h-5 rounded-md bg-slate-800/90 flex flex-col items-center justify-center shadow-2xs border border-slate-700/50">*</div>
                  <div className="h-5 rounded-md bg-slate-800/90 flex flex-col items-center justify-center shadow-2xs border border-slate-700/50">0</div>
                  <div className="h-5 rounded-md bg-slate-800/90 flex flex-col items-center justify-center shadow-2xs border border-slate-700/50">#</div>
                </div>
              </div>

              {/* Callout Trade Badges pointing to the phone (Style of Attached Image 1) */}
              <div className="absolute -left-6 top-6 hidden lg:block rounded-md bg-white px-2 py-0.5 text-[10px] font-black text-slate-800 border border-slate-300 shadow-xs">
                ⚡ Electrician
              </div>
              <div className="absolute -right-6 top-12 hidden lg:block rounded-md bg-white px-2 py-0.5 text-[10px] font-black text-slate-800 border border-slate-300 shadow-xs">
                🔧 Plumber
              </div>
              <div className="absolute -left-8 bottom-16 hidden lg:block rounded-md bg-white px-2 py-0.5 text-[10px] font-black text-slate-800 border border-slate-300 shadow-xs">
                🪚 Carpenter
              </div>
              <div className="absolute -right-8 bottom-8 hidden lg:block rounded-md bg-white px-2 py-0.5 text-[10px] font-black text-slate-800 border border-slate-300 shadow-xs">
                🛠️ Technician
              </div>
            </div>
          </div>
        </div>

        {/* 4 Psychological Pillars Metrics Cards in Crisp Official White Theme */}
        <div className="mt-10 grid w-full grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 text-left">
          {/* Stat 1: 100% Wage Entitlement */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-sm">
            <div className="flex items-center gap-1.5 text-emerald-800">
              <Sparkles className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-600">
                {t('stat_wage_label')}
              </span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black text-[#07254d]">
              {t('stat_wage_entitlement')}
            </div>
          </div>

          {/* Stat 2: Social Welfare */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-sm">
            <div className="flex items-center gap-1.5 text-amber-800">
              <Shield className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-600">
                {t('stat_welfare_label')}
              </span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black text-[#07254d]">
              {t('stat_welfare_benefit')}
            </div>
          </div>

          {/* Stat 3: Voice Dial-in Access */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-sm">
            <div className="flex items-center gap-1.5 text-blue-800">
              <PhoneCall className="size-4 shrink-0 text-[#0b3a75]" aria-hidden="true" />
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-600">
                {t('stat_access_label')}
              </span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black text-[#07254d]">
              {t('stat_access')}
            </div>
          </div>

          {/* Stat 4: Chained Ledger Audit */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-sm">
            <div className="flex items-center gap-1.5 text-emerald-800">
              <Award className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-600">
                {t('stat_audit_label')}
              </span>
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-black text-[#07254d]">
              {t('stat_audit')}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
