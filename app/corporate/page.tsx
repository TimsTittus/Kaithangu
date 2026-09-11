import { ArrowUpRight, Bell, Landmark, ShieldCheck, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AudioButton } from '@/components/AudioButton';
import { LogoutButton } from '@/components/LogoutButton';
import { pageClass } from '@/components/ui';
import { trpc } from '@/trpc/server';

export default async function CorporateHome() {
  const [home, common, dashboard] = await Promise.all([
    getTranslations('home'),
    getTranslations('common'),
    trpc.corporate.dashboard(),
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

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#00b074] via-[#059669] to-[#10b981] p-5 text-white shadow-xl shadow-emerald-700/20">
        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-100">
            <span>{home('welfare_fund')}</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 font-bold">
              {dashboard.societyName ?? home('corporate_society_pending')}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight">{fundLabel}</span>
            <span className="text-xs text-emerald-100">INR</span>
          </div>
          <div className="flex items-center justify-between text-xs text-emerald-100 pt-1 border-t border-white/20">
            <span>
              {home('enrolments_count')}: {enrolmentCount}
            </span>
            <span>
              {home('workers_count')}: {workerCount}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
          <Users className="size-4 text-emerald-700" />
          <span className="text-base font-bold text-neutral-900 dark:text-white">
            {workerCount}
          </span>
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            {home('workers_count')}
          </span>
        </div>
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
                <span className="text-xs font-medium text-neutral-500">{scheme.enrolled}</span>
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
