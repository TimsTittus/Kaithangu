import { readDevInbox } from '@kaithangu/adapters/sms';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { mutedTextClass, pageClass } from '@/components/ui';
import { getRedis } from '@/lib/datastores';
import { isDevInboxEnabled } from '@/server/devInbox';
import { AutoRefresh } from './AutoRefresh';

/** Mock SMS outbox for development and e2e tests. 404 unless DEV_INBOX=true. */
export default async function DevInboxPage() {
  await connection();
  if (!isDevInboxEnabled()) notFound();

  const [t, messages] = await Promise.all([
    getTranslations('dev_inbox'),
    readDevInbox(getRedis(), 100),
  ]);
  return (
    <main className={pageClass}>
      <AutoRefresh intervalMs={3000} />
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className={mutedTextClass}>{t('hint')}</p>
      {messages.length === 0 ? (
        <p className="text-lg">{t('empty')}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {messages.map((message, index) => (
            <li
              key={`${message.at}-${index}`}
              className="rounded-xl border-2 border-neutral-400 p-3"
              data-testid="dev-inbox-message"
              data-to={message.to}
            >
              <p className="font-mono text-base">
                {message.to} · <time dateTime={message.at}>{message.at}</time>
              </p>
              <p className="text-lg" data-testid="dev-inbox-text">
                {message.text}
              </p>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
