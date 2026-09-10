import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { anonymousLocale, signInContext } from '@/server/auth/context';
import { clientIp, handle, jsonData, readJson } from '@/server/http';
import { getAuthService } from '@/server/services';

const bodySchema = z.object({ phone: z.string().min(1).max(32) });

export const POST = handle(async (request, requestId) => {
  const { phone } = await readJson(request, bodySchema);
  const ctx = signInContext(requestId, await anonymousLocale(request as NextRequest));
  const { expiresInSeconds } = await getAuthService().requestOtp(ctx, {
    phone,
    ip: clientIp(request.headers),
  });
  return jsonData({ expiresInSeconds });
});
