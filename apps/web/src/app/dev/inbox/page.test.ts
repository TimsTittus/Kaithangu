import type * as NextServer from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The page calls connection() to opt out of prerendering; outside a request
// it is a no-op here.
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof NextServer>()),
  connection: () => Promise.resolve(),
}));

const original = process.env.DEV_INBOX;

afterEach(() => {
  process.env.DEV_INBOX = original;
  vi.resetModules();
});

async function loadWith(value: string | undefined) {
  if (value === undefined) delete process.env.DEV_INBOX;
  else process.env.DEV_INBOX = value;
  vi.resetModules(); // getEnv() caches the parsed environment per module instance
  return {
    page: (await import('./page')).default,
    enabled: (await import('@/server/devInbox')).isDevInboxEnabled,
  };
}

describe('/dev/inbox', () => {
  it.each([undefined, 'false', './.dev-inbox', '1'])(
    'is a 404 when DEV_INBOX=%s',
    async (value) => {
      const { page, enabled } = await loadWith(value);
      expect(enabled()).toBe(false);
      await expect(page()).rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' });
    },
  );

  it('is enabled only by DEV_INBOX=true', async () => {
    const { enabled } = await loadWith('true');
    expect(enabled()).toBe(true);
  });
});
