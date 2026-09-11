import { getMessage, SUPPORTED_LOCALES, type Locale } from '@/lib/i18n';
import { Languages } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { AudioButton } from '@/components/AudioButton';
import { pageClass, primaryButtonClass } from '@/components/ui';
import { safeNext } from '@/server/auth/routes';
import { chooseLocale } from './actions';

// Malayalam first for the Kerala pilot; the rest in catalog order.
const ORDER: readonly Locale[] = ['ml', ...SUPPORTED_LOCALES.filter((l) => l !== 'ml')];

export default async function LanguagePage({ searchParams }: PageProps<'/language'>) {
  const { next } = await searchParams;
  const target = safeNext(typeof next === 'string' ? next : null, '/login');
  const t = await getTranslations('language');

  return (
    <main className={pageClass}>
      <div className="flex items-center gap-3">
        <Languages aria-hidden className="size-8 shrink-0" />
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
      </div>
      <ul className="flex flex-col gap-4">
        {ORDER.map((locale) => {
          // Each language is named in its own script, in every catalog.
          const name = getMessage(locale, `language.name.${locale}`) ?? locale;
          return (
            <li key={locale} className="flex items-center gap-3">
              <form action={chooseLocale} className="flex-1">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="next" value={target} />
                <button
                  type="submit"
                  lang={locale}
                  className={`${primaryButtonClass} min-h-16 text-2xl`}
                  data-testid={`language-${locale}`}
                >
                  {name}
                </button>
              </form>
              <AudioButton text={name} locale={locale} />
            </li>
          );
        })}
      </ul>
    </main>
  );
}
