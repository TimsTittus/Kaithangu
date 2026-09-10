/**
 * Booking queries (Phase 5). Reads take the ScopeFilter computed by core's
 * scopeFilter() and apply it in SQL (AGENTS.md 4.2). Status changes are
 * compare-and-set and always write booking_events (AGENTS.md 6.5).
 */
import type {
  BookingEventRecord,
  BookingRepo,
  BookingStatus,
  IdempotentBooking,
  ScopeFilter,
  TradeCode,
} from '@kaithangu/core';
import { and, asc, desc, eq, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../client';
import {
  addresses,
  bookingEvents,
  bookings,
  idempotencyKeys,
  societies,
  users,
  workers,
} from '../schema';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const IDEMPOTENCY_SCOPE = 'booking.create';

const idempotentResponse = z.object({ bookingId: z.uuid(), requestHash: z.string().min(1) });

/** The SQL condition for a scope over bookings. */
export function bookingScopeCondition(scope: ScopeFilter): SQL | undefined {
  switch (scope.kind) {
    case 'all':
      return undefined;
    case 'state':
      return eq(bookings.stateCode, scope.stateCode);
    case 'society':
      return eq(bookings.societyId, scope.societyId);
    case 'institution':
      return eq(bookings.institutionId, scope.institutionId);
    case 'own_customer':
      return eq(bookings.customerId, scope.userId);
    case 'own_worker':
      return eq(bookings.workerId, scope.userId);
  }
}

async function readIdempotent(
  executor: Database | Transaction,
  key: string,
): Promise<IdempotentBooking | null> {
  const [row] = await executor
    .select({ response: idempotencyKeys.response })
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.key, key), eq(idempotencyKeys.scope, IDEMPOTENCY_SCOPE)))
    .limit(1);
  const parsed = idempotentResponse.safeParse(row?.response);
  if (!parsed.success) return null;
  const [booking] = await executor
    .select({ status: bookings.status })
    .from(bookings)
    .where(eq(bookings.id, parsed.data.bookingId))
    .limit(1);
  if (booking === undefined) return null;
  return { ...parsed.data, status: booking.status };
}

function surchargeFrom(quote: Record<string, unknown>): number {
  const value = quote.surchargePaise;
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : 0;
}

