/**
 * REST helpers for /api/v1 (AGENTS.md 4.7): responses are { data } or
 * { error: { code, messageKey, requestId } }. AppErrors map to their status;
 * anything else is a 500 with the full error only in the logs.
 */
import { randomUUID } from 'node:crypto';
import { AppError, isAppError, parseInput } from '@kaithangu/core';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { logger } from '@/lib/logger';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const NO_STORE = { 'cache-control': 'no-store' };

/** A well-formed incoming x-request-id, else a new UUID. */
export function requestIdFrom(headers: Headers): string {
  const incoming = headers.get('x-request-id');
  return incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
}

/**
 * The client IP for rate limiting. The rightmost X-Forwarded-For entry is the
 * one added by the proxy in front of the app (leftmost entries are client
 * supplied); without a proxy header every request shares the "unknown" bucket.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  const ip = forwarded?.at(-1) ?? headers.get('x-real-ip')?.trim();
  return ip && ip.length <= 64 ? ip : 'unknown';
}

export function jsonData(data: unknown, init: { status?: number } = {}): NextResponse {
  return NextResponse.json({ data }, { status: init.status ?? 200, headers: NO_STORE });
}

export function jsonError(error: unknown, requestId: string): Response {
  if (isAppError(error)) {
    const headers: Record<string, string> = { ...NO_STORE };
    const retryAfter = error.details?.retryAfterSeconds;
    if (typeof retryAfter === 'number') headers['retry-after'] = String(retryAfter);
    return Response.json(
      { error: { code: error.code, messageKey: error.messageKey, requestId } },
      { status: error.httpStatus, headers },
    );
  }
  logger.error({ err: error, requestId }, 'unhandled error in route handler');
  return Response.json(
    { error: { code: 'INTERNAL', messageKey: 'error.INTERNAL', requestId } },
    { status: 500, headers: NO_STORE },
  );
}

/** Parse a JSON body. Non-JSON content types are refused (blocks form-based CSRF). */
export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.output<T>> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!/^application\/json\b/i.test(contentType)) {
    throw new AppError('VALIDATION_FAILED', 415, undefined, { reason: 'content-type' });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError('VALIDATION_FAILED', undefined, undefined, { reason: 'json' });
  }
  return parseInput(schema, body);
}

/**
 * The raw request body, refusing more than `maxBytes` (AppError
 * PAYLOAD_TOO_LARGE) without buffering past the limit.
 */
export async function readLimitedBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(request.headers.get('content-length') ?? Number.NaN);
  if (Number.isFinite(declared) && declared > maxBytes) throw new AppError('PAYLOAD_TOO_LARGE');
  if (request.body === null) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new AppError('PAYLOAD_TOO_LARGE');
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/** Wrap a handler so every thrown error becomes a JSON error response. */
export function handle<Args extends unknown[]>(
  handler: (request: Request, requestId: string, ...args: Args) => Promise<Response>,
): (request: Request, ...args: Args) => Promise<Response> {
  return async (request, ...args) => {
    const requestId = requestIdFrom(request.headers);
    try {
      const response = await handler(request, requestId, ...args);
      response.headers.set('x-request-id', requestId);
      return response;
    } catch (error) {
      const response = jsonError(error, requestId);
      response.headers.set('x-request-id', requestId);
      return response;
    }
  };
}
