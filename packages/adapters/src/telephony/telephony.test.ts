import { SUPPORTED_LOCALES } from '@kaithangu/i18n';
import { describe, expect, it, vi } from 'vitest';
import { readDevInbox, type DevInboxRedis } from '../sms/devInbox';
import {
  createMockTelephonyAdapter,
  createRealTelephonyAdapter,
  createTelephonyAdapter,
  renderCall,
  TELEPHONY_TEMPLATE_KEYS,
  type TelephonyCall,
  type TelephonyTemplateKey,
} from './index';

function fakeRedis(): DevInboxRedis & { lists: Map<string, string[]> } {
  const lists = new Map<string, string[]>();
  const list = (k: string) => {
    let l = lists.get(k);
    if (!l) {
      l = [];
      lists.set(k, l);
    }
    return l;
  };
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

const SAMPLE_PARAMS: Record<TelephonyTemplateKey, Record<string, string>> = {
  job_offer: { trade: 'plumber' },
  booking_unassigned: { trade: 'electrician' },
};

describe('renderCall', () => {
  it('renders every telephony template in every locale with parameters', () => {
    for (const templateKey of TELEPHONY_TEMPLATE_KEYS) {
      const params = SAMPLE_PARAMS[templateKey];
      for (const locale of SUPPORTED_LOCALES) {
        const text = renderCall({
          to: '+919876543210',
          templateKey,
          params,
          locale,
        });
        expect(text).not.toMatch(/\{\w+\}/);
        for (const value of Object.values(params)) {
          expect(text, `${locale}:${templateKey}`).toContain(value);
        }
      }
    }
  });

  it('refuses to render when missing parameters', () => {
    expect(() =>
      renderCall({
        to: '+919876543210',
        templateKey: 'job_offer',
        params: {},
        locale: 'en',
      }),
    ).toThrow();
  });
});

describe('mock telephony adapter', () => {
  it('pushes the rendered call to dev inbox prefixed with [call]', async () => {
    const redis = fakeRedis();
    const log = logger();
    const at = new Date('2026-09-10T12:00:00.000Z');
    const adapter = createMockTelephonyAdapter({ redis, logger: log, now: () => at });

    const callInput: TelephonyCall = {
      to: '+919876543210',
      templateKey: 'job_offer',
      params: { trade: 'plumber' },
      locale: 'en',
    };

    await adapter.call(callInput);

    const entries = await readDevInbox(redis);
    expect(entries).toEqual([
      {
        to: callInput.to,
        text: `[call] ${renderCall(callInput)}`,
        at: at.toISOString(),
      },
    ]);
    expect(log.info).toHaveBeenCalledWith(
      { to: callInput.to, templateKey: 'job_offer' },
      'would call (mock telephony)',
    );
  });
});

describe('real telephony adapter', () => {
  it('throws NOT_CONFIGURED error', async () => {
    const adapter = createRealTelephonyAdapter();
    await expect(
      adapter.call({
        to: '+919876543210',
        templateKey: 'job_offer',
        params: { trade: 'plumber' },
        locale: 'en',
      }),
    ).rejects.toThrow(/telephony/);
  });
});

describe('createTelephonyAdapter', () => {
  it('selects mock by default and real when TELEPHONY_MODE=real', async () => {
    const redis = fakeRedis();
    const log = logger();
    const mockAdapter = createTelephonyAdapter({ env: {}, redis, logger: log });
    expect(mockAdapter).toBeDefined();

    const realAdapter = createTelephonyAdapter({
      env: { TELEPHONY_MODE: 'real' },
      redis,
      logger: log,
    });
    await expect(
      realAdapter.call({
        to: '+919876543210',
        templateKey: 'job_offer',
        params: { trade: 'plumber' },
        locale: 'en',
      }),
    ).rejects.toThrow();
  });
});
