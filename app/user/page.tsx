import { ArrowUpRight, ClipboardList, Landmark, Siren, User } from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { AudioLabel } from '@/components/AudioLabel';
import { HomeHeroCard } from '@/components/HomeHeroCard';
import { LogoutButton } from '@/components/LogoutButton';
import { SpendingAnalysisCard } from '@/components/SpendingAnalysisCard';
import { TradeGrid } from '@/components/TradeGrid';
import { formatPaise } from '@/components/money';
import { pageClass } from '@/components/ui';
import { trpc } from '@/trpc/server';
import { UserLanguageDropdown } from './UserLanguageDropdown';

export default async function UserHome() {
  const [home, booking, common, nav, dashboard, locale] = await Promise.all([
    getTranslations('home'),
    getTranslations('booking'),
    getTranslations('common'),
    getTranslations('nav'),
    trpc.user.dashboard(),
    getLocale(),
  ]);
  const title = home('user_title');

  return (
    <main className={pageClass}>
      {/* Top Header Bar with Brand & User Avatar */}
      <header className="flex items-center justify-between gap-2 pt-1 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm shadow-emerald-800/20">
            <Landmark className="size-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-base font-bold leading-tight tracking-tight text-neutral-900 truncate dark:text-white">
              {common('app_name')}
            </span>
            <span className="text-[11px] font-medium text-emerald-700 truncate dark:text-emerald-400">
              {home('digital_services')}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <UserLanguageDropdown next="/user" />

          <Link
            href="/user/profile"
            className="flex size-11 items-center justify-center rounded-2xl border border-neutral-200/80 bg-emerald-50 text-emerald-800 shadow-sm transition-all hover:bg-emerald-100 active:scale-95 dark:border-neutral-800 dark:bg-emerald-950 dark:text-emerald-200"
            aria-label={nav('profile')}
          >
            <User aria-hidden className="size-5" />
          </Link>
        </div>
      </header>

      {/* Greeting Row */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {home('greeting_morning')},
          </span>
          <div className="flex items-center gap-2 min-w-0">
            <h1
              className="text-2xl font-bold tracking-tight text-neutral-900 truncate dark:text-white"
              data-testid="home-title"
            >
              {title}
            </h1>
            <span className="text-xl shrink-0">👋</span>
          </div>
        </div>
        <AudioLabel k="home.user_title" text={title} />
      </div>

      {/* Total Balance Hero Card */}
      <HomeHeroCard
        label={home('total_balance')}
        currency={home('currency_inr')}
        cardLabel={home('coop_card')}
      />

      {/* Quick actions */}
      <section
        aria-label={home('quick_overview')}
        className="grid w-full min-w-0 grid-cols-3 gap-1"
      >
        {/* Book: jumps to the trade grid below. */}
        <a
          href="#trades"
          className="flex flex-col items-center gap-1 text-center min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
        >
          <div className="flex size-12 items-center justify-center rounded-full border border-emerald-900/10 bg-emerald-50/90 text-emerald-800 shadow-xs hover:scale-105 active:scale-95 transition-all dark:border-white/10 dark:bg-emerald-950/70 dark:text-emerald-200">
            <ArrowUpRight className="size-5" />
          </div>
          <span className="w-full truncate text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
            {home('action_book')}
          </span>
        </a>

        {/* Emergency */}
        <Link
          href="/user/emergency"
          data-testid="emergency"
          className="flex flex-col items-center gap-1 text-center min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
        >
          <div className="flex size-12 items-center justify-center rounded-full border border-red-900/10 bg-red-50 text-red-600 shadow-xs hover:scale-105 active:scale-95 transition-all dark:border-red-900/20 dark:bg-red-950/60 dark:text-red-400">
            <Siren className="size-5" />
          </div>
          <span className="w-full truncate text-[11px] font-bold text-red-600 dark:text-red-400">
            {home('action_emergency')}
          </span>
        </Link>

        {/* My bookings */}
        <Link
          href="/user/bookings"
          data-testid="my-bookings"
          className="flex flex-col items-center gap-1 text-center min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
        >
          <div className="flex size-12 items-center justify-center rounded-full border border-emerald-900/10 bg-emerald-50/90 text-emerald-800 shadow-xs hover:scale-105 active:scale-95 transition-all dark:border-white/10 dark:bg-emerald-950/70 dark:text-emerald-200">
            <ClipboardList className="size-5" />
          </div>
          <span className="w-full truncate text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
            {home('action_history')}
          </span>
        </Link>
      </section>

      {/* Quick Overview (2×2 Cards Grid) */}
      <section className="flex flex-col gap-3 min-w-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
            {home('quick_overview')}
          </h2>
          <Link
            href="/user/analytics"
            className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 dark:text-emerald-400"
          >
            {home('this_month')}
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 min-w-0">
          {/* Card 1: Services */}
          <div className="flex flex-col gap-2 rounded-2xl border border-emerald-950/10 bg-white p-3.5 shadow-sm min-w-0 dark:border-white/10 dark:bg-[#101e18]">
            <span className="text-xs font-medium text-neutral-500 truncate dark:text-neutral-400">
              {home('services_count')}
            </span>
            <div className="flex items-baseline justify-between gap-1 min-w-0">
              <span className="text-lg font-bold tracking-tight text-neutral-900 truncate dark:text-white">
                {formatPaise(dashboard.servicesPaise, locale)}
              </span>
              <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                +15.6%
              </span>
            </div>
          </div>

          {/* Card 2: Expenses */}
          <div className="flex flex-col gap-2 rounded-2xl border border-emerald-950/10 bg-white p-3.5 shadow-sm min-w-0 dark:border-white/10 dark:bg-[#101e18]">
            <span className="text-xs font-medium text-neutral-500 truncate dark:text-neutral-400">
              {home('expenses_count')}
            </span>
            <div className="flex items-baseline justify-between gap-1 min-w-0">
              <span className="text-lg font-bold tracking-tight text-neutral-900 truncate dark:text-white">
                {formatPaise(dashboard.expensesPaise, locale)}
              </span>
              <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                +8.3%
              </span>
            </div>
          </div>

          {/* Card 3: Transactions */}
          <div className="flex flex-col gap-2 rounded-2xl border border-emerald-950/10 bg-white p-3.5 shadow-sm min-w-0 dark:border-white/10 dark:bg-[#101e18]">
            <span className="text-xs font-medium text-neutral-500 truncate dark:text-neutral-400">
              {home('action_history')}
            </span>
            <div className="flex items-baseline justify-between gap-1 min-w-0">
              <span className="text-lg font-bold tracking-tight text-neutral-900 truncate dark:text-white">
                {dashboard.transactionCount}
              </span>
              <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                +12.5%
              </span>
            </div>
          </div>

          {/* Card 4: Welfare */}
          <div className="flex flex-col gap-2 rounded-2xl border border-emerald-950/10 bg-white p-3.5 shadow-sm min-w-0 dark:border-white/10 dark:bg-[#101e18]">
            <span className="text-xs font-medium text-neutral-500 truncate dark:text-neutral-400">
              {home('welfare_saved')}
            </span>
            <div className="flex items-baseline justify-between gap-1 min-w-0">
              <span className="text-lg font-bold tracking-tight text-neutral-900 truncate dark:text-white">
                {formatPaise(dashboard.welfarePaise, locale)}
              </span>
              <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                +9.4%
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Services Selection (Trade Grid) */}
      <section id="trades" className="flex flex-col gap-3 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
            {booking('choose_trade')}
          </h2>
          <AudioLabel k="booking.choose_trade" text={booking('choose_trade')} />
        </div>
        <TradeGrid />
      </section>

      {/* Spending Analysis Card */}
      <SpendingAnalysisCard title={home('spending_analysis')} monthLabel={home('this_month')} />

      {/* Logout button at bottom */}
      <div className="mt-2">
        <LogoutButton label={common('logout')} />
      </div>
    </main>
  );
}
