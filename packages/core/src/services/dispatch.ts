/**
 * Matching + dispatch (AGENTS.md 6.3, 6.4, 6.6). One offer at a time is
 * created just-in-time by offerNextCandidate: normal bookings advance
 * sequentially (one active offer, next candidate on decline/timeout, up to
 * MAX_NORMAL_OFFERS); emergency bookings get MAX_EMERGENCY_OFFERS offers in
 * one pass (parallel, no backfill on decline/timeout). Both share the same
 * candidate-selection and offer-creation code, since the candidates query
 * (AGENTS.md 6.3) already excludes workers already offered this booking.
 *
 * Accept is a compare-and-set in Postgres (DispatchRepo.acceptOffer): exactly
 * one concurrent accept wins regardless of any external lock. Job OTPs are
 * generated (not merely derived) here, at accept, per booking/codes.ts's
 * comment that the dispatch phase owns this step.
 */
import { assertCan, requireRole } from '../authz';
import type { RequestContext } from '../context';
import { AppError } from '../errors';
import { deriveJobOtp } from '../booking/codes';
import type { BookingStatus } from '../booking/stateMachine';
import { canTransition } from '../booking/stateMachine';
import type { Locale } from '@kaithangu/i18n';
import type { MatchCandidate, MatchContext, MatchMode } from '../matching/score';
import { rankCandidates } from '../matching/score';
import { hashOtp } from '../otp';
import type { Urgency } from '../pricing';
import type { TradeCode } from '../trades';
import { parseInput } from '../validation';
import { z } from 'zod';

export const MAX_NORMAL_OFFERS = 5;
export const MAX_EMERGENCY_OFFERS = 3;

export type OfferChannel = 'app' | 'sms' | 'ivr';
export type OfferResponseValue = 'accepted' | 'declined' | 'timeout' | 'superseded';

export interface DispatchBooking {
  id: string;
  status: BookingStatus;
  tradeCode: TradeCode;
  urgency: Urgency;
  societyId: string | null;
  stateCode: string;
  customerId: string;
  location: { lng: number; lat: number };
  scheduledFor: Date | null;
}

export interface DispatchOffer {
  id: string;
  bookingId: string;
  workerId: string;
  rank: number;
  channel: OfferChannel;
  response: OfferResponseValue | null;
  offeredAt: Date;
  expiresAt: Date;
}

export interface CreateOfferRecord {
  bookingId: string;
  workerId: string;
  rank: number;
  channel: OfferChannel;
  score: number;
  breakdown: Record<string, unknown>;
  explanationKey: string;
  explanationParams: Record<string, unknown>;
  offeredAt: Date;
  expiresAt: Date;
}

export type DispatchActor = { userId: string } | { system: string };

export interface DispatchTransitionInput {
  bookingId: string;
  from: BookingStatus;
  to: BookingStatus;
  actor: DispatchActor;
  meta: Record<string, unknown>;
}

export interface WorkerContact {
  userId: string;
  name: string | null;
  phone: string;
  locale: Locale;
  hasSmartphone: boolean;
}

export interface LcsAdminContact {
  userId: string;
  phone: string;
  locale: Locale;
}

export interface DispatchRepo {
  getBooking(bookingId: string): Promise<DispatchBooking | null>;
  /** Assigns and returns the booking's nearest society (AGENTS.md 1); idempotent. */
  assignNearestSociety(
    bookingId: string,
    stateCode: string,
    location: DispatchBooking['location'],
  ): Promise<string>;
  loadMatchContext(societyId: string, tradeCode: TradeCode): Promise<MatchContext>;
  findCandidates(
    bookingId: string,
    societyId: string,
    tradeCode: TradeCode,
    location: DispatchBooking['location'],
    societyMeanRating: number,
  ): Promise<MatchCandidate[]>;
  offersForBooking(bookingId: string): Promise<DispatchOffer[]>;
  getOffer(offerId: string): Promise<DispatchOffer | null>;
  createOffer(record: CreateOfferRecord): Promise<DispatchOffer>;
  acceptOffer(
    offerId: string,
    workerId: string,
    now: Date,
  ): Promise<'accepted' | 'offer_gone' | 'booking_gone'>;
  supersedeOtherOffers(bookingId: string, exceptOfferId: string, now: Date): Promise<void>;
  /** CAS the offer's response from null to `to`. False if it already had one. */
  respondOffer(offerId: string, to: 'declined' | 'timeout', now: Date): Promise<boolean>;
  transitionBooking(input: DispatchTransitionInput): Promise<boolean>;
  setJobOtps(bookingId: string, startHash: string, completeHash: string): Promise<void>;
  workerContact(workerId: string): Promise<WorkerContact | null>;
  customerContact(customerId: string): Promise<{ phone: string; locale: Locale } | null>;
  lcsAdmins(societyId: string): Promise<LcsAdminContact[]>;
}

