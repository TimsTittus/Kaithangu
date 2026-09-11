import { TRADE_CODES, type TradeCode } from '@/lib/core/trades';
import {
  Car,
  Cpu,
  Hammer,
  HeartHandshake,
  House,
  Paintbrush,
  Sparkles,
  Sprout,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AudioLabel } from './AudioLabel';

/** Same icons as trades.icon in the reference data (packages/db seed). */
export const TRADE_ICONS: Readonly<Record<TradeCode, LucideIcon>> = {
  plumber: Wrench,
  electrician: Zap,
  carpenter: Hammer,
  painter: Paintbrush,
  domestic_help: House,
  caregiver: HeartHandshake,
  driver: Car,
  gardener: Sprout,
  cleaner: Sparkles,
  technician: Cpu,
};

/** The 10 trades as large modern tiles, each with an icon, label and audio button. */
export async function TradeGrid({ emergency = false }: { emergency?: boolean }) {
  const t = await getTranslations('trade');
  const border = emergency
    ? 'border-red-500/80 dark:border-red-700/80 bg-red-50/20 dark:bg-red-950/20'
    : 'border-emerald-950/10 dark:border-white/10 bg-white dark:bg-[#101e18]';
  return (
    <ul className="grid grid-cols-2 gap-3.5">
      {TRADE_CODES.map((code) => {
        const Icon = TRADE_ICONS[code];
        const label = t(code);
        const href = emergency ? `/app/book/${code}?urgency=emergency` : `/app/book/${code}`;
        return (
          <li
            key={code}
            className={`flex flex-col justify-between rounded-3xl border p-2.5 shadow-[0_4px_16px_rgb(0,0,0,0.03)] transition-all hover:border-emerald-500/50 hover:shadow-md ${border}`}
          >
            <Link
              href={href}
              data-testid={`trade-${code}`}
              className="flex min-h-24 flex-1 flex-col items-center justify-center gap-2.5 rounded-2xl px-2 py-3 text-center text-base font-semibold break-words transition-colors hover:bg-emerald-50/60 focus-visible:outline-3 focus-visible:outline-emerald-600 dark:hover:bg-neutral-800/60"
            >
              <div
                className={`flex size-12 items-center justify-center rounded-2xl shadow-sm ${
                  emergency
                    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                    : 'bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                }`}
              >
                <Icon aria-hidden className="size-6 shrink-0" />
              </div>
              <span className="max-w-full text-neutral-800 dark:text-neutral-100">{label}</span>
            </Link>
            <div className="flex justify-center pb-1">
              <AudioLabel k={`trade.${code}`} text={label} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
