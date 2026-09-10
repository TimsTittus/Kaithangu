import { TRADE_CODES, type TradeCode } from '@kaithangu/core/trades';
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

/** The 10 trades as large tiles, each with an icon, label and audio button. */
export async function TradeGrid({ emergency = false }: { emergency?: boolean }) {
  const t = await getTranslations('trade');
  const border = emergency ? 'border-red-700' : 'border-neutral-300 dark:border-neutral-600';
  return (
    <ul className="grid grid-cols-2 gap-3">
      {TRADE_CODES.map((code) => {
        const Icon = TRADE_ICONS[code];
        const label = t(code);
        const href = emergency ? `/app/book/${code}?urgency=emergency` : `/app/book/${code}`;
        return (
          <li key={code} className={`flex flex-col rounded-2xl border-2 ${border}`}>
            <Link
              href={href}
              data-testid={`trade-${code}`}
              className="flex min-h-24 flex-1 flex-col items-center justify-center gap-2 rounded-t-2xl px-2 pt-3 text-center text-base font-semibold break-words hover:bg-emerald-50 focus-visible:outline-3 focus-visible:outline-emerald-600 dark:hover:bg-neutral-800"
            >
              <Icon aria-hidden className="size-8 shrink-0" />
              <span className="max-w-full">{label}</span>
            </Link>
            <div className="flex justify-center pb-2">
              <AudioLabel k={`trade.${code}`} text={label} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
