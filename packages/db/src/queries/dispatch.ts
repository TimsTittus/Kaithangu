/**
 * Dispatch queries (Phase 6; AGENTS.md 6.3, 6.4, 6.6). Hard filters run in
 * SQL (sql/candidates.ts); this file wires that into the DispatchRepo port
 * core/services/dispatch.ts depends on. Status changes are compare-and-set
 * and always write booking_events (AGENTS.md 6.5), matching the pattern in
 * queries/bookings.ts.
 */
import type {
  CreateOfferRecord,
  DispatchBooking,
  DispatchOffer,
  DispatchRepo,
  DispatchTransitionInput,
  LcsAdminContact,
  MatchCandidate,
  MatchContext,
  TradeCode,
  WorkerContact,
} from '@kaithangu/core';
import type { Locale } from '@kaithangu/i18n';
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';
import type { Database } from '../client';
import { bookingEvents, bookingOffers, bookings, users, workers } from '../schema';
import {
  findCandidates as findCandidatesSql,
  loadMatchContext as loadMatchContextSql,
  nearestSociety,
} from '../sql/candidates';

const DEFAULT_LOCALE: Locale = 'en';

function toContact(row: { phone: string; locale: string | null }): {
  phone: string;
  locale: Locale;
} {
  return { phone: row.phone, locale: (row.locale ?? DEFAULT_LOCALE) as Locale };
}

function toBooking(row: typeof bookings.$inferSelect): DispatchBooking {
  return {
    id: row.id,
    status: row.status,
    tradeCode: row.tradeCode as TradeCode,
    urgency: row.urgency,
    societyId: row.societyId,
    stateCode: row.stateCode,
    customerId: row.customerId,
    location: row.location,
    scheduledFor: row.scheduledFor,
  };
}

function toOffer(row: typeof bookingOffers.$inferSelect): DispatchOffer {
  return {
    id: row.id,
    bookingId: row.bookingId,
    workerId: row.workerId,
    rank: row.rank,
    channel: row.channel,
    response: row.response,
    offeredAt: row.offeredAt,
    expiresAt: row.expiresAt,
  };
}

class SentinelBookingGone extends Error {}

