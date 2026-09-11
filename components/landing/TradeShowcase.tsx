import { TRADE_ICONS } from '@/components/TradeGrid';
import { isCertifiedRequired, TRADE_CODES } from '@/lib/core/trades';
import { BadgeCheck, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function TradeShowcase() {
  const tLanding = await getTranslations('landing');
  const tTrade = await getTranslations('trade');

  return (
    <section className="py-12 md:py-20 bg-neutral-100/50 dark:bg-[#0c1612]/50">
      <div className="mx-auto max-w-5xl px-4">
        {/* Title */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/90 px-3.5 py-1 text-xs font-bold text-emerald-900 border border-emerald-300/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700/40">
            <Briefcase
              className="size-3.5 text-emerald-700 dark:text-emerald-400"
              aria-hidden="true"
            />
            <span>{tLanding('trades_badge')}</span>
          </div>

          <h2 className="mt-4 text-2xl sm:text-4xl font-black text-neutral-950 dark:text-white">
            {tLanding('trades_title')}
          </h2>

          <p className="mt-3 max-w-xl mx-auto text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
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
                className="group flex flex-col items-center justify-between rounded-3xl border border-emerald-900/10 bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-500/60 hover:shadow-md dark:border-white/10 dark:bg-[#111e18]"
              >
                <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-100/80 text-emerald-800 transition-colors group-hover:bg-emerald-700 group-hover:text-white dark:bg-emerald-950 dark:text-emerald-300">
                  <Icon className="size-7" />
                </div>

                <div className="mt-3 font-bold text-sm sm:text-base text-neutral-900 dark:text-white">
                  {name}
                </div>

                <div className="mt-2 flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
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
