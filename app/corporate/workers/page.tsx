import {
  ArrowLeft,
  Check,
  Users,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { pageClass } from '@/components/ui';
import { VerifyWorkerButton } from '@/components/VerifyWorkerButton';
import { maskPhone } from '@/lib/core';
import { trpc } from '@/trpc/server';

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

function formatTrade(code: string): string {
  return code
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default async function CorporateWorkersPage({ searchParams }: PageProps) {
  const { status: rawStatus } = await searchParams;
  const statusFilter =
    rawStatus === 'pending' || rawStatus === 'verified' || rawStatus === 'suspended'
      ? rawStatus
      : undefined;

  const [home, common, workers] = await Promise.all([
    getTranslations('home'),
    getTranslations('common'),
    trpc.corporate.workers({ status: statusFilter }),
  ]);

  const verifyLabels = {
    verify: home('corporate_verify_worker'),
    revoke: home('corporate_revoke_worker'),
    verified: home('corporate_worker_verified'),
    pending: home('corporate_worker_pending'),
    suspended: home('corporate_worker_suspended'),
    confirmVerify: home('corporate_verify_confirm'),
    confirmRevoke: home('corporate_revoke_confirm'),
  };

  const tabs = [
    { key: 'all', label: home('corporate_filter_all'), href: '/corporate/workers' },
    {
      key: 'pending',
      label: home('corporate_filter_pending'),
      href: '/corporate/workers?status=pending',
    },
    {
      key: 'verified',
      label: home('corporate_filter_verified'),
      href: '/corporate/workers?status=verified',
    },
    {
      key: 'suspended',
      label: home('corporate_filter_suspended'),
      href: '/corporate/workers?status=suspended',
    },
  ];

  return (
    <main className={pageClass}>
      {/* Header */}
      <header className="flex items-center justify-between gap-3 pt-1">
        <Link
          href="/corporate"
          className="flex size-11 items-center justify-center rounded-2xl border border-neutral-200/80 bg-white shadow-sm hover:bg-neutral-50 active:scale-95 transition-all dark:border-neutral-800 dark:bg-neutral-900"
          aria-label={common('back')}
        >
          <ArrowLeft className="size-5 text-neutral-700 dark:text-neutral-300" />
        </Link>

        <div className="flex flex-col items-center">
          <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
            {home('corporate_workers_title')}
          </h1>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {workers.length} {home('workers_count').toLowerCase()}
          </span>
        </div>

        <div className="flex size-11 items-center justify-center rounded-2xl border border-neutral-200/80 bg-emerald-50 text-emerald-800 shadow-sm dark:border-emerald-800/50 dark:bg-emerald-950/50 dark:text-emerald-300">
          <Users className="size-5" />
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="flex rounded-2xl bg-neutral-100 p-1 dark:bg-neutral-800/60">
        {tabs.map((tab) => {
          const isActive =
            (tab.key === 'all' && !statusFilter) || tab.key === statusFilter;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`flex-1 rounded-xl py-2 text-center text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-white text-emerald-800 shadow-xs dark:bg-[#101e18] dark:text-emerald-300'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Worker List */}
      <div className="flex flex-col gap-3">
        {workers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-xs dark:border-neutral-800 dark:bg-[#101e18]">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400 dark:bg-neutral-800">
              <Users className="size-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
              {home('corporate_no_workers')}
            </p>
          </div>
        ) : (
          workers.map((w) => (
            <div
              key={w.id}
              className="flex flex-col gap-3 rounded-3xl border border-emerald-950/10 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#101e18]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 font-bold text-base dark:bg-emerald-950 dark:text-emerald-300">
                    {(w.name ?? 'W').charAt(0)}
                    {w.status === 'verified' && (
                      <span
                        className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-emerald-600 text-white ring-2 ring-white dark:ring-[#101e18]"
                        title={verifyLabels.verified}
                      >
                        <Check className="size-2.5" />
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-neutral-900 dark:text-white">
                      {w.name ?? `Worker #${w.id.slice(0, 6)}`}
                    </span>
                    <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                      {maskPhone(w.phone)}
                    </span>
                  </div>
                </div>

                {/* Status Badge & Action */}
                <VerifyWorkerButton
                  workerId={w.id}
                  status={w.status}
                  labels={verifyLabels}
                />
              </div>

              {/* Skills */}
              {w.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  {w.skills.map((s) => (
                    <span
                      key={s.tradeCode}
                      className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                    >
                      <Wrench className="size-3 text-neutral-400" />
                      <span>{formatTrade(s.tradeCode)}</span>
                      <span className="text-[10px] text-neutral-400">
                        (L{s.level})
                      </span>
                      {s.verified && (
                        <Check className="size-2.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
