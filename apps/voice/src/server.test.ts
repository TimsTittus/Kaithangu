import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from './server';

describe('voice server', () => {
  let app: ReturnType<typeof buildServer>;

  beforeEach(() => {
    app = buildServer({ logger: false, version: '9.9.9' });
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health reports ok and echoes a valid x-request-id', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'call-abc_123' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<unknown>()).toEqual({ ok: true, version: '9.9.9' });
    expect(response.headers['x-request-id']).toBe('call-abc_123');
  });

  it('replaces a malformed x-request-id with a uuid', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'bad id with spaces' },
    });

    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});
