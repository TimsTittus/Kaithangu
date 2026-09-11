import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AudioLabel } from '@/components/AudioLabel';
import { TradeGrid } from '@/components/TradeGrid';
import { mutedTextClass, pageClass, secondaryButtonClass } from '@/components/ui';

/** Emergency: pick a trade; the wizard opens with "Emergency" selected. */
export default async function EmergencyPage() {
  const [booking, common] = await Promise.all([
    getTranslations('booking'),
    getTranslations('common'),
  ]);
  const title = booking('emergency_title');
  return (
    <main className={pageClass}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-red-800 dark:text-red-300">{title}</h1>
        <AudioLabel k="booking.emergency_title" text={title} />
      </div>
      <p className={mutedTextClass}>{booking('emergency_hint')}</p>
      <TradeGrid emergency />
      <div className="flex items-center gap-3">
        <Link href="/app" className={secondaryButtonClass}>
          <ArrowLeft aria-hidden className="size-5 shrink-0" />
          {common('back')}
        </Link>
        <AudioLabel k="common.back" text={common('back')} />
      </div>
    </main>
  );
}
