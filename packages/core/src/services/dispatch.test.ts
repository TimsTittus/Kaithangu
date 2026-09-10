import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { deriveJobOtp } from '../booking/codes';
import type { RequestContext, UserActor } from '../context';
import { verifyOtp } from '../otp';
import {
  createDispatchService,
  MAX_EMERGENCY_OFFERS,
  MAX_NORMAL_OFFERS,
  type DispatchService,
} from './dispatch';
import {
  MemoryDispatchRepo,
  MemoryDispatchStore,
  MemoryNotifier,
  MemoryOfferScheduler,
  type InternalBooking,
  type InternalWorker,
} from './testing';

const SECRET = 'test-only-code-secret-0123456789abcdef';
const SOCIETY_ID = 'society-1';
const NOW = new Date('2026-09-10T03:30:00Z');

function makeWorker(opts: { distanceKm?: number; hasSmartphone?: boolean } = {}): InternalWorker {
  const userId = randomUUID();
  return {
    userId,
    name: `Worker ${userId.slice(0, 4)}`,
    phone: '+919900000000',
    locale: 'en',
    hasSmartphone: opts.hasSmartphone ?? true,
    societyId: SOCIETY_ID,
    available: true,
    candidate: {
      workerId: userId,
      distanceKm: opts.distanceKm ?? 2,
      serviceRadiusKm: 8,
      skillLevel: 2,
      ratingSum: 0,
      ratingCount: 0,
      earnings30dPaise: 0,
      lastJobCompletedAt: null,
    },
  };
}

function makeBooking(overrides: Partial<InternalBooking> = {}): InternalBooking {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    status: 'requested',
    tradeCode: 'plumber',
    urgency: 'normal',
    societyId: null,
    stateCode: 'KL',
    customerId: 'customer-1',
    workerId: null,
    location: { lng: 76.28, lat: 9.98 },
    scheduledFor: null,
    completedAt: null,
    addressText: '1 Test Street',
    customerName: 'Test Customer',
    wagePaise: 30_000,
    qrKeyVersion: 1,
    startOtpHash: null,
    completeOtpHash: null,
    startOtpAttempts: 0,
    completeOtpAttempts: 0,
    otpLockedAt: null,
    ...overrides,
  };
}

interface Fixture {
  store: MemoryDispatchStore;
  repo: MemoryDispatchRepo;
  scheduler: MemoryOfferScheduler;
  notifier: MemoryNotifier;
  service: DispatchService;
}

function setup(): Fixture {
  const store = new MemoryDispatchStore();
  const repo = new MemoryDispatchRepo(store, SOCIETY_ID);
  const scheduler = new MemoryOfferScheduler();
  const notifier = new MemoryNotifier();
  const service = createDispatchService({
    repo,
    scheduler,
    notifier,
    codeSecret: SECRET,
    offerTimeoutSeconds: 45,
    now: () => NOW,
  });
  return { store, repo, scheduler, notifier, service };
}

function workerCtx(userId: string): RequestContext {
  const actor: UserActor = { userId, role: 'worker' };
  return { actor, requestId: 'req-1', locale: 'en' };
}

function adminCtx(societyId: string = SOCIETY_ID): RequestContext {
  const actor: UserActor = { userId: 'admin-1', role: 'lcs_admin', societyId, stateCode: 'KL' };
  return { actor, requestId: 'req-2', locale: 'en' };
}

describe('dispatch: runMatching (normal)', () => {
  let f: Fixture;
  let b: InternalBooking;

  beforeEach(() => {
    f = setup();
    b = makeBooking();
    f.store.bookings.set(b.id, b);
    for (let i = 0; i < 3; i += 1) {
      const w = makeWorker({ distanceKm: i + 1 });
      f.store.workers.set(w.userId, w);
    }
  });

  it('assigns the nearest society, transitions to offered, and offers the top-ranked candidate', async () => {
    await f.service.runMatching(b.id);

    const updated = f.store.bookings.get(b.id);
    expect(updated?.status).toBe('offered');
    expect(updated?.societyId).toBe(SOCIETY_ID);

    const offers = await f.repo.offersForBooking(b.id);
    expect(offers).toHaveLength(1);
    expect(offers[0]?.rank).toBe(1);
    const nearest = [...f.store.workers.values()].sort(
      (a, c) => a.candidate.distanceKm - c.candidate.distanceKm,
    )[0];
    expect(offers[0]?.workerId).toBe(nearest?.userId);

    expect(f.scheduler.scheduled).toHaveLength(1);
    expect(f.scheduler.scheduled[0]).toMatchObject({ offerId: offers[0]?.id, delaySeconds: 45 });
    expect(f.notifier.sent.some((n) => n.kind === 'job_offer')).toBe(true);
  });

  it('is idempotent: a booking no longer in requested/matching is left alone', async () => {
    f.store.bookings.set(b.id, { ...b, status: 'cancelled' });
    await f.service.runMatching(b.id);
    expect(await f.repo.offersForBooking(b.id)).toHaveLength(0);
  });

  it('goes straight to unassigned and alerts lcs_admin when there are no eligible workers', async () => {
    f.store.workers.clear();
    f.store.lcsAdminsBySociety.set(SOCIETY_ID, [
      { userId: 'admin-1', phone: '+919911111111', locale: 'en' },
    ]);
    await f.service.runMatching(b.id);

    expect(f.store.bookings.get(b.id)?.status).toBe('unassigned');
    expect(f.notifier.sent.some((n) => n.kind === 'booking_unassigned')).toBe(true);
  });
});

