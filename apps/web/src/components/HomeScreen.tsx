import { getTranslations } from 'next-intl/server';
import { AudioButton } from './AudioButton';
import { LogoutButton } from './LogoutButton';
import { mutedTextClass, pageClass } from './ui';

type HomeKind = 'customer' | 'worker' | 'admin' | 'org';

/** Placeholder home for each area until its phase fills it in. */
export async function HomeScreen({ kind }: { kind: HomeKind }) {
  const [t, common] = await Promise.all([getTranslations('home'), getTranslations('common')]);
  const title = t(`${kind}_title`);
  const body = t(`${kind}_body`);
  return (
    <main className={pageClass}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold" data-testid="home-title">
          {title}
        </h1>
        <AudioButton text={`${title}. ${body}`} />
      </div>
      <p className={mutedTextClass}>{body}</p>
      <div className="mt-auto">
        <LogoutButton label={common('logout')} />
      </div>
    </main>
  );
}
