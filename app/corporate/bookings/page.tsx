import {
  ArrowLeft,
  Calendar,
  ClipboardList,
  MapPin,
} from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { pageClass } from '@/components/ui';
import { trpc } from '@/trpc/server';

function formatTrade(code: string): string {
  return code
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

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

export default async function CorporateBookingsPage() {
  const [home, common, bookings] = await Promise.all([
    getTranslations('home'),
    getTranslations('common'),
    trpc.corporate.bookings({ limit: 50 }),
  ]);

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
            {home('corporate_bookings_title')}
          </h1>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {bookings.length} {home('corporate_view_bookings').toLowerCase()}
          </span>
        </div>

        <div className="flex size-11 items-center justify-center rounded-2xl border border-neutral-200/80 bg-teal-50 text-teal-800 shadow-sm dark:border-teal-800/50 dark:bg-teal-950/50 dark:text-teal-300">
          <ClipboardList className="size-5" />
        </div>
      </header>

      {/* Bookings List */}
      <div className="flex flex-col gap-3">
        {bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-xs dark:border-neutral-800 dark:bg-[#101e18]">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400 dark:bg-neutral-800">
              <ClipboardList className="size-6" />
            </div>
            <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">
              {home('corporate_no_bookings')}
            </p>
          </div>
        ) : (
          bookings.map((b) => (
            <div
              key={b.id}
              className="flex flex-col gap-3 rounded-3xl border border-emerald-950/10 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[#101e18]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-base font-bold text-neutral-900 dark:text-white">
                    {formatTrade(b.tradeCode)}
                  </span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                    {b.problemText}
                  </span>
                </div>
                <span
                  className={`inline-block shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${statusBadgeClass(
                    b.status,
                  )}`}
                >
                  {b.status.replace('_', ' ')}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-neutral-100 pt-2.5 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5 text-neutral-400" />
                    <span>{b.pincode}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3.5 text-neutral-400" />
                    <span>{new Date(b.createdAt).toLocaleDateString('en-IN')}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    +{b.welfarePaise > 0 ? `₹${(b.welfarePaise / 100).toFixed(0)}` : '₹0'} {home('welfare_saved').toLowerCase()}
                  </span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">
                    ₹{(b.totalPaise / 100).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
