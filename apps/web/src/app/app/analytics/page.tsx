import {
  ArrowLeft,
  ChevronDown,
  Cpu,
  Hammer,
  Paintbrush,
  Share2,
  Wrench,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { pageClass, secondaryButtonClass } from '@/components/ui';

export default async function AnalyticsPage() {
  const [t, home, trade, common] = await Promise.all([
    getTranslations('analytics'),
    getTranslations('home'),
    getTranslations('trade'),
    getTranslations('common'),
  ]);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

  const categories = [
    {
      name: trade('plumber'),
      icon: Wrench,
      amount: '₹890.40',
      pct: 38,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
    },
    {
      name: trade('electrician'),
      icon: Zap,
      amount: '₹520.60',
      pct: 22,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
    },
    {
      name: trade('carpenter'),
      icon: Hammer,
      amount: '₹320.00',
      pct: 14,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
    },
    {
      name: trade('painter'),
      icon: Paintbrush,
      amount: '₹280.50',
      pct: 12,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300',
    },
    {
      name: trade('technician'),
      icon: Cpu,
      amount: '₹218.70',
      pct: 9,
      color: 'bg-rose-500',
      bgColor: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300',
    },
  ];

  return (
    <main className={pageClass}>
      {/* Top Header */}
      <header className="flex items-center justify-between gap-3 pt-1">
        <Link
          href="/app"
          className="flex size-11 items-center justify-center rounded-2xl border border-neutral-200/80 bg-white shadow-sm hover:bg-neutral-50 active:scale-95 transition-all dark:border-neutral-800 dark:bg-neutral-900"
          aria-label={common('back')}
        >
          <ArrowLeft className="size-5 text-neutral-700 dark:text-neutral-300" />
        </Link>

        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
          {t('title')}
        </h1>

        <button
          type="button"
          className="flex size-11 items-center justify-center rounded-2xl border border-neutral-200/80 bg-white shadow-sm hover:bg-neutral-50 active:scale-95 transition-all dark:border-neutral-800 dark:bg-neutral-900"
          aria-label="Share"
        >
          <Share2 className="size-5 text-neutral-700 dark:text-neutral-300" />
        </button>
      </header>

      {/* Time Filter Pill */}
      <div className="flex items-center">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-xs dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
        >
          <span>{home('this_month')}</span>
          <ChevronDown className="size-3.5 text-neutral-500" />
        </button>
      </div>

      {/* Main Expense Metric */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            ₹2,340.20
          </span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            +8.3%
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <span>{t('total_expenses')}</span>
          <span>·</span>
          <span>{t('vs_last_month')}</span>
        </div>
      </div>

      {/* Smooth Spline Area Chart with peak tooltip */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-950/10 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
        {/* Highlighted Tooltip Pill */}
        <div className="absolute top-6 left-[62%] -translate-x-1/2 flex flex-col items-center">
          <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-md shadow-emerald-500/30">
            ₹320
          </span>
          <span className="size-2 -mt-1 rotate-45 bg-emerald-500" />
        </div>

        {/* SVG Area spline */}
        <div className="h-44 w-full">
          <svg
            viewBox="0 0 320 140"
            preserveAspectRatio="none"
            className="h-full w-full overflow-visible"
          >
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Shaded Area */}
            <path
              d="M 0,110 C 40,115 70,80 110,85 C 150,90 170,45 200,40 C 230,35 260,75 290,45 C 305,30 315,35 320,38 L 320,140 L 0,140 Z"
              fill="url(#areaGradient)"
            />

            {/* Stroke line */}
            <path
              d="M 0,110 C 40,115 70,80 110,85 C 150,90 170,45 200,40 C 230,35 260,75 290,45 C 305,30 315,35 320,38"
              fill="none"
              stroke="#059669"
              strokeWidth="3.5"
              strokeLinecap="round"
            />

            {/* Active Data Point */}
            <circle cx="200" cy="40" r="5" fill="#059669" stroke="#ffffff" strokeWidth="2.5" />
          </svg>
        </div>

        {/* Month Selector Pills Row */}
        <div className="mt-3 flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
          {months.map((m, i) => {
            const isSelected = i === months.length - 1;
            return (
              <button
                key={m}
                type="button"
                className={`flex size-8 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-700/30'
                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      {/* Top Categories Breakdown Section */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
            {t('top_categories')}
          </h2>
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {t('see_all')} →
          </span>
        </div>

        <ul className="flex flex-col gap-3">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <li
                key={cat.name}
                className="flex flex-col gap-2 rounded-3xl border border-emerald-950/10 bg-white p-3.5 shadow-xs dark:border-white/10 dark:bg-[#101e18]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-10 items-center justify-center rounded-2xl ${cat.bgColor}`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <span className="text-base font-bold text-neutral-900 dark:text-white">
                      {cat.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-neutral-900 dark:text-white">
                      {cat.amount}
                    </span>
                    <span className="text-xs font-semibold text-neutral-400 dark:text-neutral-500">
                      {cat.pct}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800">
                  <div
                    style={{ width: `${cat.pct}%` }}
                    className={`h-full rounded-full ${cat.color}`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Back button at bottom */}
      <div className="mt-auto flex items-center gap-3">
        <Link href="/app" className={secondaryButtonClass}>
          <ArrowLeft aria-hidden className="size-5" />
          {common('back')}
        </Link>
      </div>
    </main>
  );
}
