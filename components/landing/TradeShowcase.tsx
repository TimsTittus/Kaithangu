import { TRADE_ICONS } from '@/components/TradeGrid';
import { isCertifiedRequired, TRADE_CODES } from '@/lib/core/trades';
import { BadgeCheck, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function TradeShowcase() {
  const tLanding = await getTranslations('landing');
  const tTrade = await getTranslations('trade');

  return (
    <section className="py-12 md:py-20 bg-[#f8fafc] border-b border-slate-200">
      <div className="mx-auto max-w-5xl px-4">
        {/* Title */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3.5 py-1 text-xs font-bold text-[#0b3a75] border border-blue-200 shadow-2xs">
            <Briefcase
              className="size-3.5 text-[#0b3a75]"
              aria-hidden="true"
            />
            <span>{tLanding('trades_badge')}</span>
          </div>

          <h2 className="mt-4 text-2xl sm:text-4xl font-black text-[#07254d]">
            {tLanding('trades_title')}
          </h2>

          <p className="mt-3 max-w-xl mx-auto text-sm sm:text-base text-slate-600 leading-relaxed">
            {tLanding('trades_subtitle')}
          </p>
        </div>

        {/* Trade Grid */}
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5 sm:gap-4">
          {TRADE_CODES.map((code) => {
            const Icon = TRADE_ICONS[code];
            const name = tTrade(code);
            const isCertified = isCertifiedRequired(code);

            return (
              <Link
                key={code}
                href="/language?next=%2Flogin"
                className="group flex flex-col items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-xs transition-all hover:-translate-y-0.5 hover:border-[#0b3a75] hover:shadow-md"
              >
                <div className="flex size-14 items-center justify-center rounded-xl bg-slate-50 text-[#0b3a75] border border-slate-200/80 transition-colors group-hover:bg-[#0b3a75] group-hover:text-white group-hover:border-[#0b3a75]">
                  <Icon className="size-7" />
                </div>

                <div className="mt-3 font-bold text-sm sm:text-base text-slate-900">
                  {name}
                </div>

                <div className="mt-2.5 flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-[#138808]">
                  <BadgeCheck className="size-3" />
                  <span>{isCertified ? 'Certified' : 'Verified'}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
