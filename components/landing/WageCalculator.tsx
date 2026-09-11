'use client';

import {
  ArrowRight,
  Calculator,
  Check,
  HeartHandshake,
  Info,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

interface WageCalcProps {
  labels: {
    badge: string;
    title: string;
    subtitle: string;
    selectTrade: string;
    selectDuration: string;
    workerReceives: string;
    workerNote: string;
    welfareContribution: string;
    welfareNote: string;
    platformFee: string;
    platformNote: string;
    customerTotal: string;
    aggregatorContrast: string;
    ctaButton: string;
  };
  tradeNames: Record<string, string>;
}

interface TradeOption {
  code: string;
  hourlyRate: number; // in INR
}

const TRADES: TradeOption[] = [
  { code: 'electrician', hourlyRate: 300 },
  { code: 'plumber', hourlyRate: 280 },
  { code: 'carpenter', hourlyRate: 290 },
  { code: 'technician', hourlyRate: 350 },
  { code: 'painter', hourlyRate: 260 },
  { code: 'cleaner', hourlyRate: 220 },
];

const DURATIONS = [1, 2, 4, 8];

export function WageCalculator({ labels, tradeNames }: WageCalcProps) {
  const [selectedTrade, setSelectedTrade] = useState<string>('electrician');
  const [duration, setDuration] = useState<number>(2);

  const activeTrade = useMemo(
    () => TRADES.find((t) => t.code === selectedTrade) ?? TRADES[0]!,
    [selectedTrade],
  );

  const wage = activeTrade.hourlyRate * duration;
  const welfare = Math.round(wage * 0.1); // 10% statutory welfare
  const platform = Math.round(wage * 0.05); // 5% platform infrastructure
  const total = wage + welfare + platform;

  // Private aggregator comparison (takes 30% from worker)
  const corpCut = Math.round(wage * 0.3);
  const workerCorpAmount = wage - corpCut;

  const contrastText = labels.aggregatorContrast
    .replace('{workerCorpAmount}', `₹${workerCorpAmount}`)
    .replace('{corpCutAmount}', `₹${corpCut}`);

  return (
    <section className="py-12 md:py-20">
      <div className="mx-auto max-w-4xl px-4">
        {/* Title */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/90 px-3.5 py-1 text-xs font-bold text-emerald-900 border border-emerald-300/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700/40">
            <Calculator
              className="size-3.5 text-emerald-700 dark:text-emerald-400"
              aria-hidden="true"
            />
            <span>{labels.badge}</span>
          </div>

          <h2 className="mt-4 text-2xl sm:text-4xl font-black text-neutral-950 dark:text-white">
            {labels.title}
          </h2>

          <p className="mt-3 max-w-xl mx-auto text-sm sm:text-base text-neutral-600 dark:text-neutral-400">
            {labels.subtitle}
          </p>
        </div>

        {/* Interactive Simulator Box */}
        <div className="mt-10 rounded-3xl border border-emerald-900/15 bg-white p-6 sm:p-8 shadow-xl shadow-emerald-950/5 dark:border-white/10 dark:bg-[#101e18]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Controls */}
            <div className="flex flex-col gap-6">
              {/* Trade selection */}
              <div>
                <label className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                  {labels.selectTrade}
                </label>
                <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {TRADES.map((t) => {
                    const isSelected = t.code === selectedTrade;
                    const name = tradeNames[t.code] ?? t.code;
                    return (
                      <button
                        key={t.code}
                        type="button"
                        onClick={() => setSelectedTrade(t.code)}
                        className={`min-h-12 rounded-2xl border px-3 py-2 text-xs sm:text-sm font-semibold transition-all text-center ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-500/30'
                            : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-emerald-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duration selection */}
              <div>
                <label className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                  {labels.selectDuration}
                </label>
                <div className="mt-2.5 flex items-center gap-2">
                  {DURATIONS.map((hrs) => {
                    const isSelected = hrs === duration;
                    return (
                      <button
                        key={hrs}
                        type="button"
                        onClick={() => setDuration(hrs)}
                        className={`flex-1 min-h-11 rounded-2xl border text-sm font-bold transition-all ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-100/90 text-emerald-900 ring-2 ring-emerald-500/20 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-emerald-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                        }`}
                      >
                        {hrs}h
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Contrast Callout */}
              <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900/40 dark:bg-red-950/20">
                <div className="flex items-start gap-2.5 text-xs sm:text-sm text-red-900 dark:text-red-300 leading-relaxed font-medium">
                  <Info className="size-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                  <span>{contrastText}</span>
                </div>
              </div>
            </div>

            {/* Results Ledger Breakdown */}
            <div className="flex flex-col justify-between rounded-2xl border border-emerald-200/90 bg-emerald-50/30 p-5 sm:p-6 dark:border-emerald-800/60 dark:bg-emerald-950/30">
              <div className="flex flex-col gap-4">
                {/* 1. Worker Wage (100% directly to worker) */}
                <div className="flex items-start justify-between border-b border-emerald-950/10 pb-3 dark:border-white/10">
                  <div className="flex items-start gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white mt-0.5">
                      <Wallet className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-neutral-900 dark:text-white">
                        {labels.workerReceives}
                      </div>
                      <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                        {labels.workerNote}
                      </div>
                    </div>
                  </div>
                  <div className="text-lg font-black text-emerald-800 dark:text-emerald-300">
                    ₹{wage}
                  </div>
                </div>

                {/* 2. Welfare Contribution (On Top) */}
                <div className="flex items-start justify-between border-b border-emerald-950/10 pb-3 dark:border-white/10">
                  <div className="flex items-start gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white mt-0.5">
                      <HeartHandshake className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-neutral-900 dark:text-white">
                        {labels.welfareContribution}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        {labels.welfareNote}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                    +₹{welfare}
                  </div>
                </div>

                {/* 3. Platform Fee */}
                <div className="flex items-start justify-between border-b border-emerald-950/10 pb-3 dark:border-white/10">
                  <div className="flex items-start gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-neutral-600 text-white mt-0.5">
                      <ShieldCheck className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-neutral-900 dark:text-white">
                        {labels.platformFee}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        {labels.platformNote}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                    +₹{platform}
                  </div>
                </div>

                {/* 4. Total Payable */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="text-base font-black text-neutral-900 dark:text-white">
                      {labels.customerTotal}
                    </div>
                    <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="size-3.5" />
                      <span>Zero Hidden Charges</span>
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300">
                    ₹{total}
                  </div>
                </div>
              </div>

              {/* CTA link to language -> login */}
              <Link
                href="/language?next=%2Flogin"
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-base font-bold text-white shadow-md transition-all hover:bg-emerald-800 active:scale-[0.99]"
              >
                <span>{labels.ctaButton}</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
