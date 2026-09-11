import { isAppError, PRICING_LINE_KEYS } from '@/lib/core';
import { isTradeCode } from '@/lib/core/trades';
import { catalogs, type Catalog } from '@/lib/i18n';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { errorMessages, rawMessages } from '@/components/messages';
import { errorTextClass, pageClass, secondaryButtonClass } from '@/components/ui';
import { getContext } from '@/server/auth/context';
import { getBookingService } from '@/server/services';
import { BookingWizard } from './BookingWizard';
import { WIZARD_KEYS, type SlotDay } from './keys';

const SLOT_MS = 2 * 60 * 60 * 1000;

/** Quick-pick chip ids for a trade, from the English source catalog. */
function chipIds(trade: string): string[] {
  const chips = (catalogs.en.trades as Catalog | undefined)?.chips;
  const forTrade = typeof chips === 'object' ? chips[trade] : undefined;
  return typeof forTrade === 'object' ? Object.keys(forTrade) : [];
}

function groupSlots(slots: string[], timeZone: string, locale: string): SlotDay[] {
  const dayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dayLabel = new Intl.DateTimeFormat(`${locale}-IN`, {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = new Intl.DateTimeFormat(`${locale}-IN`, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  });
  const days: SlotDay[] = [];
  for (const iso of slots) {
    const start = new Date(iso);
    const key = dayKey.format(start);
    let day = days.find((d) => d.key === key);
    if (day === undefined) {
      day = { key, label: dayLabel.format(start), slots: [] };
      days.push(day);
    }
    day.slots.push({
      iso,
      label: `${time.format(start)} – ${time.format(new Date(start.getTime() + SLOT_MS))}`,
    });
  }
  return days;
}

export default async function BookPage({ params, searchParams }: PageProps<'/app/book/[trade]'>) {
  const [{ trade }, query] = await Promise.all([params, searchParams]);
  if (!isTradeCode(trade)) notFound();

  const [locale, tradeT, common] = await Promise.all([
    getLocale(),
    getTranslations('trade'),
    getTranslations('common'),
  ]);
  const errors = await errorMessages();

  let options;
  try {
    options = await getBookingService().bookingOptions(await getContext(), trade);
  } catch (error) {
    if (!isAppError(error) || error.code !== 'NOT_SERVICEABLE') throw error;
    return (
      <main className={pageClass}>
        <p role="alert" className={errorTextClass}>
          {errors[error.messageKey] ?? errors['error.INTERNAL']}
        </p>
        <Link href="/app" className={secondaryButtonClass}>
          <ArrowLeft aria-hidden className="size-5 shrink-0" />
          {common('back')}
        </Link>
      </main>
    );
  }

  const chipT = await getTranslations(`trades.chips.${trade}`);
  const strings = await rawMessages([...WIZARD_KEYS, ...Object.values(PRICING_LINE_KEYS)]);

  return (
    <BookingWizard
      tradeCode={trade}
      tradeLabel={tradeT(trade)}
      initialWhen={query.urgency === 'emergency' ? 'emergency' : 'now'}
      chips={chipIds(trade).map((id) => ({ id, label: chipT(id) }))}
      slotDays={groupSlots(options.slots, options.timeZone, locale)}
      savedAddresses={options.savedAddresses}
      strings={strings}
      errors={errors}
    />
  );
}
