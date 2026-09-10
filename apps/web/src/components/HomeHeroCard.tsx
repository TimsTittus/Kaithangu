'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

interface HomeHeroCardProps {
  label: string;
  currency: string;
  cardLabel: string;
}

export function HomeHeroCard({ label, currency, cardLabel }: HomeHeroCardProps) {
  const [showBalance, setShowBalance] = useState(true);

  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-[#07382b] via-[#0c5643] to-[#04241b] p-4 text-white shadow-xl shadow-emerald-950/20">
      {/* Subtle decorative background circles */}
      <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-emerald-400/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 size-36 rounded-full bg-emerald-300/10 blur-xl" />

      <div className="relative z-10 flex items-center justify-between gap-2 min-w-0">
        {/* Left balance details */}
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium tracking-wide text-emerald-200/90 truncate">{label}</span>
            <button
              type="button"
              onClick={() => setShowBalance(!showBalance)}
              className="rounded-full p-1 text-emerald-200 hover:bg-emerald-800/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              aria-label={showBalance ? 'Hide balance' : 'Show balance'}
            >
              {showBalance ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            </button>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight">
              {showBalance ? '₹24,560.80' : '••••••••'}
            </span>
            <span className="rounded-full bg-emerald-800/70 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-100">
              {currency} ▾
            </span>
          </div>

          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-200/80 truncate">
            <span className="inline-block size-2 shrink-0 rounded-full bg-emerald-400 animate-pulse" />
            <span className="truncate">Cooperative Wallet</span>
          </div>
        </div>

        {/* Right mini card illustration */}
        <div className="relative shrink-0">
          <div className="relative flex h-16 w-22 -rotate-3 flex-col justify-between rounded-xl border border-emerald-400/30 bg-gradient-to-tr from-[#0b4d3c] to-[#15803d] p-2 shadow-lg shadow-black/20 backdrop-blur-xs transition-transform hover:rotate-0">
            <div className="flex items-center justify-between">
              {/* Card chip */}
              <div className="h-3 w-4 rounded-xs bg-gradient-to-r from-amber-200 to-amber-400 opacity-90" />
              <span className="text-[8px] font-extrabold tracking-widest text-emerald-100">COOP</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-[7px] tracking-wider text-emerald-200/80">•••• 4589</span>
              <span className="text-[7px] font-bold uppercase tracking-wider text-white">{cardLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
