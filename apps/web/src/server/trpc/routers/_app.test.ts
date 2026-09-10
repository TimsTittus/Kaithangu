import { describe, expect, it } from 'vitest';
import { createCallerFactory, createTrpcContext } from '../init';
import { appRouter } from './_app';

const createCaller = createCallerFactory(appRouter);

describe('appRouter', () => {
  it('system.ping echoes the request id', async () => {
    const caller = createCaller({ requestId: 'req-1' });
    await expect(caller.system.ping()).resolves.toEqual({ ok: true, requestId: 'req-1' });
  });
});

describe('createTrpcContext', () => {
  it('reuses a well-formed x-request-id and replaces a malformed one', () => {
    const good = new Request('http://localhost/api/trpc', {
      headers: { 'x-request-id': 'abc-123' },
    });
    expect(createTrpcContext({ req: good }).requestId).toBe('abc-123');

    const bad = new Request('http://localhost/api/trpc', {
      headers: { 'x-request-id': 'bad id with spaces' },
    });
    expect(createTrpcContext({ req: bad }).requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
