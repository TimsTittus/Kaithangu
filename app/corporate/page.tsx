import {
  ArrowUpRight,
  Bell,
  ChevronRight,
  ClipboardList,
  Landmark,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AudioButton } from '@/components/AudioButton';
import { LogoutButton } from '@/components/LogoutButton';
import { pageClass } from '@/components/ui';
import { trpc } from '@/trpc/server';

function statusBadgeClass(status: string) {
  switch (status) {
    case 'completed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'in_progress':
      return 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300';
    case 'cancelled':
      return 'border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400';
    default:
      return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300';
  }
}

export default async function CorporateHome() {
  const [home, common, dashboard, recentBookings] = await Promise.all([
    getTranslations('home'),
    getTranslations('common'),
    trpc.corporate.dashboard(),
    trpc.corporate.bookings({ limit: 5 }),
  ]);

  const title = home('corporate_title');
  const body = home('corporate_body');
  const workerCount = dashboard.workerCount;
  const enrolmentCount = dashboard.enrolmentCount;
  const fundLabel =
    dashboard.welfareFundPaise > 0
      ? `₹${(dashboard.welfareFundPaise / 100).toLocaleString('en-IN')}`
      : '₹0';

  return (
    <main className={pageClass}>
      <header className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm">
            <Landmark className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold leading-tight tracking-tight text-neutral-900 dark:text-white">
              Kaithangu
            </span>
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              {home('corporate_portal')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex size-11 items-center justify-center rounded-2xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <Bell className="size-5 text-neutral-700 dark:text-neutral-300" />
          </div>
          <Link
            href="/corporate/profile"
            className="flex size-11 items-center justify-center rounded-2xl border border-neutral-200/80 bg-emerald-50 text-emerald-800 shadow-sm hover:bg-emerald-100/80 active:scale-95 transition-all"
            aria-label="Profile"
            data-testid="profile-link"
          >
            <Users className="size-5" />
          </Link>
        </div>
      </header>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1
            className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white"
            data-testid="home-title"
          >
            {title}
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{body}</p>
        </div>
        <AudioButton text={`${title}. ${body}`} />
      </div>

      {/* Hero Welfare Fund Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#00b074] via-[#059669] to-[#10b981] p-5 text-white shadow-xl shadow-emerald-700/20">
        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-100">
            <span>{home('welfare_fund')}</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 font-bold">
              {home('corporate_portal')}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight">{fundLabel}</span>
            <span className="text-xs text-emerald-100">INR</span>
          </div>
          <div className="flex items-center justify-between text-xs text-emerald-100 pt-1 border-t border-white/20">
            <span className="flex items-center gap-1">
              <span>{home('enrolments_count')}:</span>
              <span className="font-bold">{enrolmentCount}</span>
              <span className="text-emerald-200">✓</span>
            </span>
            <span>
              {home('workers_count')}: <strong className="text-white">{workerCount}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold tracking-tight text-neutral-800 dark:text-neutral-200">
          {home('corporate_quick_actions')}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/corporate/workers"
            className="flex flex-col gap-2 rounded-2xl border border-emerald-950/10 bg-white p-4 shadow-xs hover:border-emerald-600/30 hover:bg-emerald-50/20 active:scale-[0.98] transition-all dark:border-white/10 dark:bg-[#101e18]"
          >
            <div className="flex items-center justify-between">
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Users className="size-4" />
              </div>
              <ChevronRight className="size-4 text-neutral-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-neutral-900 dark:text-white">
                {home('corporate_view_workers')}
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {workerCount} {home('workers_count').toLowerCase()}
              </span>
            </div>
          </Link>

          <Link
            href="/corporate/bookings"
            className="flex flex-col gap-2 rounded-2xl border border-emerald-950/10 bg-white p-4 shadow-xs hover:border-emerald-600/30 hover:bg-emerald-50/20 active:scale-[0.98] transition-all dark:border-white/10 dark:bg-[#101e18]"
          >
            <div className="flex items-center justify-between">
              <div className="flex size-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                <ClipboardList className="size-4" />
              </div>
              <ChevronRight className="size-4 text-neutral-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-neutral-900 dark:text-white">
                {home('corporate_view_bookings')}
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {home('corporate_recent_activity')}
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* Stats 3-Col Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Link
          href="/corporate/workers"
          className="flex flex-col items-center gap-1 rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs hover:bg-neutral-50 active:scale-95 transition-all dark:border-white/10 dark:bg-[#101e18]"
        >
          <Users className="size-4 text-emerald-700" />
          <span className="text-base font-bold text-neutral-900 dark:text-white">
            {workerCount}
          </span>
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            {home('workers_count')}
          </span>
        </Link>
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
          <ShieldCheck className="size-4 text-emerald-700" />
          <span className="text-base font-bold text-neutral-900 dark:text-white">
            {enrolmentCount}
          </span>
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            {home('enrolments_count')}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
          <Wallet className="size-4 text-emerald-700" />
          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
            {fundLabel}
          </span>
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            {home('welfare_fund')}
          </span>
        </div>
      </div>

      {/* Welfare Schemes */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
            {home('schemes_title')}
          </h2>
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {home('this_month')}
            <ArrowUpRight className="size-3.5" />
          </span>
        </div>
        {dashboard.schemes.length === 0 ? (
          <p className="rounded-2xl border border-emerald-950/10 bg-white p-4 text-sm text-neutral-500 dark:border-white/10 dark:bg-[#101e18] dark:text-neutral-400">
            {home('schemes_empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {dashboard.schemes.map((scheme) => (
              <li
                key={scheme.code}
                className="flex items-center justify-between rounded-2xl border border-emerald-950/10 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#101e18]"
              >
                <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                  {scheme.name}
                </span>
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {scheme.enrolled} {home('corporate_worker_verified').toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent Activity */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
            {home('corporate_recent_activity')}
          </h2>
          <Link
            href="/corporate/bookings"
            className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            {home('corporate_view_bookings')}
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
        {recentBookings.length === 0 ? (
          <p className="rounded-2xl border border-emerald-950/10 bg-white p-4 text-sm text-neutral-500 dark:border-white/10 dark:bg-[#101e18] dark:text-neutral-400">
            {home('corporate_no_bookings')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recentBookings.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between rounded-2xl border border-emerald-950/10 bg-white p-3.5 shadow-xs dark:border-white/10 dark:bg-[#101e18]"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-neutral-900 dark:text-white capitalize">
                    {b.tradeCode.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 max-w-[200px]">
                    {b.problemText}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">
                    ₹{(b.totalPaise / 100).toLocaleString('en-IN')}
                  </span>
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusBadgeClass(
                      b.status,
                    )}`}
                  >
                    {b.status.replace('_', ' ')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-auto">
        <LogoutButton label={common('logout')} />
      </div>
    </main>
  );
}
