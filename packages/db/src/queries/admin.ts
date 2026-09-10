/**
 * Minimal LCS admin queries (Phase 6): unassigned bookings in scope and
 * worker verify/suspend, mirroring queries/workers.ts's tenancy pattern.
 */
import type { AdminRepo, TradeCode, UnassignedBookingSummary } from '@kaithangu/core';
import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../client';
import { bookings, workers } from '../schema';

export function createAdminRepo(db: Database): AdminRepo {
  return {
    async unassignedBookings(societyId): Promise<UnassignedBookingSummary[]> {
      const rows = await db
        .select({
          id: bookings.id,
          tradeCode: bookings.tradeCode,
          urgency: bookings.urgency,
          addressText: bookings.addressText,
          pincode: bookings.pincode,
          createdAt: bookings.createdAt,
          societyId: bookings.societyId,
        })
        .from(bookings)
        .where(and(eq(bookings.societyId, societyId), eq(bookings.status, 'unassigned')))
        .orderBy(desc(bookings.createdAt));
      return rows.map((row) => ({ ...row, tradeCode: row.tradeCode as TradeCode }));
    },

    async setWorkerStatus(workerId, status, verifiedBy, now) {
      const moved = await db
        .update(workers)
        .set({ status, verifiedBy, verifiedAt: now })
        .where(eq(workers.userId, workerId))
        .returning({ id: workers.userId });
      return moved.length > 0;
    },

    async workerSocietyId(workerId) {
      const [row] = await db
        .select({ societyId: workers.societyId })
        .from(workers)
        .where(eq(workers.userId, workerId))
        .limit(1);
      return row?.societyId ?? null;
    },
  };
}
