import { BOOKING_STATUSES, isAppError } from '@kaithangu/core';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { errorMessages, rawMessages } from '@/components/messages';
import { getContext } from '@/server/auth/context';
import { getBookingService } from '@/server/services';
import { BookingTracker } from './BookingTracker';
import { TRACKER_KEYS } from './keys';

export default async function BookingPage({ params }: PageProps<'/app/bookings/[id]'>) {
  const { id } = await params;
  let view;
  try {
    view = await getBookingService().getBooking(await getContext(), id);
  } catch (error) {
    if (isAppError(error) && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  const [trade, strings, errors] = await Promise.all([
    getTranslations('trade'),
    rawMessages([...TRACKER_KEYS, ...BOOKING_STATUSES.map((status) => `status.${status}`)]),
    errorMessages(),
  ]);
  return (
    <BookingTracker
      initial={view}
      tradeLabel={trade(view.tradeCode)}
      strings={strings}
      errors={errors}
    />
  );
}
