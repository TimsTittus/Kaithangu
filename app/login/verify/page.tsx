import { maskPhone, ROLES, type Role } from '@/lib/core';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { pageClass } from '@/components/ui';
import { safeNext } from '@/server/auth/routes';
import { signInMessages } from '../messages';
import { OtpForm } from './OtpForm';

function signupRole(value: unknown): Role | undefined {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
    ? (value as Role)
    : undefined;
}

export default async function VerifyPage({ searchParams }: PageProps<'/login/verify'>) {
  const { phone, next: rawNext, role: rawRole } = await searchParams;
  const next = safeNext(typeof rawNext === 'string' ? rawNext : null, '');
  if (typeof phone !== 'string' || !/^[6-9]\d{9}$/.test(phone)) {
    redirect(next ? `/login?${new URLSearchParams({ next })}` : '/login');
  }
  const role = signupRole(rawRole);

  const t = await getTranslations('auth');
  const digitLabels = Array.from({ length: 6 }, (_, i) => t('digit_label', { n: i + 1 }));
  return (
    <main className={pageClass}>
      <h1 className="text-2xl font-semibold">{t('verify_title')}</h1>
      <OtpForm
        phone={phone}
        next={next}
        role={role}
        labels={{
          hint: t('verify_hint', { phone: maskPhone(`+91${phone}`) }),
          digits: digitLabels,
          verify: t('verify'),
          verifying: t('verifying'),
          resend: t('resend'),
          resent: t('resent'),
          changeNumber: t('change_number'),
        }}
        messages={await signInMessages()}
      />
    </main>
  );
}
