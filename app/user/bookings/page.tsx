import {
  ArrowLeft,
  ChevronRight,
  Landmark,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Receipt,
  Siren,
} from 'lucide-react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { AudioLabel } from '@/components/AudioLabel';
import { formatPaise } from '@/components/money';
import { TRADE_ICONS } from '@/components/TradeGrid';
import {
  mutedTextClass,
  pageClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '@/components/ui';
import { getContext } from '@/server/auth/context';
import { getBookingService } from '@/server/services';

export default async function BookingsPage() {
  const [bookings, locale, t, trade, status, common] = await Promise.all([
    getBookingService().listBookings(await getContext()),
    getLocale(),
    getTranslations('booking'),
    getTranslations('trade'),
    getTranslations('status'),
    getTranslations('common'),
  ]);

  const dateTime = new Intl.DateTimeFormat(`${locale}-IN`, {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

  const title = t('list_title');
  const totalExpensesPaise = bookings.reduce((acc, b) => acc + b.totalPaise, 0);
  const activeCount = bookings.filter(
    (b) => b.status !== 'completed' && b.status !== 'cancelled' && b.status !== 'resolved',
  ).length;

  return (
    <main className={pageClass}>
      {/* Top App Bar with back button, centered title, and grid menu */}
      <header className="flex items-center justify-between gap-3 pt-1">
        <Link
          href="/user"
          className="flex size-11 items-center justify-center rounded-2xl border border-neutral-200/80 bg-white shadow-sm hover:bg-neutral-50 active:scale-95 transition-all dark:border-neutral-800 dark:bg-neutral-900"
          aria-label={common('back')}
        >
          <ArrowLeft className="size-5 text-neutral-700 dark:text-neutral-300" />
        </Link>

        <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
          {t('account_overview')}
        </h1>

        <div className="flex items-center gap-1.5">
          <AudioLabel k="booking.list_title" text={title} />
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-2xl border border-neutral-200/80 bg-white shadow-sm hover:bg-neutral-50 active:scale-95 transition-all dark:border-neutral-800 dark:bg-neutral-900"
            aria-label="Menu"
          >
            <LayoutGrid className="size-5 text-neutral-700 dark:text-neutral-300" />
          </button>
        </div>
      </header>

      {/* Hero Account Card (Vibrant Emerald Gradient) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#00b074] via-[#059669] to-[#10b981] p-5 text-white shadow-xl shadow-emerald-700/20">
        {/* Subtle decorative watermark landmark/pillars */}
        <Landmark className="pointer-events-none absolute -right-6 -bottom-6 size-40 text-white/10" />

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-center justify-between text-xs font-medium text-emerald-100">
            <span>{t('current_account')}</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 font-semibold backdrop-blur-xs">
              •••• 4589
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-emerald-100">{t('available_balance')}</span>
            <span className="text-3xl font-bold tracking-tight">₹24,560.80</span>
          </div>
        </div>
      </div>

      {/* 3-Stat Metrics Row below the card */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="flex flex-col rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
          <span className="text-base font-bold text-neutral-900 dark:text-white">
            {bookings.length}
          </span>
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            {t('total_services')}
          </span>
        </div>

        <div className="flex flex-col rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
          <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
            {activeCount}
          </span>
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            Active
          </span>
        </div>

        <div className="flex flex-col rounded-2xl border border-emerald-950/10 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[#101e18]">
          <span className="text-base font-bold text-neutral-900 dark:text-white">
            {formatPaise(totalExpensesPaise, locale)}
          </span>
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            Spent
          </span>
        </div>
      </div>

      {/* Quick Action Buttons Row */}
      <div className="flex items-center justify-around gap-2 px-1">
        <Link
          href="/user"
          className="flex flex-col items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
        >
          <div className="flex size-12 items-center justify-center rounded-full border border-emerald-900/10 bg-emerald-50 text-emerald-800 shadow-xs hover:scale-105 active:scale-95 transition-all dark:border-white/10 dark:bg-emerald-950 dark:text-emerald-200">
            <Plus className="size-5" />
          </div>
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            {t('add_service')}
          </span>
        </Link>

        <Link
          href="/user/emergency"
          className="flex flex-col items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md shadow-emerald-800/20 hover:scale-105 active:scale-95 transition-all">
            <Siren className="size-5" />
          </div>
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
            {t('emergency_badge')}
          </span>
        </Link>

        <div className="flex flex-col items-center gap-1.5">
          <div className="flex size-12 items-center justify-center rounded-full border border-emerald-900/10 bg-emerald-50 text-emerald-800 shadow-xs hover:scale-105 active:scale-95 transition-all dark:border-white/10 dark:bg-emerald-950 dark:text-emerald-200">
            <Receipt className="size-5" />
          </div>
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            {t('invoices')}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <div className="flex size-12 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-700 shadow-xs hover:scale-105 active:scale-95 transition-all dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            <MoreHorizontal className="size-5" />
          </div>
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">More</span>
        </div>
      </div>

      {/* Transaction History Section */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
            {t('transaction_history')}
          </h2>
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {t('see_all')} →
          </span>
        </div>

        {bookings.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-emerald-900/20 bg-emerald-50/30 p-8 text-center dark:border-white/10 dark:bg-emerald-950/10"
            data-testid="bookings-empty"
          >
            <p className={mutedTextClass}>{t('list_empty')}</p>
            <Link href="/user" className={primaryButtonClass}>
              <Plus aria-hidden className="size-5" />
              {t('book_first')}
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="bookings-list">
            {bookings.map((booking) => {
              const Icon = TRADE_ICONS[booking.tradeCode];
              const when = booking.scheduledFor ?? booking.createdAt;
              const isCompleted = booking.status === 'completed';
              const isEmergency = booking.urgency === 'emergency';

              return (
                <li key={booking.id}>
                  <Link
                    href={`/user/bookings/${booking.id}`}
                    className="flex min-h-16 items-center gap-3.5 rounded-3xl border border-emerald-950/10 bg-white p-3.5 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md dark:border-white/10 dark:bg-[#101e18]"
                    data-testid="booking-item"
                  >
                    {/* Category circle icon */}
                    <div
                      className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
                        isEmergency
                          ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                          : isCompleted
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      <Icon aria-hidden className="size-6 shrink-0" />
                    </div>

                    {/* Booking description & meta */}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-bold text-neutral-900 break-words dark:text-white">
                          {trade(booking.tradeCode)}
                        </span>
                        {isEmergency && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold text-red-700 dark:bg-red-950 dark:text-red-300">
                            {t('emergency_badge')}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {dateTime.format(new Date(when))}
                      </span>
                      <span className="mt-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        {status(booking.status)}
                      </span>
                    </div>

                    {/* Amount & Chevron */}
                    <div className="flex shrink-0 items-center gap-1 text-right">
                      <span className="text-base font-bold text-neutral-900 dark:text-white">
                        {formatPaise(booking.totalPaise, locale)}
                      </span>
                      <ChevronRight aria-hidden className="size-5 text-neutral-400" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Bottom Back Button */}
      <div className="mt-auto flex items-center gap-3">
        <Link href="/user" className={secondaryButtonClass}>
          <ArrowLeft aria-hidden className="size-5" />
          {common('back')}
        </Link>
        <AudioLabel k="common.back" text={common('back')} />
      </div>
    </main>
  );
}