describe('dispatch: runMatching (emergency)', () => {
  it('offers to up to MAX_EMERGENCY_OFFERS candidates in parallel', async () => {
    const f = setup();
    const b = makeBooking({ urgency: 'emergency' });
    f.store.bookings.set(b.id, b);
    for (let i = 0; i < 5; i += 1) {
      const w = makeWorker();
      f.store.workers.set(w.userId, w);
    }

    await f.service.runMatching(b.id);

    const offers = await f.repo.offersForBooking(b.id);
    expect(offers).toHaveLength(MAX_EMERGENCY_OFFERS);
    expect(new Set(offers.map((o) => o.workerId)).size).toBe(MAX_EMERGENCY_OFFERS);
    expect(f.scheduler.scheduled).toHaveLength(MAX_EMERGENCY_OFFERS);
    expect(f.store.bookings.get(b.id)?.status).toBe('offered');
  });
});

describe('dispatch: sequential exhaustion (normal)', () => {
  it('advances through candidates on timeout and lands on unassigned once exhausted', async () => {
    const f = setup();
    const b = makeBooking();
    f.store.bookings.set(b.id, b);
    const workerIds: string[] = [];
    for (let i = 0; i < MAX_NORMAL_OFFERS; i += 1) {
      const w = makeWorker();
      f.store.workers.set(w.userId, w);
      workerIds.push(w.userId);
    }
    f.store.lcsAdminsBySociety.set(SOCIETY_ID, [
      { userId: 'admin-1', phone: '+919911111111', locale: 'en' },
    ]);

    await f.service.runMatching(b.id);

    const offeredWorkers: string[] = [];
    for (let round = 0; round < MAX_NORMAL_OFFERS; round += 1) {
      const offers = await f.repo.offersForBooking(b.id);
      const active = offers.find((o) => o.response === null);
      expect(active).toBeDefined();
      offeredWorkers.push(active!.workerId);
      await f.service.handleOfferTimeout(active!.id);
    }

    expect(new Set(offeredWorkers).size).toBe(MAX_NORMAL_OFFERS);
    expect(f.store.bookings.get(b.id)?.status).toBe('unassigned');
    expect(f.notifier.sent.some((n) => n.kind === 'booking_unassigned')).toBe(true);
  });

  it('processing the same offer-timeout job twice has no double effect', async () => {
    const f = setup();
    const b = makeBooking();
    f.store.bookings.set(b.id, b);
    const w = makeWorker();
    f.store.workers.set(w.userId, w);

    await f.service.runMatching(b.id);
    const [offer] = await f.repo.offersForBooking(b.id);
    expect(offer).toBeDefined();

    await f.service.handleOfferTimeout(offer!.id);
    const afterFirst = await f.repo.offersForBooking(b.id);
    const eventsAfterFirst = f.store.transitions.length;

    await f.service.handleOfferTimeout(offer!.id);
    const afterSecond = await f.repo.offersForBooking(b.id);

    expect(afterSecond).toEqual(afterFirst);
    expect(f.store.transitions.length).toBe(eventsAfterFirst);
  });
});

