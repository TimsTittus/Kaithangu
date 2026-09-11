import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/core';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getEnv } from '@/env';
import { getContextFromRequest } from '@/server/auth/context';
import { handle, jsonData, readJson } from '@/server/http';
import { getAuthService } from '@/server/services';

// { all: true } signs out every device by bumping session_version on the identity row.
const bodySchema = z.object({ all: z.boolean().default(false) });

export const POST = handle(async (request, requestId) => {
  const { all } = await readJson(request, bodySchema);
  if (all) {
    const ctx = await getContextFromRequest(request as NextRequest, requestId);
    await getAuthService().logoutAll(ctx);
  }
  const response = jsonData({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', {
    ...sessionCookieOptions(getEnv().NODE_ENV === 'production'),
    maxAge: 0,
  });
  return response;
});
