import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getContextFromRequest } from '@/server/auth/context';
import { handle, jsonData, readJson } from '@/server/http';
import { getBookingService } from '@/server/services';

export const GET = handle(async (request, requestId) => {
  const ctx = await getContextFromRequest(request as NextRequest, requestId);
  return jsonData(await getBookingService().listBookings(ctx));
});

/** Create a booking. Requires an Idempotency-Key header; a replay returns 200. */
export const POST = handle(async (request, requestId) => {
  const ctx = await getContextFromRequest(request as NextRequest, requestId);
  const body = await readJson(request, z.unknown());
  const created = await getBookingService().createBooking(
    ctx,
    body,
    request.headers.get('idempotency-key'),
  );
  return jsonData(created, { status: created.replayed ? 200 : 201 });
});
