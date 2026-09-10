import { AppError } from '@kaithangu/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { clientIp, handle, jsonData, jsonError, readJson, requestIdFrom } from './http';

const headers = (init: Record<string, string>) => new Headers(init);

describe('requestIdFrom', () => {
  it('reuses a well-formed id and replaces a malformed one', () => {
    expect(requestIdFrom(headers({ 'x-request-id': 'abc-123' }))).toBe('abc-123');
    expect(requestIdFrom(headers({ 'x-request-id': 'no spaces' }))).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('clientIp', () => {
  it('takes the rightmost X-Forwarded-For entry (added by our proxy)', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientIp(headers({ 'x-forwarded-for': '198.51.100.4' }))).toBe('198.51.100.4');
  });

  it('falls back to X-Real-IP, then "unknown"', () => {
    expect(clientIp(headers({ 'x-real-ip': '192.0.2.5' }))).toBe('192.0.2.5');
    expect(clientIp(headers({}))).toBe('unknown');
    expect(clientIp(headers({ 'x-forwarded-for': ' , ' }))).toBe('unknown');
    expect(clientIp(headers({ 'x-real-ip': 'x'.repeat(65) }))).toBe('unknown');
  });
});

describe('jsonData / jsonError', () => {
  it('wraps data and disables caching', async () => {
    const response = jsonData({ ok: 1 }, { status: 201 });
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ data: { ok: 1 } });
  });

  it('maps AppError to its status and message key, with Retry-After for rate limits', async () => {
    const response = jsonError(
      new AppError('RATE_LIMITED', undefined, undefined, { retryAfterSeconds: 42 }),
      'req-1',
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('42');
    await expect(response.json()).resolves.toEqual({
      error: { code: 'RATE_LIMITED', messageKey: 'error.RATE_LIMITED', requestId: 'req-1' },
    });
  });

  it('hides unknown errors behind a 500 with the request id', async () => {
    const response = jsonError(new Error('db password is hunter2'), 'req-2');
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).not.toContain('hunter2');
    expect(JSON.parse(body)).toEqual({
      error: { code: 'INTERNAL', messageKey: 'error.INTERNAL', requestId: 'req-2' },
    });
  });
});

describe('readJson', () => {
  const schema = z.object({ phone: z.string() });
  const post = (body: string, contentType?: string) =>
    new Request('http://localhost/x', {
      method: 'POST',
      body,
      headers: contentType ? { 'content-type': contentType } : {},
    });

  it('parses a valid JSON body', async () => {
    await expect(readJson(post('{"phone":"1"}', 'application/json'), schema)).resolves.toEqual({
      phone: '1',
    });
  });

  it('refuses other content types with 415 (no form-based CSRF)', async () => {
    await expect(readJson(post('{"phone":"1"}', 'text/plain'), schema)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      httpStatus: 415,
    });
    await expect(readJson(post('{"phone":"1"}'), schema)).rejects.toMatchObject({
      httpStatus: 415,
    });
  });

  it('rejects malformed JSON and schema mismatches with 400', async () => {
    await expect(readJson(post('{', 'application/json'), schema)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      httpStatus: 400,
    });
    await expect(readJson(post('{"phone":1}', 'application/json'), schema)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      httpStatus: 400,
    });
  });
});

describe('handle', () => {
  it('echoes the request id on success and on errors', async () => {
    const ok = handle(() => Promise.resolve(jsonData(1)));
    const failing = handle(() => Promise.reject(new AppError('NOT_FOUND')));
    const request = new Request('http://localhost/x', { headers: { 'x-request-id': 'rid-9' } });
    expect((await ok(request)).headers.get('x-request-id')).toBe('rid-9');
    const response = await failing(request);
    expect(response.status).toBe(404);
    expect(response.headers.get('x-request-id')).toBe('rid-9');
  });
});
