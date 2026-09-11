'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

interface SpendingAnalysisCardProps {
  title: string;
  monthLabel: string;
}

export function SpendingAnalysisCard({ title, monthLabel }: SpendingAnalysisCardProps) {
  const bars = [
    { height: '40%', active: false },
    { height: '65%', active: false },
    { height: '50%', active: false },
    { height: '85%', active: true, label: '₹520' },
    { height: '45%', active: false },
    { height: '70%', active: false },
    { height: '55%', active: false },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#07382b] p-5 text-white shadow-xl shadow-emerald-950/20">
      {/* Glow background accent */}
      <div className="pointer-events-none absolute -right-6 -bottom-6 size-36 rounded-full bg-emerald-400/10 blur-xl" />

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <Link
          href="/user/analytics"
          className="flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-100"
        >
          {monthLabel}
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      {/* Bar chart visualization */}
      <div className="mt-4 flex h-28 items-end justify-between gap-1.5 px-1 pb-1">
        {bars.map((bar, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1 min-w-0">
            {bar.active && (
              <span className="rounded-full bg-emerald-400 px-1 py-0.5 text-[9px] font-bold text-[#07382b] shadow-sm truncate">
                {bar.label}
              </span>
            )}
            <div className="relative w-full max-w-[18px] flex-1 rounded-t-lg bg-emerald-950/40">
              <div
                style={{ height: bar.height }}
                className={`absolute bottom-0 w-full rounded-t-lg transition-all ${
                  bar.active
                    ? 'bg-gradient-to-t from-emerald-500 to-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]'
                    : 'bg-emerald-700/60'
                }`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Subtle bottom circular donut arc indicator */}
      <div className="mt-2 flex items-center justify-between border-t border-emerald-800/60 pt-3 text-xs text-emerald-200/80">
        <span>Cooperative Welfare Allocation</span>
        <span className="font-semibold text-emerald-300">74% Target</span>
      </div>
    </div>
  );
}
