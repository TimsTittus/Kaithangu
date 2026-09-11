import { House } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { AudioButton } from '@/components/AudioButton';
import { LogoutButton } from '@/components/LogoutButton';
import { mutedTextClass, pageClass, primaryButtonClass } from '@/components/ui';
import { getSession } from '@/server/auth/context';
import { ROLE_HOME } from '@/server/auth/routes';

export default async function ForbiddenPage() {
  const [t, common, session] = await Promise.all([
    getTranslations('forbidden'),
    getTranslations('common'),
    getSession(),
  ]);
  return (
    <main className={pageClass}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold" data-testid="forbidden-title">
          {t('title')}
        </h1>
        <AudioButton text={`${t('title')}. ${t('body')}`} />
      </div>
      <p className={mutedTextClass}>{t('body')}</p>
      <Link href={session ? ROLE_HOME[session.user.role] : '/login'} className={primaryButtonClass}>
        <House aria-hidden className="size-5" />
        {t('go_home')}
      </Link>
      {session && <LogoutButton label={common('logout')} />}
    </main>
  );
}
