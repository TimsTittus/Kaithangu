import { Check } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AudioButton } from '@/components/AudioButton';
import { mutedTextClass, pageClass, primaryButtonClass } from '@/components/ui';
import { getSession } from '@/server/auth/context';
import { loginPath, ROLE_HOME, safeNext } from '@/server/auth/routes';
import { getConsentService } from '@/server/services';
import { acceptConsent } from './actions';

const POINTS = ['point_phone', 'point_sharing', 'point_payment', 'point_rights'] as const;

export default async function ConsentPage({ searchParams }: PageProps<'/consent'>) {
  const { next: rawNext } = await searchParams;
  const session = await getSession();
  if (session === null) {
    const back =
      typeof rawNext === 'string'
        ? `/consent?${new URLSearchParams({ next: rawNext })}`
        : '/consent';
    redirect(loginPath(back));
  }
  const role = session.user.role;
  const next = safeNext(typeof rawNext === 'string' ? rawNext : null, ROLE_HOME[role], role);
  if (await getConsentService().hasAcceptedTerms(session.ctx)) redirect(next);

  const t = await getTranslations('consent');
  const points = POINTS.map((key) => t(key));
  const fullText = [t('title'), t('intro'), ...points].join(' ');

  return (
    <main className={pageClass}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <AudioButton text={fullText} />
      </div>
      <p className="text-lg">{t('intro')}</p>
      <ul className="flex list-disc flex-col gap-3 pl-6 text-lg">
        {points.map((point, index) => (
          <li key={POINTS[index]}>{point}</li>
        ))}
      </ul>
      <p className={mutedTextClass}>{t('version')}</p>
      <form action={acceptConsent} className="flex items-center gap-3">
        <input type="hidden" name="next" value={next} />
        <button type="submit" className={primaryButtonClass} data-testid="consent-accept">
          <Check aria-hidden className="size-5" />
          {t('accept')}
        </button>
        <AudioButton text={t('accept')} />
      </form>
    </main>
  );
}
