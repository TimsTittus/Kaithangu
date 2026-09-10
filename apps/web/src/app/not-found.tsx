import { House } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { pageClass, primaryButtonClass } from '@/components/ui';

export default async function NotFound() {
  const t = await getTranslations('common');
  return (
    <main className={pageClass}>
      <h1 className="text-2xl font-semibold">{t('not_found')}</h1>
      <Link href="/" className={primaryButtonClass}>
        <House aria-hidden className="size-5" />
        {t('go_start')}
      </Link>
    </main>
  );
}