describe('dispatch: respondOffer', () => {
  it('accept: transitions the booking, generates and stores job OTP hashes, and notifies the customer', async () => {
    const f = setup();
    const b = makeBooking();
    f.store.bookings.set(b.id, b);
    const w = makeWorker();
    f.store.workers.set(w.userId, w);
    f.store.customers.set(b.customerId, { phone: '+919922222222', locale: 'en' });

    await f.service.runMatching(b.id);
    const [offer] = await f.repo.offersForBooking(b.id);

    const result = await f.service.respondOffer(workerCtx(w.userId), offer!.id, 'accept');
    expect(result.bookingId).toBe(b.id);

    const updated = f.store.bookings.get(b.id)!;
    expect(updated.status).toBe('accepted');
    expect(updated.workerId).toBe(w.userId);
    expect(updated.startOtpHash).not.toBeNull();
    expect(updated.completeOtpHash).not.toBeNull();

    const startOtp = deriveJobOtp(SECRET, b.id, 'start');
    expect(verifyOtp(startOtp, updated.startOtpHash!, SECRET)).toBe(true);

    const otpSms = f.notifier.sent.find((n) => n.kind === 'job_otps');
    expect(otpSms).toMatchObject({ channel: 'sms', phone: '+919922222222' });
  });

  it("a worker cannot respond to another worker's offer", async () => {
    const f = setup();
    const b = makeBooking();
    f.store.bookings.set(b.id, b);
    const w = makeWorker();
    f.store.workers.set(w.userId, w);
    await f.service.runMatching(b.id);
    const [offer] = await f.repo.offersForBooking(b.id);

    await expect(
      f.service.respondOffer(workerCtx('someone-else'), offer!.id, 'accept'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('decline (normal mode) advances to the next candidate', async () => {
    const f = setup();
    const b = makeBooking();
    f.store.bookings.set(b.id, b);
    const w1 = makeWorker({ distanceKm: 1 });
    const w2 = makeWorker({ distanceKm: 5 });
    f.store.workers.set(w1.userId, w1);
    f.store.workers.set(w2.userId, w2);

    await f.service.runMatching(b.id);
    const [first] = await f.repo.offersForBooking(b.id);
    expect(first?.workerId).toBe(w1.userId);

    await f.service.respondOffer(workerCtx(first!.workerId), first!.id, 'decline');

    const offers = await f.repo.offersForBooking(b.id);
    expect(offers).toHaveLength(2);
    const active = offers.find((o) => o.response === null);
    expect(active?.workerId).toBe(w2.userId);
    expect(f.store.bookings.get(b.id)?.status).toBe('offered');
  });

  it('50 concurrent accepts on an emergency booking: exactly one wins, the rest are superseded', async () => {
    for (let iteration = 0; iteration < 50; iteration += 1) {
      const f = setup();
      const b = makeBooking({ urgency: 'emergency' });
      f.store.bookings.set(b.id, b);
      const workers = Array.from({ length: MAX_EMERGENCY_OFFERS }, () => makeWorker());
      for (const w of workers) f.store.workers.set(w.userId, w);
      f.store.customers.set(b.customerId, { phone: '+919922222222', locale: 'en' });

      await f.service.runMatching(b.id);
      const offers = await f.repo.offersForBooking(b.id);
      expect(offers).toHaveLength(MAX_EMERGENCY_OFFERS);

      const results = await Promise.allSettled(
        offers.map((offer) =>
          f.service.respondOffer(workerCtx(offer.workerId), offer.id, 'accept'),
        ),
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(MAX_EMERGENCY_OFFERS - 1);
      for (const r of rejected) {
        expect(r.reason).toMatchObject({ code: 'OFFER_UNAVAILABLE' });
      }

      const finalOffers = await f.repo.offersForBooking(b.id);
      expect(finalOffers.filter((o) => o.response === 'accepted')).toHaveLength(1);
      expect(finalOffers.filter((o) => o.response === 'superseded')).toHaveLength(
        MAX_EMERGENCY_OFFERS - 1,
      );
      expect(f.store.bookings.get(b.id)?.status).toBe('accepted');
    }
  });
});

describe('dispatch: manualAssign', () => {
  it('creates an offer for the chosen worker and moves an unassigned booking to offered', async () => {
    const f = setup();
    const b = makeBooking({ status: 'unassigned', societyId: SOCIETY_ID });
    f.store.bookings.set(b.id, b);
    const w = makeWorker();
    f.store.workers.set(w.userId, w);

    const result = await f.service.manualAssign(adminCtx(), b.id, w.userId);
    expect(result.offerId).toBeDefined();

    expect(f.store.bookings.get(b.id)?.status).toBe('offered');
    const offer = await f.repo.getOffer(result.offerId);
    expect(offer?.workerId).toBe(w.userId);
    expect(f.scheduler.scheduled.some((s) => s.offerId === result.offerId)).toBe(true);
  });

  it('rejects a non-admin actor', async () => {
    const f = setup();
    const b = makeBooking({ status: 'unassigned', societyId: SOCIETY_ID });
    f.store.bookings.set(b.id, b);
    const w = makeWorker();
    f.store.workers.set(w.userId, w);

    await expect(f.service.manualAssign(workerCtx(w.userId), b.id, w.userId)).rejects.toMatchObject(
      {
        code: 'FORBIDDEN',
      },
    );
  });

  it("rejects an admin outside the booking's society", async () => {
    const f = setup();
    const b = makeBooking({ status: 'unassigned', societyId: SOCIETY_ID });
    f.store.bookings.set(b.id, b);
    const w = makeWorker();
    f.store.workers.set(w.userId, w);

    await expect(
      f.service.manualAssign(adminCtx('other-society'), b.id, w.userId),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
