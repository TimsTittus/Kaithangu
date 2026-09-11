/**
 * Sarvam Indus API-tool webhook. Each dashboard tool POSTs here with
 * `?tool=` (or a `tool` field in the JSON body). Responses are flat JSON
 * the agent maps into variables — not the /api/v1 `{ data }` envelope.
 */
import { timingSafeEqual } from 'node:crypto';
import { isAiWebhookTool, isAppError, systemContext, type AiWebhookTool } from '@/lib/core';
import { getEnv } from '@/env';
import { logger } from '@/lib/logger';
import { requestIdFrom } from '@/server/http';
import { getDefaultLocale, getWorkerOnboardingService } from '@/server/services';

const NO_STORE = { 'cache-control': 'no-store' };

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE });
}

function bearerMatches(header: string | null, secret: string): boolean {
  if (header === null) return false;
  const match = /^(?:Bearer)\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  if (token === undefined || token === '') return false;
  const provided = Buffer.from(token);
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

function toolFrom(request: Request, body: Record<string, unknown>): string | undefined {
  const queryTool = new URL(request.url).searchParams.get('tool');
  if (queryTool !== null && queryTool.trim() !== '') return queryTool.trim();
  const bodyTool = body.tool;
  return typeof bodyTool === 'string' && bodyTool.trim() !== '' ? bodyTool.trim() : undefined;
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function POST(request: Request): Promise<Response> {
  const requestId = requestIdFrom(request.headers);
  const respond = (data: unknown, status = 200): Response => {
    const response = json(data, status);
    response.headers.set('x-request-id', requestId);
    return response;
  };

  try {
    if (!bearerMatches(request.headers.get('authorization'), getEnv().AI_WEBHOOK_SECRET)) {
      return respond({ status: 'error', code: 'UNAUTHENTICATED' }, 401);
    }

    const contentType = request.headers.get('content-type') ?? '';
    if (!/^application\/json\b/i.test(contentType)) {
      return respond({ status: 'error', code: 'VALIDATION_FAILED' }, 400);
    }

    let parsed: unknown;
    try {
      parsed = await request.json();
    } catch {
      return respond({ status: 'error', code: 'VALIDATION_FAILED' }, 400);
    }
    const body = asObject(parsed);

    const toolName = toolFrom(request, body);
    if (toolName === undefined || !isAiWebhookTool(toolName)) {
      return respond({ status: 'error', code: 'UNKNOWN_TOOL' }, 400);
    }
    const tool: AiWebhookTool = toolName;

    const ctx = systemContext('webhook.ai', {
      requestId,
      locale: await getDefaultLocale(),
    });
    const result = await getWorkerOnboardingService().handleTool(ctx, tool, body);
    return respond(result);
  } catch (error) {
    console.log(JSON.stringify(error));

    if (isAppError(error) && error.code === 'INVALID_PHONE') {
      return respond({ found: false, status: 'invalid_phone' });
    }
    if (isAppError(error) && error.code === 'VALIDATION_FAILED') {
      return respond({ status: 'error', code: 'VALIDATION_FAILED' }, 400);
    }
    if (isAppError(error) && error.code === 'CONFLICT') {
      return respond({ found: false, status: 'conflict' });
    }
    logger.error({ err: error, requestId }, 'unhandled error in ai webhook');
    if (isAppError(error)) {
      return respond({ status: 'error', code: error.code }, error.httpStatus);
    }
    return respond({ status: 'error', code: 'INTERNAL' }, 500);
  }
}
