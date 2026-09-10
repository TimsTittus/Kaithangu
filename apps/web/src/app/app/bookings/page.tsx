import { ArrowLeft, ChevronRight, Plus } from 'lucide-react';
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

  return (
    <main className={pageClass}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <AudioLabel k="booking.list_title" text={title} />
      </div>

      {bookings.length === 0 ? (
        <div className="flex flex-col gap-4" data-testid="bookings-empty">
          <p className={mutedTextClass}>{t('list_empty')}</p>
          <div className="flex items-center gap-3">
            <Link href="/app" className={primaryButtonClass}>
              <Plus aria-hidden className="size-5" />
              {t('book_first')}
            </Link>
            <AudioLabel k="booking.book_first" text={t('book_first')} />
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="bookings-list">
          {bookings.map((booking) => {
            const Icon = TRADE_ICONS[booking.tradeCode];
            const when = booking.scheduledFor ?? booking.createdAt;
            return (
              <li key={booking.id}>
                <Link
                  href={`/app/bookings/${booking.id}`}
                  className="flex min-h-16 items-center gap-3 rounded-2xl border-2 border-neutral-300 p-3 dark:border-neutral-600"
                  data-testid="booking-item"
                >
                  <Icon aria-hidden className="size-7 shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-lg font-semibold break-words">
                      {trade(booking.tradeCode)}
                      {booking.urgency === 'emergency' && (
                        <span className="ms-2 text-base font-semibold text-red-700 dark:text-red-300">
                          {t('emergency_badge')}
                        </span>
                      )}
                    </span>
                    <span className="text-base break-words">{status(booking.status)}</span>
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">
                      {dateTime.format(new Date(when))} · {formatPaise(booking.totalPaise, locale)}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-6 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-auto flex items-center gap-3">
        <Link href="/app" className={secondaryButtonClass}>
          <ArrowLeft aria-hidden className="size-5" />
          {common('back')}
        </Link>
        <AudioLabel k="common.back" text={common('back')} />
      </div>
    </main>
  );
}
