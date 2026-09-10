import { ClipboardList, Siren } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AudioLabel } from '@/components/AudioLabel';
import { LogoutButton } from '@/components/LogoutButton';
import { TradeGrid } from '@/components/TradeGrid';
import { emergencyButtonClass, pageClass, secondaryButtonClass } from '@/components/ui';

export default async function CustomerHome() {
  const [home, booking, common] = await Promise.all([
    getTranslations('home'),
    getTranslations('booking'),
    getTranslations('common'),
  ]);
  const title = home('customer_title');
  return (
    <main className={pageClass}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold" data-testid="home-title">
          {title}
        </h1>
        <AudioLabel k="home.customer_title" text={title} />
      </div>

      <div className="flex items-center gap-3">
        <Link href="/app/emergency" className={emergencyButtonClass} data-testid="emergency">
          <Siren aria-hidden className="size-6 shrink-0" />
          {booking('emergency')}
        </Link>
        <AudioLabel k="booking.emergency" text={booking('emergency')} />
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{booking('choose_trade')}</h2>
          <AudioLabel k="booking.choose_trade" text={booking('choose_trade')} />
        </div>
        <TradeGrid />
      </section>

      <div className="flex items-center gap-3">
        <Link href="/app/bookings" className={secondaryButtonClass} data-testid="my-bookings">
          <ClipboardList aria-hidden className="size-5 shrink-0" />
          {booking('my_bookings')}
        </Link>
        <AudioLabel k="booking.my_bookings" text={booking('my_bookings')} />
      </div>

      <div className="mt-auto">
        <LogoutButton label={common('logout')} />
      </div>
    </main>
  );
}