export function createBookingRepo(db: Database): BookingRepo {
  return {
    findIdempotent(key) {
      return readIdempotent(db, key);
    },

    create({ idempotencyKey, requestHash, draft }) {
      return db.transaction(async (tx) => {
        // A concurrent claim of the same key blocks here until that
        // transaction commits, then reads its stored response.
        const claimed = await tx
          .insert(idempotencyKeys)
          .values({ key: idempotencyKey, scope: IDEMPOTENCY_SCOPE })
          .onConflictDoNothing()
          .returning({ key: idempotencyKeys.key });
        if (claimed.length === 0) {
          const existing = await readIdempotent(tx, idempotencyKey);
          if (existing === null || existing.requestHash !== requestHash) {
            return { kind: 'conflict' } as const;
          }
          return { kind: 'replayed', id: existing.bookingId, status: existing.status } as const;
        }

        const [booking] = await tx
          .insert(bookings)
          .values({ ...draft, source: 'pwa', status: 'requested' })
          .returning({ id: bookings.id, status: bookings.status });
        if (booking === undefined) throw new Error('booking insert returned no row');
        await tx.insert(bookingEvents).values({
          bookingId: booking.id,
          actorUserId: draft.customerId,
          fromStatus: null,
          toStatus: 'requested',
          meta: { source: 'pwa' },
        });
        await tx
          .update(idempotencyKeys)
          .set({ response: { bookingId: booking.id, requestHash } })
          .where(eq(idempotencyKeys.key, idempotencyKey));

        const [saved] = await tx
          .select({ id: addresses.id })
          .from(addresses)
          .where(
            and(
              eq(addresses.userId, draft.customerId),
              eq(addresses.addressText, draft.addressText),
              eq(addresses.pincode, draft.pincode),
            ),
          )
          .limit(1);
        if (saved === undefined) {
          await tx.insert(addresses).values({
            userId: draft.customerId,
            addressText: draft.addressText,
            pincode: draft.pincode,
            location: draft.location,
          });
        }
        return { kind: 'created', id: booking.id, status: booking.status } as const;
      });
    },

    async get(bookingId, scope) {
      const [row] = await db
        .select({
          id: bookings.id,
          customerId: bookings.customerId,
          institutionId: bookings.institutionId,
          stateCode: bookings.stateCode,
          societyId: bookings.societyId,
          workerId: bookings.workerId,
          tradeCode: bookings.tradeCode,
          problemText: bookings.problemText,
          urgency: bookings.urgency,
          scheduledFor: bookings.scheduledFor,
          addressText: bookings.addressText,
          pincode: bookings.pincode,
          status: bookings.status,
          quote: bookings.quote,
          wagePaise: bookings.wagePaise,
          welfarePaise: bookings.welfarePaise,
          platformFeePaise: bookings.platformFeePaise,
          gstPaise: bookings.gstPaise,
          totalPaise: bookings.totalPaise,
          createdAt: bookings.createdAt,
        })
        .from(bookings)
        .where(and(eq(bookings.id, bookingId), bookingScopeCondition(scope)))
        .limit(1);
      if (row === undefined) return null;

      const events: BookingEventRecord[] = await db
        .select({
          fromStatus: bookingEvents.fromStatus,
          toStatus: bookingEvents.toStatus,
          at: bookingEvents.at,
        })
        .from(bookingEvents)
        .where(eq(bookingEvents.bookingId, row.id))
        .orderBy(asc(bookingEvents.at), asc(bookingEvents.id));

      let worker = null;
      if (row.workerId !== null) {
        const [found] = await db
          .select({
            id: workers.userId,
            name: users.name,
            societyName: societies.name,
            ratingSum: workers.ratingSum,
            ratingCount: workers.ratingCount,
            qrKeyVersion: workers.qrKeyVersion,
          })
          .from(workers)
          .innerJoin(users, eq(users.id, workers.userId))
          .innerJoin(societies, eq(societies.id, workers.societyId))
          .where(eq(workers.userId, row.workerId))
          .limit(1);
        worker = found ?? null;
      }

      const { quote, ...rest } = row;
      return {
        ...rest,
        tradeCode: row.tradeCode as TradeCode,
        surchargePaise: surchargeFrom(quote),
        events,
        worker,
      };
    },

    async list(scope, limit) {
      const rows = await db
        .select({
          id: bookings.id,
          tradeCode: bookings.tradeCode,
          status: bookings.status,
          urgency: bookings.urgency,
          scheduledFor: bookings.scheduledFor,
          createdAt: bookings.createdAt,
          totalPaise: bookings.totalPaise,
        })
        .from(bookings)
        .where(bookingScopeCondition(scope))
        .orderBy(desc(bookings.createdAt), desc(bookings.id))
        .limit(limit);
      return rows.map((row) => ({ ...row, tradeCode: row.tradeCode as TradeCode }));
    },

    transition({ bookingId, from, to, actorUserId, meta, cancelledReason }) {
      return db.transaction(async (tx) => {
        const patch: { status: BookingStatus; cancelledReason?: string | null } = { status: to };
        if (to === 'cancelled') patch.cancelledReason = cancelledReason;
        const moved = await tx
          .update(bookings)
          .set(patch)
          .where(and(eq(bookings.id, bookingId), eq(bookings.status, from)))
          .returning({ id: bookings.id });
        if (moved.length === 0) return false;
        await tx.insert(bookingEvents).values({
          bookingId,
          actorUserId,
          fromStatus: from,
          toStatus: to,
          meta,
        });
        return true;
      });
    },

    async savedAddresses(userId, limit) {
      return db
        .select({
          id: addresses.id,
          label: addresses.label,
          addressText: addresses.addressText,
          pincode: addresses.pincode,
          location: addresses.location,
        })
        .from(addresses)
        .where(eq(addresses.userId, userId))
        .orderBy(desc(addresses.createdAt), asc(addresses.id))
        .limit(limit);
    },
  };
}
