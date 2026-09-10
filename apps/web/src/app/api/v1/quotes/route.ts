import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getContextFromRequest } from '@/server/auth/context';
import { handle, jsonData, readJson } from '@/server/http';
import { getBookingService } from '@/server/services';

export const POST = handle(async (request, requestId) => {
  const ctx = await getContextFromRequest(request as NextRequest, requestId);
  const body = await readJson(request, z.unknown());
  return jsonData(await getBookingService().quote(ctx, body));
});
