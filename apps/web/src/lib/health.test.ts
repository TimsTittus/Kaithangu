import { describe, expect, it } from 'vitest';
import { checkHealth, probe } from './health';

const never = () => new Promise<never>(() => undefined);

describe('probe', () => {
  it('reports up when the check resolves', async () => {
    await expect(probe(() => Promise.resolve('PONG'), 50)).resolves.toBe('up');
  });

  it('reports down when the check rejects or throws synchronously', async () => {
    await expect(probe(() => Promise.reject(new Error('refused')), 50)).resolves.toBe('down');
    await expect(
      probe(() => {
        throw new Error('bad config');
      }, 50),
    ).resolves.toBe('down');
  });

  it('reports down when the check does not answer within the timeout', async () => {
    const started = Date.now();
    await expect(probe(never, 30)).resolves.toBe('down');
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe('checkHealth', () => {
  it('is ok only when every dependency is up', async () => {
    await expect(
      checkHealth({
        version: '1.2.3',
        checkDb: () => Promise.resolve(),
        checkRedis: () => Promise.resolve(),
      }),
    ).resolves.toEqual({ ok: true, version: '1.2.3', db: 'up', redis: 'up' });
  });

  it('reports the failing dependency without failing the whole check', async () => {
    await expect(
      checkHealth({
        version: '1.2.3',
        checkDb: () => Promise.resolve(),
        checkRedis: never,
        timeoutMs: 30,
      }),
    ).resolves.toEqual({ ok: false, version: '1.2.3', db: 'up', redis: 'down' });
  });
});