export function createDispatchRepo(db: Database): DispatchRepo {
  return {
    async getBooking(bookingId) {
      const [row] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
      return row === undefined ? null : toBooking(row);
    },

    async assignNearestSociety(bookingId, stateCode, location) {
      const [existing] = await db
        .select({ societyId: bookings.societyId })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1);
      if (existing?.societyId != null) return existing.societyId;

      const societyId = await nearestSociety(db, stateCode, location);
      if (societyId === null) {
        throw new Error(`dispatch: no society found for state ${stateCode}`);
      }
      // CAS so a concurrent match attempt never clobbers an already-assigned
      // society; nearest-society is deterministic, so returning our own
      // computed value even when we lost that race is still correct.
      await db
        .update(bookings)
        .set({ societyId })
        .where(and(eq(bookings.id, bookingId), isNull(bookings.societyId)));
      return societyId;
    },

    async loadMatchContext(societyId, tradeCode): Promise<MatchContext> {
      const row = await loadMatchContextSql(db, societyId, tradeCode);
      return {
        societyMeanRating: row.societyMeanRating,
        medianEarnings30dPaise: row.medianEarnings30dPaise,
      };
    },

    async findCandidates(
      bookingId,
      societyId,
      tradeCode,
      location,
      societyMeanRating,
    ): Promise<MatchCandidate[]> {
      const certifiedRequired = await isCertifiedRequiredTrade(db, tradeCode);
      const rows = await findCandidatesSql(db, {
        bookingId,
        societyId,
        tradeCode,
        location,
        certifiedRequired,
        societyMeanRating,
      });
      return rows.map((row) => ({
        workerId: row.workerId,
        distanceKm: row.distanceKm,
        serviceRadiusKm: row.serviceRadiusKm,
        skillLevel: row.skillLevel,
        ratingSum: row.ratingSum,
        ratingCount: row.ratingCount,
        earnings30dPaise: row.earnings30dPaise,
        lastJobCompletedAt: row.lastJobCompletedAt,
      }));
    },

    async offersForBooking(bookingId) {
      const rows = await db
        .select()
        .from(bookingOffers)
        .where(eq(bookingOffers.bookingId, bookingId))
        .orderBy(asc(bookingOffers.rank));
      return rows.map(toOffer);
    },

    async getOffer(offerId) {
      const [row] = await db
        .select()
        .from(bookingOffers)
        .where(eq(bookingOffers.id, offerId))
        .limit(1);
      return row === undefined ? null : toOffer(row);
    },

    async createOffer(record: CreateOfferRecord) {
      const [row] = await db
        .insert(bookingOffers)
        .values({
          bookingId: record.bookingId,
          workerId: record.workerId,
          rank: record.rank,
          channel: record.channel,
          score: record.score.toFixed(4),
          breakdown: record.breakdown,
          explanationKey: record.explanationKey,
          explanationParams: record.explanationParams,
          offeredAt: record.offeredAt,
          expiresAt: record.expiresAt,
        })
        .returning();
      if (row === undefined) throw new Error('dispatch: offer insert returned no row');
      return toOffer(row);
    },

    async acceptOffer(offerId, workerId, now) {
      try {
        return await db.transaction(async (tx) => {
          const acceptedOffer = await tx
            .update(bookingOffers)
            .set({ response: 'accepted', respondedAt: now })
            .where(
              and(
                eq(bookingOffers.id, offerId),
                eq(bookingOffers.workerId, workerId),
                isNull(bookingOffers.response),
              ),
            )
            .returning({ bookingId: bookingOffers.bookingId });
          const offer = acceptedOffer[0];
          if (offer === undefined) throw new SentinelBookingGone();

          const movedBooking = await tx
            .update(bookings)
            .set({ workerId, status: 'accepted' })
            .where(and(eq(bookings.id, offer.bookingId), eq(bookings.status, 'offered')))
            .returning({ id: bookings.id });
          if (movedBooking.length === 0) throw new SentinelBookingGone();

          await tx.insert(bookingEvents).values({
            bookingId: offer.bookingId,
            actorUserId: workerId,
            fromStatus: 'offered',
            toStatus: 'accepted',
            meta: { offerId },
          });
          return 'accepted' as const;
        });
      } catch (error) {
        if (error instanceof SentinelBookingGone) return 'offer_gone';
        throw error;
      }
    },

    async supersedeOtherOffers(bookingId, exceptOfferId, now) {
      await db
        .update(bookingOffers)
        .set({ response: 'superseded', respondedAt: now })
        .where(
          and(
            eq(bookingOffers.bookingId, bookingId),
            ne(bookingOffers.id, exceptOfferId),
            isNull(bookingOffers.response),
          ),
        );
    },

    async respondOffer(offerId, to, now) {
      const moved = await db
        .update(bookingOffers)
        .set({ response: to, respondedAt: now })
        .where(and(eq(bookingOffers.id, offerId), isNull(bookingOffers.response)))
        .returning({ id: bookingOffers.id });
      return moved.length > 0;
    },

    async transitionBooking(input: DispatchTransitionInput) {
      return db.transaction(async (tx) => {
        const moved = await tx
          .update(bookings)
          .set({ status: input.to })
          .where(and(eq(bookings.id, input.bookingId), eq(bookings.status, input.from)))
          .returning({ id: bookings.id });
        if (moved.length === 0) return false;
        await tx.insert(bookingEvents).values({
          bookingId: input.bookingId,
          actorUserId: 'userId' in input.actor ? input.actor.userId : null,
          actorSystem: 'system' in input.actor ? input.actor.system : null,
          fromStatus: input.from,
          toStatus: input.to,
          meta: input.meta,
        });
        return true;
      });
    },

    async setJobOtps(bookingId, startHash, completeHash) {
      await db
        .update(bookings)
        .set({ startOtpHash: startHash, completeOtpHash: completeHash })
        .where(eq(bookings.id, bookingId));
    },

    async workerContact(workerId): Promise<WorkerContact | null> {
      const [row] = await db
        .select({
          userId: workers.userId,
          name: users.name,
          phone: users.phone,
          locale: users.locale,
          hasSmartphone: workers.hasSmartphone,
        })
        .from(workers)
        .innerJoin(users, eq(users.id, workers.userId))
        .where(eq(workers.userId, workerId))
        .limit(1);
      if (row === undefined) return null;
      return { ...row, ...toContact(row) };
    },

    async customerContact(customerId) {
      const [row] = await db
        .select({ phone: users.phone, locale: users.locale })
        .from(users)
        .where(eq(users.id, customerId))
        .limit(1);
      return row === undefined ? null : toContact(row);
    },

    async lcsAdmins(societyId): Promise<LcsAdminContact[]> {
      const rows = await db
        .select({ userId: users.id, phone: users.phone, locale: users.locale })
        .from(users)
        .where(and(eq(users.role, 'lcs_admin'), eq(users.societyId, societyId)));
      return rows.map((row) => ({ userId: row.userId, ...toContact(row) }));
    },
  };
}

async function isCertifiedRequiredTrade(db: Database, tradeCode: TradeCode): Promise<boolean> {
  const [row] = await db.execute<{ certified_required: boolean }>(sql`
    SELECT certified_required FROM trades WHERE code = ${tradeCode} LIMIT 1
  `);
  return row?.certified_required ?? false;
}
