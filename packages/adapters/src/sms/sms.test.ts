import { describe, expect, it, vi } from 'vitest';
import {
  createMockSmsAdapter,
  createRealSmsAdapter,
  createSmsAdapter,
  DEV_INBOX_CAP,
  DEV_INBOX_KEY,
  isNotConfiguredError,
  NotConfiguredError,
  readDevInbox,
  renderSms,
  SMS_TEMPLATE_KEYS,
  type DevInboxRedis,
  type SmsMessage,
} from './index';
import { SUPPORTED_LOCALES } from '@kaithangu/i18n';

/** In-memory stand-in for the Redis list commands. */
function fakeRedis(): DevInboxRedis & { lists: Map<string, string[]> } {
  const lists = new Map<string, string[]>();
  const list = (key: string) => {
    let items = lists.get(key);
    if (items === undefined) {
      items = [];
      lists.set(key, items);
    }
    return items;
  };
  // Redis LTRIM/LRANGE use inclusive stop indexes.
  return {
    lists,
    lpush: (key, value) => Promise.resolve(list(key).unshift(value)),
    ltrim: (key, start, stop) => {
      lists.set(key, list(key).slice(start, stop + 1));
      return Promise.resolve('OK');
    },
    lrange: (key, start, stop) => Promise.resolve(list(key).slice(start, stop + 1)),
  };
}

const logger = () => ({ info: vi.fn() });

const message: SmsMessage = {
  to: '+919876543210',
  templateKey: 'login_otp',
  params: { code: '123456' },
  locale: 'en',
};

describe('renderSms', () => {
  it('renders every template in every locale with its parameters', () => {
    for (const templateKey of SMS_TEMPLATE_KEYS) {
      for (const locale of SUPPORTED_LOCALES) {
        const text = renderSms({ ...message, templateKey, locale });
        expect(text, `${locale}:${templateKey}`).toContain('123456');
        expect(text).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it('refuses to render a template with a missing parameter', () => {
    expect(() => renderSms({ ...message, params: {} })).toThrow(/code/);
  });
});

describe('mock sms adapter', () => {
  it('pushes the rendered text to the dev inbox and logs without the text', async () => {
    const redis = fakeRedis();
    const log = logger();
    const at = new Date('2026-09-10T10:00:00.000Z');
    const sms = createMockSmsAdapter({ redis, logger: log, now: () => at });

    await sms.send({ ...message, locale: 'ml' });

    const entries = await readDevInbox(redis);
    expect(entries).toEqual([
      { to: message.to, text: renderSms({ ...message, locale: 'ml' }), at: at.toISOString() },
    ]);
    expect(log.info).toHaveBeenCalledWith(
      { to: message.to, templateKey: 'login_otp' },
      'mock sms queued',
    );
    expect(JSON.stringify(log.info.mock.calls)).not.toContain('123456');
  });

  it('keeps only the newest DEV_INBOX_CAP messages, newest first', async () => {
    const redis = fakeRedis();
    const sms = createMockSmsAdapter({ redis, logger: logger() });
    for (let i = 0; i < DEV_INBOX_CAP + 5; i++) {
      await sms.send({ ...message, params: { code: String(i).padStart(6, '0') } });
    }
    expect(redis.lists.get(DEV_INBOX_KEY)).toHaveLength(DEV_INBOX_CAP);
    const [newest] = await readDevInbox(redis, 1);
    expect(newest?.text).toContain(String(DEV_INBOX_CAP + 4).padStart(6, '0'));
  });

  it('skips inbox entries that are not valid JSON entries', async () => {
    const redis = fakeRedis();
    redis.lists.set(DEV_INBOX_KEY, ['not json', '{"to":1}', '{"to":"a","text":"b","at":"c"}']);
    await expect(readDevInbox(redis)).resolves.toEqual([{ to: 'a', text: 'b', at: 'c' }]);
  });
});

describe('real sms adapter', () => {
  it('throws NOT_CONFIGURED until a provider is set up', async () => {
    const error: unknown = await createRealSmsAdapter()
      .send(message)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotConfiguredError);
    expect(isNotConfiguredError(error)).toBe(true);
    expect((error as NotConfiguredError).code).toBe('NOT_CONFIGURED');
    expect(isNotConfiguredError(new Error('x'))).toBe(false);
  });
});

describe('createSmsAdapter', () => {
  it('selects mock by default and real when SMS_MODE=real', async () => {
    const redis = fakeRedis();
    await createSmsAdapter({ env: {}, redis, logger: logger() }).send(message);
    expect(redis.lists.get(DEV_INBOX_KEY)).toHaveLength(1);

    const real = createSmsAdapter({
      env: { ADAPTER_MODE: 'mock', SMS_MODE: 'real' },
      redis,
      logger: logger(),
    });
    await expect(real.send(message)).rejects.toBeInstanceOf(NotConfiguredError);
  });
});