export interface OfferScheduler {
  scheduleOfferTimeout(offerId: string, delaySeconds: number): Promise<void>;
}

export interface NotifyInput {
  userId: string;
  channel: OfferChannel;
  kind: string;
  bookingId: string | null;
  titleKey: string;
  params: Record<string, string | number>;
  locale: Locale;
  phone: string | null;
}

export interface Notifier {
  notify(input: NotifyInput): Promise<void>;
}

export interface DispatchDeps {
  repo: DispatchRepo;
  scheduler: OfferScheduler;
  notifier: Notifier;
  /** Server secret for derived job OTPs (AGENTS.md 5); ≥ 32 chars. */
  codeSecret: string;
  offerTimeoutSeconds: number;
  now?: () => Date;
}

function modeOf(urgency: Urgency): MatchMode {
  return urgency === 'emergency' ? 'emergency' : 'normal';
}

function maxOffersFor(urgency: Urgency): number {
  return urgency === 'emergency' ? MAX_EMERGENCY_OFFERS : MAX_NORMAL_OFFERS;
}

const offerIdSchema = z.uuid();
const bookingIdSchema = z.uuid();

export function createDispatchService(deps: DispatchDeps) {
  const now = deps.now ?? (() => new Date());

  async function transition(
    bookingId: string,
    from: BookingStatus,
    to: BookingStatus,
    actor: DispatchActor,
    meta: Record<string, unknown> = {},
  ): Promise<boolean> {
    return deps.repo.transitionBooking({ bookingId, from, to, actor, meta });
  }

  async function notifyWorkerOfOffer(
    booking: DispatchBooking,
    offer: DispatchOffer,
  ): Promise<void> {
    const worker = await deps.repo.workerContact(offer.workerId);
    if (worker === null) return;
    const channel: OfferChannel = worker.hasSmartphone ? 'app' : 'ivr';
    await deps.notifier.notify({
      userId: worker.userId,
      channel,
      kind: 'job_offer',
      bookingId: booking.id,
      titleKey: 'notification.job_offer',
      params: { trade: booking.tradeCode },
      locale: worker.locale,
      phone: worker.phone,
    });
    if (worker.hasSmartphone) {
      await deps.notifier.notify({
        userId: worker.userId,
        channel: 'sms',
        kind: 'job_offer',
        bookingId: booking.id,
        titleKey: 'sms.job_offer',
        params: { trade: booking.tradeCode },
        locale: worker.locale,
        phone: worker.phone,
      });
    }
  }

  async function notifyUnassigned(booking: DispatchBooking): Promise<void> {
    if (booking.societyId === null) return;
    const admins = await deps.repo.lcsAdmins(booking.societyId);
    await Promise.all(
      admins.map((admin) =>
        deps.notifier.notify({
          userId: admin.userId,
          channel: 'app',
          kind: 'booking_unassigned',
          bookingId: booking.id,
          titleKey: 'notification.booking_unassigned',
          params: { trade: booking.tradeCode },
          locale: admin.locale,
          phone: admin.phone,
        }),
      ),
    );
    await Promise.all(
      admins.map((admin) =>
        deps.notifier.notify({
          userId: admin.userId,
          channel: 'sms',
          kind: 'booking_unassigned',
          bookingId: booking.id,
          titleKey: 'sms.booking_unassigned',
          params: { trade: booking.tradeCode },
          locale: admin.locale,
          phone: admin.phone,
        }),
      ),
    );
  }

  async function notifyLosers(booking: DispatchBooking, offers: DispatchOffer[], winnerId: string) {
    const losers = offers.filter((o) => o.id !== winnerId && o.response === 'superseded');
    await Promise.all(
      losers.map(async (offer) => {
        const worker = await deps.repo.workerContact(offer.workerId);
        if (worker === null) return;
        await deps.notifier.notify({
          userId: worker.userId,
          channel: 'app',
          kind: 'offer_taken',
          bookingId: booking.id,
          titleKey: 'notification.offer_taken',
          params: { trade: booking.tradeCode },
          locale: worker.locale,
          phone: worker.phone,
        });
      }),
    );
  }

  /**
   * Create one offer for the next-best not-yet-offered candidate. Returns
   * 'offered' on success, 'exhausted' when there is no eligible candidate
   * left or the mode's offer cap (AGENTS.md 6.4) is reached.
   */
  async function offerNextCandidate(booking: DispatchBooking): Promise<'offered' | 'exhausted'> {
    const existing = await deps.repo.offersForBooking(booking.id);
    if (existing.length >= maxOffersFor(booking.urgency)) return 'exhausted';
    if (booking.societyId === null) return 'exhausted';

    const context = await deps.repo.loadMatchContext(booking.societyId, booking.tradeCode);
    const candidates = await deps.repo.findCandidates(
      booking.id,
      booking.societyId,
      booking.tradeCode,
      booking.location,
      context.societyMeanRating,
    );
    if (candidates.length === 0) return 'exhausted';

    const [best] = rankCandidates(candidates, context, modeOf(booking.urgency));
    if (best === undefined) return 'exhausted';

    const worker = await deps.repo.workerContact(best.candidate.workerId);
    const channel: OfferChannel = worker?.hasSmartphone === false ? 'ivr' : 'app';
    const offeredAt = now();
    const expiresAt = new Date(offeredAt.getTime() + deps.offerTimeoutSeconds * 1000);
    const offer = await deps.repo.createOffer({
      bookingId: booking.id,
      workerId: best.candidate.workerId,
      rank: existing.length + 1,
      channel,
      score: best.score,
      breakdown: best.breakdown as unknown as Record<string, unknown>,
      explanationKey: best.explanation.key,
      explanationParams: best.explanation.params,
      offeredAt,
      expiresAt,
    });
    // matching|unassigned -> offered; a concurrent call already having moved
    // it there is fine (this call still created a real, live offer row).
    if (booking.status !== 'offered') {
      await transition(booking.id, booking.status, 'offered', { system: 'dispatch.offer' });
    }
    await deps.scheduler.scheduleOfferTimeout(offer.id, deps.offerTimeoutSeconds);
    await notifyWorkerOfOffer(booking, offer);
    return 'offered';
  }

  async function exhaustToUnassigned(booking: DispatchBooking): Promise<void> {
    const from =
      booking.status === 'offered' || booking.status === 'unassigned' ? booking.status : 'matching';
    if (!canTransition(from, 'unassigned')) return;
    const moved = await transition(booking.id, from, 'unassigned', {
      system: 'dispatch.exhausted',
    });
    if (moved) await notifyUnassigned(booking);
  }

  /**
   * Entry point for the match consumer (AGENTS.md 6.4). Idempotent: a
   * booking already past 'matching' (raced by another delivery, or already
   * offered/unassigned) is a no-op.
   */
  async function runMatching(bookingId: string): Promise<void> {
    const loaded = await deps.repo.getBooking(bookingId);
    if (loaded === null) return;
    if (loaded.status !== 'requested' && loaded.status !== 'matching') return;

    if (loaded.status === 'requested') {
      const moved = await transition(bookingId, 'requested', 'matching', {
        system: 'dispatch.match',
      });
      if (!moved) return; // lost the race to another delivery
    }

    const societyId = await deps.repo.assignNearestSociety(
      bookingId,
      loaded.stateCode,
      loaded.location,
    );
    let booking: DispatchBooking = { ...loaded, status: 'matching', societyId };

    const attempts = booking.urgency === 'emergency' ? MAX_EMERGENCY_OFFERS : 1;
    let anyOffered = false;
    for (let i = 0; i < attempts; i += 1) {
      const result = await offerNextCandidate(booking);
      if (result !== 'offered') break;
      anyOffered = true;
      booking = { ...booking, status: 'offered' };
    }
    if (!anyOffered) await exhaustToUnassigned(booking);
  }

  /** Offer-timeout consumer entry point; safe to process the same job twice. */
  async function handleOfferTimeout(offerId: string): Promise<void> {
    const offer = await deps.repo.getOffer(offerId);
    if (offer === null) return;
    const moved = await deps.repo.respondOffer(offerId, 'timeout', now());
    if (!moved) return; // already responded (accepted/declined/superseded) or a prior timeout

    const booking = await deps.repo.getBooking(offer.bookingId);
    if (booking === null || booking.status !== 'offered') return;

    if (booking.urgency === 'emergency') {
      const offers = await deps.repo.offersForBooking(booking.id);
      const stillLive = offers.some((o) => o.response === null || o.response === 'accepted');
      if (!stillLive) await exhaustToUnassigned(booking);
      return;
    }
    const result = await offerNextCandidate(booking);
    if (result === 'exhausted') await exhaustToUnassigned(booking);
  }

  return {
    runMatching,
    handleOfferTimeout,

    /** Worker accepts or declines an offer (AGENTS.md 6.4/6.6). */
    async respondOffer(
      ctx: RequestContext,
      offerIdRaw: unknown,
      response: 'accept' | 'decline',
    ): Promise<{ bookingId: string }> {
      const { actor } = requireRole(ctx, ['worker']);
      const offerId = parseInput(offerIdSchema, offerIdRaw);
      const offer = await deps.repo.getOffer(offerId);
      if (offer === null) throw new AppError('NOT_FOUND');
      assertCan(actor, 'offer.respond', { workerId: offer.workerId });

      if (response === 'decline') {
        const moved = await deps.repo.respondOffer(offerId, 'declined', now());
        if (!moved) throw new AppError('OFFER_UNAVAILABLE');
        const booking = await deps.repo.getBooking(offer.bookingId);
        if (booking !== null && booking.status === 'offered') {
          if (booking.urgency === 'emergency') {
            const offers = await deps.repo.offersForBooking(booking.id);
            const stillLive = offers.some((o) => o.response === null || o.response === 'accepted');
            if (!stillLive) await exhaustToUnassigned(booking);
          } else {
            const result = await offerNextCandidate(booking);
            if (result === 'exhausted') await exhaustToUnassigned(booking);
          }
        }
        return { bookingId: offer.bookingId };
      }

      const outcome = await deps.repo.acceptOffer(offerId, actor.userId, now());
      if (outcome !== 'accepted') throw new AppError('OFFER_UNAVAILABLE');

      const startOtp = deriveJobOtp(deps.codeSecret, offer.bookingId, 'start');
      const completeOtp = deriveJobOtp(deps.codeSecret, offer.bookingId, 'complete');
      await deps.repo.setJobOtps(
        offer.bookingId,
        hashOtp(startOtp, deps.codeSecret),
        hashOtp(completeOtp, deps.codeSecret),
      );
      await deps.repo.supersedeOtherOffers(offer.bookingId, offer.id, now());

      const booking = await deps.repo.getBooking(offer.bookingId);
      if (booking !== null) {
        const offers = await deps.repo.offersForBooking(booking.id);
        await notifyLosers(booking, offers, offer.id);
        const customer = await deps.repo.customerContact(booking.customerId);
        if (customer !== null) {
          // AGENTS.md 6.6: the customer is sent the job OTPs by SMS on accept
          // (the PWA tracking page re-derives them for display; voice read-back
          // is out of scope until apps/voice has a real call flow).
          await deps.notifier.notify({
            userId: booking.customerId,
            channel: 'sms',
            kind: 'job_otps',
            bookingId: booking.id,
            titleKey: 'sms.job_otps',
            params: { startOtp, completeOtp },
            locale: customer.locale,
            phone: customer.phone,
          });
        }
      }
      return { bookingId: offer.bookingId };
    },

    /** LCS/state/national admin assigns a specific worker (AGENTS.md, manual assign). */
    async manualAssign(
      ctx: RequestContext,
      bookingIdRaw: unknown,
      workerId: unknown,
    ): Promise<{ offerId: string }> {
      const { actor } = requireRole(ctx, ['lcs_admin', 'state_admin', 'national_admin']);
      const bookingId = parseInput(bookingIdSchema, bookingIdRaw);
      const targetWorkerId = parseInput(z.uuid(), workerId);
      const booking = await deps.repo.getBooking(bookingId);
      if (booking === null) throw new AppError('NOT_FOUND');
      assertCan(actor, 'booking.assign_manual', {
        stateCode: booking.stateCode,
        societyId: booking.societyId,
      });
      if (booking.status !== 'offered' && !canTransition(booking.status, 'offered')) {
        throw new AppError('INVALID_TRANSITION', undefined, undefined, {
          from: booking.status,
          to: 'offered',
        });
      }
      const worker = await deps.repo.workerContact(targetWorkerId);
      if (worker === null) throw new AppError('NOT_FOUND');

      const offeredAt = now();
      const expiresAt = new Date(offeredAt.getTime() + deps.offerTimeoutSeconds * 1000);
      const existing = await deps.repo.offersForBooking(bookingId);
      const offer = await deps.repo.createOffer({
        bookingId,
        workerId: targetWorkerId,
        rank: existing.length + 1,
        channel: worker.hasSmartphone ? 'app' : 'ivr',
        score: 0,
        breakdown: { manualAssign: true, assignedBy: actor.userId },
        explanationKey: 'matching.why.manual',
        explanationParams: {},
        offeredAt,
        expiresAt,
      });
      if (booking.status !== 'offered') {
        await transition(
          bookingId,
          booking.status,
          'offered',
          { userId: actor.userId },
          {
            manual: true,
          },
        );
      }
      await deps.scheduler.scheduleOfferTimeout(offer.id, deps.offerTimeoutSeconds);
      await notifyWorkerOfOffer(booking, offer);
      return { offerId: offer.id };
    },
  };
}

export type DispatchService = ReturnType<typeof createDispatchService>;
