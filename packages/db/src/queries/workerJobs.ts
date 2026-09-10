/**
 * Worker job-progression queries (Phase 6; AGENTS.md 6.6). Status changes are
 * compare-and-set and always write booking_events, matching queries/bookings.ts.
 */
import type {
  LcsAdminContact,
  TradeCode,
  WorkerEarningRow,
  WorkerJobRepo,
  WorkerJobRow,
  WorkerJobTransitionInput,
  WorkerOfferSnapshot,
} from '@kaithangu/core';
import { OTP_MAX_ATTEMPTS } from '@kaithangu/core';
import type { Locale } from '@kaithangu/i18n';
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { Database } from '../client';
import { bookingEvents, bookingOffers, bookings, users, workers } from '../schema';

const ACTIVE_JOB_STATUSES = ['accepted', 'en_route', 'in_progress'] as const;

function jobColumns() {
  return {
    bookingId: bookings.id,
    status: bookings.status,
    workerId: bookings.workerId,
    customerName: users.name,
    addressText: bookings.addressText,
    location: bookings.location,
    tradeCode: bookings.tradeCode,
    urgency: bookings.urgency,
    wagePaise: bookings.wagePaise,
    qrKeyVersion: workers.qrKeyVersion,
    startOtpHash: bookings.startOtpHash,
    completeOtpHash: bookings.completeOtpHash,
    startOtpAttempts: bookings.startOtpAttempts,
    completeOtpAttempts: bookings.completeOtpAttempts,
    otpLockedAt: bookings.otpLockedAt,
    societyId: bookings.societyId,
  };
}

function toRow(row: Awaited<ReturnType<typeof selectJob>>[number]): WorkerJobRow {
  return { ...row, tradeCode: row.tradeCode as TradeCode, workerId: row.workerId ?? '' };
}

function selectJob(db: Database) {
  return db
    .select(jobColumns())
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.customerId))
    .innerJoin(workers, eq(workers.userId, bookings.workerId));
}

export function createWorkerJobRepo(db: Database): WorkerJobRepo {
  return {
    async setAvailable(workerId, available, now) {
      await db
        .update(workers)
        .set({ available, availableUpdatedAt: now })
        .where(eq(workers.userId, workerId));
    },

    async activeJob(workerId) {
      const rows = await selectJob(db)
        .where(and(eq(bookings.workerId, workerId), inArray(bookings.status, ACTIVE_JOB_STATUSES)))
        .orderBy(desc(bookings.updatedAt))
        .limit(1);
      const [row] = rows;
      return row === undefined ? null : toRow(row);
    },

    async getForWorker(bookingId, workerId) {
      const rows = await selectJob(db)
        .where(and(eq(bookings.id, bookingId), eq(bookings.workerId, workerId)))
        .limit(1);
      const [row] = rows;
      return row === undefined ? null : toRow(row);
    },

    async transition(input: WorkerJobTransitionInput) {
      return db.transaction(async (tx) => {
        const moved = await tx
          .update(bookings)
          .set({ status: input.to })
          .where(and(eq(bookings.id, input.bookingId), eq(bookings.status, input.from)))
          .returning({ id: bookings.id });
        if (moved.length === 0) return false;
        await tx.insert(bookingEvents).values({
          bookingId: input.bookingId,
          actorUserId: input.actorUserId,
          fromStatus: input.from,
          toStatus: input.to,
          meta: input.meta,
        });
        return true;
      });
    },

    async incrementOtpAttempts(bookingId, kind, now) {
      const column = kind === 'start' ? bookings.startOtpAttempts : bookings.completeOtpAttempts;
      const [row] = await db
        .update(bookings)
        .set(
          kind === 'start'
            ? { startOtpAttempts: sql`${bookings.startOtpAttempts} + 1` }
            : { completeOtpAttempts: sql`${bookings.completeOtpAttempts} + 1` },
        )
        .where(eq(bookings.id, bookingId))
        .returning({ attempts: column });
      const attempts = row?.attempts ?? 0;
      const locked = attempts >= OTP_MAX_ATTEMPTS;
      if (locked) {
        await db.update(bookings).set({ otpLockedAt: now }).where(eq(bookings.id, bookingId));
      }
      return { attempts, locked };
    },

    async markLastJobCompleted(workerId, at) {
      await db.update(workers).set({ lastJobCompletedAt: at }).where(eq(workers.userId, workerId));
    },

    async currentOffer(workerId): Promise<WorkerOfferSnapshot | null> {
      const [row] = await db
        .select({
          offerId: bookingOffers.id,
          bookingId: bookingOffers.bookingId,
          breakdown: bookingOffers.breakdown,
          offeredAt: bookingOffers.offeredAt,
          expiresAt: bookingOffers.expiresAt,
          tradeCode: bookings.tradeCode,
          urgency: bookings.urgency,
          wagePaise: bookings.wagePaise,
          pincode: bookings.pincode,
        })
        .from(bookingOffers)
        .innerJoin(bookings, eq(bookings.id, bookingOffers.bookingId))
        .where(and(eq(bookingOffers.workerId, workerId), isNull(bookingOffers.response)))
        .orderBy(desc(bookingOffers.offeredAt))
        .limit(1);
      if (row === undefined) return null;
      const [office] = await db.execute<{ office_name: string }>(sql`
        SELECT office_name FROM pincodes WHERE pincode = ${row.pincode}
        ORDER BY office_name LIMIT 1
      `);
      const distanceKm =
        typeof row.breakdown.distanceKm === 'number' ? row.breakdown.distanceKm : 0;
      return {
        offerId: row.offerId,
        bookingId: row.bookingId,
        tradeCode: row.tradeCode as TradeCode,
        urgency: row.urgency,
        area: office?.office_name ?? null,
        distanceKm,
        wagePaise: row.wagePaise,
        offeredAt: row.offeredAt,
        expiresAt: row.expiresAt,
      };
    },

    async earnings(workerId, sinceDays): Promise<WorkerEarningRow[]> {
      const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
      const rows = await db
        .select({
          bookingId: bookings.id,
          tradeCode: bookings.tradeCode,
          completedAt: bookings.completedAt,
          wagePaise: bookings.wagePaise,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.workerId, workerId),
            eq(bookings.status, 'completed'),
            gte(bookings.completedAt, since),
          ),
        )
        .orderBy(desc(bookings.completedAt));
      return rows
        .filter((row): row is typeof row & { completedAt: Date } => row.completedAt !== null)
        .map((row) => ({ ...row, tradeCode: row.tradeCode as TradeCode }));
    },

    async lcsAdmins(societyId): Promise<LcsAdminContact[]> {
      const rows = await db
        .select({ userId: users.id, phone: users.phone, locale: users.locale })
        .from(users)
        .where(and(eq(users.role, 'lcs_admin'), eq(users.societyId, societyId)));
      return rows.map((row) => ({
        userId: row.userId,
        phone: row.phone,
        locale: (row.locale ?? 'en') as Locale,
      }));
    },
  };
}
