import type { NextRequest } from 'next/server';
import { getContextFromRequest } from '@/server/auth/context';
import { handle, jsonData } from '@/server/http';
import { getBookingService } from '@/server/services';

/** Booking status for the tracking page (polled every 5 s). */
export const GET = handle(
  async (request, requestId, { params }: RouteContext<'/api/v1/bookings/[id]'>) => {
    const ctx = await getContextFromRequest(request as NextRequest, requestId);
    const { id } = await params;
    return jsonData(await getBookingService().getBooking(ctx, id));
  },
);
