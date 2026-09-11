import {
  ArrowLeft,
  Building2,
  ChevronRight,
  ClipboardList,
  Globe,
  HelpCircle,
  Landmark,
  Scale,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LogoutButton } from '@/components/LogoutButton';
import { pageClass } from '@/components/ui';
import { getSession } from '@/server/auth/context';
import { trpc } from '@/trpc/server';

export default async function CorporateProfilePage() {
  const [common, home, session, profile] = await Promise.all([
    getTranslations('common'),
    getTranslations('home'),
    getSession(),
    trpc.corporate.profile().catch(() => null),
  ]);

  const phone = session?.user.phone ?? profile?.phone ?? '';
  const name = session?.user.name ?? profile?.name ?? home('corporate_portal');
  const societyName = profile?.societyName;
  const isLinked = Boolean(profile?.societyId);
  const workerCount = profile?.workerCount ?? 0;
  const enrolmentCount = profile?.enrolmentCount ?? 0;
  const fundLabel =
    (profile?.welfareFundPaise ?? 0) > 0
      ? `₹${((profile?.welfareFundPaise ?? 0) / 100).toLocaleString('en-IN')}`
      : '₹0';

  return (
    <main className={pageClass}>
      {/* Top Header */}
      <header className="flex items-center justify-between gap-3 pt-1">
        <Link
          href="/corporate"
          className="flex size-11 items-center justify-center rounded-2xl border border-neutral-200/80 bg-white shadow-sm hover:bg-neutral-50 active:scale-95 transition-all dark:border-neutral-800 dark:bg-neutral-900"
          aria-label={common('back')}
        >
          <ArrowLeft className="size-5 text-neutral-700 dark:text-neutral-300" />
        </Link>

        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
          {home('corporate_profile_title')}
        </h1>

        <div className="flex size-11 items-center justify-center rounded-2xl border border-neutral-200/80 bg-emerald-50 text-emerald-800 shadow-sm dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-300">
          <Building2 className="size-5" />
        </div>
      </header>

      {/* Profile Hero Card */}
      <div className="flex flex-col items-center rounded-3xl border border-emerald-950/10 bg-white p-6 text-center shadow-xs dark:border-white/10 dark:bg-[#101e18]">
        <div className="relative mb-3 flex size-20 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-700 to-teal-600 text-3xl font-extrabold text-white shadow-md shadow-emerald-700/20">
          {name.charAt(0)}
          <div className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-emerald-800 text-white ring-2 ring-white dark:ring-neutral-900">
            <ShieldCheck className="size-4" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{name}</h2>
        <span className="mt-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          {home('corporate_portal')}
        </span>
        <span className="mt-1 text-sm font-mono text-neutral-600 dark:text-neutral-400">{phone}</span>

        <div className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-50/70 px-3 py-2 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Landmark className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <span className="truncate">
            {societyName ?? home('corporate_society_pending')}
          </span>
        </div>
      </div>

      {/* Real Society Operational Metrics */}
      <section className="flex flex-col gap-2.5">
        <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
          {home('corporate_profile_overview')}
        </span>
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="flex flex-col rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
            <span className="text-lg font-bold text-neutral-900 dark:text-white">{workerCount}</span>
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              {home('workers_count')}
            </span>
          </div>
          <div className="flex flex-col rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
            <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{enrolmentCount}</span>
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              {home('enrolments_count')}
            </span>
          </div>
          <div className="flex flex-col rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
            <span className="text-lg font-bold text-teal-700 dark:text-teal-400">{fundLabel}</span>
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              {home('welfare_fund')}
            </span>
          </div>
        </div>
      </section>

      {/* Federation Details */}
      <section className="flex flex-col gap-2">
        <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
          {home('corporate_coop_affiliation')}
        </span>
        <div className="flex flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white p-4 shadow-xs gap-3 dark:border-neutral-800 dark:bg-[#101e18]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <Landmark className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-neutral-900 dark:text-white">
                  {societyName ?? home('corporate_society_pending')}
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {profile?.stateCode ?? 'IN'} · {home('corporate_portal')}
                </span>
              </div>
            </div>
            {isLinked ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Active
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                Pending
              </span>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-neutral-100 pt-3 dark:border-neutral-800">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <Scale className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-neutral-900 dark:text-white">
                  Ministry of Cooperation
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  National Council for Cooperative Training
                </span>
              </div>
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Verified
            </span>
          </div>
        </div>
      </section>

      {/* Administrative Settings & Controls */}
      <section className="flex flex-col gap-2">
        <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
          {home('corporate_welfare_governance')}
        </span>
        <div className="flex flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xs divide-y divide-neutral-100 dark:border-neutral-800 dark:bg-[#101e18] dark:divide-neutral-800">
          <Link
            href="/corporate/workers"
            className="flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <Users className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-neutral-900 dark:text-white">
                  {home('corporate_workers_title')}
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {workerCount} {home('workers_count').toLowerCase()} · {enrolmentCount}{' '}
                  {home('corporate_worker_verified').toLowerCase()}
                </span>
              </div>
            </div>
            <ChevronRight className="size-5 text-neutral-400" />
          </Link>

          <Link
            href="/corporate/bookings"
            className="flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                <ClipboardList className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-neutral-900 dark:text-white">
                  {home('corporate_bookings_title')}
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {home('corporate_recent_activity')}
                </span>
              </div>
            </div>
            <ChevronRight className="size-5 text-neutral-400" />
          </Link>

          <Link
            href="/language"
            className="flex items-center justify-between p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <Globe className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-neutral-900 dark:text-white">
                  Language / ഭാഷ
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  Malayalam, English, Hindi, Tamil
                </span>
              </div>
            </div>
            <ChevronRight className="size-5 text-neutral-400" />
          </Link>

          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <HelpCircle className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-neutral-900 dark:text-white">
                  {home('corporate_support')}
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  Desk: 0484-2391000 · admin@kaithangu.coop
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logout button at bottom */}
      <div className="mt-2">
        <LogoutButton label={common('logout')} />
      </div>
    </main>
  );
}
