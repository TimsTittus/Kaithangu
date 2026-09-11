import { BottomNav } from '@/components/BottomNav';
import { requireAreaSession } from '@/server/auth/area';
import { getTranslations } from 'next-intl/server';

export default async function CustomerLayout({ children }: LayoutProps<'/app'>) {
  await requireAreaSession(['customer'], '/app');
  const t = await getTranslations('nav');
  const labels = {
    home: t('home'),
    bookings: t('bookings'),
    emergency: t('emergency'),
    analytics: t('analytics'),
    profile: t('profile'),
  };
  return (
    <>
      {children}
      <BottomNav labels={labels} />
    </>
  );
}
