import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { pageClass } from '@/components/ui';
import { getSession } from '@/server/auth/context';
import { LOCALE_COOKIE, loginPath, ROLE_HOME, safeNext } from '@/server/auth/routes';
import { LoginForm } from './LoginForm';
import { signInMessages } from './messages';

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(typeof rawNext === 'string' ? rawNext : null, '');

  const session = await getSession();
  if (session) redirect(safeNext(next, ROLE_HOME[session.user.role], session.user.role));

  // First visit: pick a language before anything else.
  if (!(await cookies()).has(LOCALE_COOKIE)) {
    redirect(`/language?${new URLSearchParams({ next: next ? loginPath(next) : '/login' })}`);
  }

  const t = await getTranslations('auth');
  return (
    <main className={pageClass}>
      <h1 className="text-2xl font-semibold">{t('login_title')}</h1>
      <LoginForm
        next={next}
        labels={{
          phone: t('phone_label'),
          hint: t('phone_hint'),
          submit: t('send_code'),
          sending: t('sending'),
        }}
        messages={await signInMessages()}
      />
    </main>
  );
}
