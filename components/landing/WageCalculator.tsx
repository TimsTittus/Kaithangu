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
    <section className="py-12 md:py-20 bg-white border-b border-slate-200">
      <div className="mx-auto max-w-4xl px-4">
        {/* Title */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3.5 py-1 text-xs font-bold text-[#0b3a75] border border-blue-200 shadow-2xs">
            <Calculator
              className="size-3.5 text-[#0b3a75]"
              aria-hidden="true"
            />
            <span>{labels.badge}</span>
          </div>

          <h2 className="mt-4 text-2xl sm:text-4xl font-black text-[#07254d]">
            {labels.title}
          </h2>

          <p className="mt-3 max-w-xl mx-auto text-sm sm:text-base text-slate-600 leading-relaxed">
            {labels.subtitle}
          </p>
        </div>

        {/* Interactive Simulator Box */}
        <div className="mt-10 rounded-3xl border-2 border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Controls */}
            <div className="flex flex-col gap-6">
              {/* Trade selection */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
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
                        className={`min-h-12 rounded-xl border px-3 py-2 text-xs sm:text-sm font-bold transition-all text-center ${
                          isSelected
                            ? 'border-[#0b3a75] bg-[#0b3a75] text-white shadow-xs ring-2 ring-blue-500/20'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
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
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
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
                        className={`flex-1 min-h-11 rounded-xl border text-sm font-bold transition-all ${
                          isSelected
                            ? 'border-[#138808] bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                        }`}
                      >
                        {hrs}h
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Contrast Callout */}
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
                <div className="flex items-start gap-2.5 text-xs sm:text-sm text-rose-900 leading-relaxed font-medium">
                  <Info className="size-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{contrastText}</span>
                </div>
              </div>
            </div>

            {/* Results Ledger Breakdown (Official Government Receipt Style) */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-[#f8fafc] p-5 sm:p-6 shadow-2xs">
              <div className="flex flex-col gap-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2 flex justify-between">
                  <span>STATUTORY FINANCIAL BREAKDOWN</span>
                  <span>GOVT NOTIFIED</span>
                </div>

                {/* 1. Worker Wage (100% directly to worker) */}
                <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-start gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#138808] text-white mt-0.5">
                      <Wallet className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {labels.workerReceives}
                      </div>
                      <div className="text-xs text-[#138808] font-bold">
                        {labels.workerNote}
                      </div>
                    </div>
                  </div>
                  <div className="text-lg font-black text-[#138808]">
                    ₹{wage}
                  </div>
                </div>

                {/* 2. Welfare Contribution (On Top) */}
                <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-start gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-600 text-white mt-0.5">
                      <HeartHandshake className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {labels.welfareContribution}
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        {labels.welfareNote}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    +₹{welfare}
                  </div>
                </div>

                {/* 3. Platform Fee */}
                <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-start gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0b3a75] text-white mt-0.5">
                      <ShieldCheck className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {labels.platformFee}
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        {labels.platformNote}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    +₹{platform}
                  </div>
                </div>

                {/* 4. Total Payable */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="text-base font-black text-slate-900">
                      {labels.customerTotal}
                    </div>
                    <div className="text-xs text-[#138808] font-bold flex items-center gap-1">
                      <Check className="size-3.5" />
                      <span>Zero Hidden Charges</span>
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-[#07254d]">
                    ₹{total}
                  </div>
                </div>
              </div>

              {/* CTA link to language -> login */}
              <Link
                href="/language?next=%2Flogin"
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0b3a75] hover:bg-[#07254d] px-4 text-base font-bold text-white shadow-xs transition-all active:scale-[0.99]"
              >
                <span>{labels.ctaButton}</span>
                <ArrowRight className="size-4 text-amber-300" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
