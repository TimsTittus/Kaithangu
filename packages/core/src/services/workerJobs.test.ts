import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { workerCheckCode } from '../booking/codes';
import type { RequestContext, UserActor } from '../context';
import { hashOtp, OTP_MAX_ATTEMPTS } from '../otp';
import {
  MemoryDispatchStore,
  MemoryNotifier,
  MemoryPostCompletionQueue,
  MemoryWorkerJobRepo,
  type InternalBooking,
  type InternalOffer,
  type InternalWorker,
} from './testing';
import { createWorkerJobService, type WorkerJobService } from './workerJobs';

const SECRET = 'test-only-code-secret-0123456789abcdef';
const START_OTP = '1234';
const COMPLETE_OTP = '5678';
const NOW = new Date('2026-09-10T05:00:00Z');
const WORKER_ID = 'worker-1';
const SOCIETY_ID = 'society-1';

function makeBooking(overrides: Partial<InternalBooking> = {}): InternalBooking {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    status: 'accepted',
    tradeCode: 'plumber',
    urgency: 'normal',
    societyId: SOCIETY_ID,
    stateCode: 'KL',
    customerId: 'customer-1',
    workerId: WORKER_ID,
    location: { lng: 76.28, lat: 9.98 },
    scheduledFor: null,
    completedAt: null,
    addressText: '1 Test Street',
    customerName: 'Test Customer',
    wagePaise: 30_000,
    qrKeyVersion: 1,
    startOtpHash: hashOtp(START_OTP, SECRET),
    completeOtpHash: hashOtp(COMPLETE_OTP, SECRET),
    startOtpAttempts: 0,
    completeOtpAttempts: 0,
    otpLockedAt: null,
    ...overrides,
  };
}

function makeWorkerEntry(): InternalWorker {
  return {
    userId: WORKER_ID,
    name: 'Test Worker',
    phone: '+919900000000',
    locale: 'en',
    hasSmartphone: true,
    societyId: SOCIETY_ID,
    available: false,
    candidate: {
      workerId: WORKER_ID,
      distanceKm: 1,
      serviceRadiusKm: 8,
      skillLevel: 2,
      ratingSum: 0,
      ratingCount: 0,
      earnings30dPaise: 0,
      lastJobCompletedAt: null,
    },
  };
}

interface Fixture {
  store: MemoryDispatchStore;
  jobs: MemoryWorkerJobRepo;
  postCompletion: MemoryPostCompletionQueue;
  notifier: MemoryNotifier;
  service: WorkerJobService;
}

function setup(): Fixture {
  const store = new MemoryDispatchStore();
  store.workers.set(WORKER_ID, makeWorkerEntry());
  const jobs = new MemoryWorkerJobRepo(store);
  const postCompletion = new MemoryPostCompletionQueue();
  const notifier = new MemoryNotifier();
  const service = createWorkerJobService({
    jobs,
    postCompletion,
    notifier,
    codeSecret: SECRET,
    now: () => NOW,
  });
  return { store, jobs, postCompletion, notifier, service };
}

function ctx(userId: string = WORKER_ID): RequestContext {
  const actor: UserActor = { userId, role: 'worker' };
  return { actor, requestId: 'req-1', locale: 'en' };
}

describe('workerJobs: setAvailable', () => {
  it('flips the worker.available flag', async () => {
    const f = setup();
    await f.service.setAvailable(ctx(), true);
    expect(f.store.workers.get(WORKER_ID)?.available).toBe(true);
  });
});

describe('workerJobs: myOffer', () => {
  it('returns null when there is no live offer', async () => {
    const f = setup();
    expect(await f.service.myOffer(ctx())).toBeNull();
  });

  it("returns the worker's current pending offer, with area/distance/pay", async () => {
    const f = setup();
    const b = makeBooking({ status: 'offered' });
    f.store.bookings.set(b.id, b);
    const offer: InternalOffer = {
      id: randomUUID(),
      bookingId: b.id,
      workerId: WORKER_ID,
      rank: 1,
      channel: 'app',
      response: null,
      offeredAt: NOW,
      expiresAt: new Date(NOW.getTime() + 45_000),
      score: 0.8,
      breakdown: { distanceKm: 3.4 },
      explanationKey: 'matching.why.proximity',
      explanationParams: {},
    };
    f.store.offers.set(offer.id, offer);

    const view = await f.service.myOffer(ctx());
    expect(view).toMatchObject({
      offerId: offer.id,
      bookingId: b.id,
      tradeCode: 'plumber',
      distanceKm: 3.4,
      wagePaise: 30_000,
    });
  });
});

describe('workerJobs: markEnRoute', () => {
  it('transitions accepted -> en_route for the assigned worker', async () => {
    const f = setup();
    const b = makeBooking({ status: 'accepted' });
    f.store.bookings.set(b.id, b);

    const view = await f.service.markEnRoute(ctx(), b.id);
    expect(view.status).toBe('en_route');
    expect(f.store.bookings.get(b.id)?.status).toBe('en_route');
  });

  it('a booking not assigned to this worker is NOT_FOUND, not FORBIDDEN', async () => {
    const f = setup();
    const b = makeBooking({ status: 'accepted', workerId: 'someone-else' });
    f.store.bookings.set(b.id, b);

    await expect(f.service.markEnRoute(ctx(), b.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects an invalid transition (e.g. from requested)', async () => {
    const f = setup();
    const b = makeBooking({ status: 'requested' });
    f.store.bookings.set(b.id, b);

    await expect(f.service.markEnRoute(ctx(), b.id)).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    });
  });
});

describe('workerJobs: startJob / completeJob OTPs', () => {
  let f: Fixture;
  let b: InternalBooking;

  beforeEach(() => {
    f = setup();
    b = makeBooking({ status: 'en_route' });
    f.store.bookings.set(b.id, b);
    f.store.lcsAdminsBySociety.set(SOCIETY_ID, [
      { userId: 'admin-1', phone: '+919911111111', locale: 'en' },
    ]);
  });

  it('the correct OTP transitions en_route -> in_progress', async () => {
    const view = await f.service.startJob(ctx(), b.id, START_OTP);
    expect(view.status).toBe('in_progress');
    // The check code shown to the worker matches the one derivable independently.
    expect(view.checkCode).toBe(
      workerCheckCode(SECRET, { bookingId: b.id, workerId: WORKER_ID, keyVersion: 1 }),
    );
  });

  it('the correct complete OTP transitions in_progress -> completed and enqueues post-completion work', async () => {
    f.store.bookings.set(b.id, { ...b, status: 'in_progress' });
    const view = await f.service.completeJob(ctx(), b.id, COMPLETE_OTP);
    expect(view.status).toBe('completed');
    expect(f.postCompletion.enqueued).toEqual([b.id]);
    expect(f.jobs.lastJobCompletedCalls).toHaveLength(1);
    expect(f.jobs.lastJobCompletedCalls[0]?.workerId).toBe(WORKER_ID);
  });

  it('a wrong OTP is rejected and counts an attempt', async () => {
    await expect(f.service.startJob(ctx(), b.id, '0000')).rejects.toMatchObject({
      code: 'OTP_INVALID',
      details: { attemptsRemaining: OTP_MAX_ATTEMPTS - 1 },
    });
    expect(f.store.bookings.get(b.id)?.startOtpAttempts).toBe(1);
  });

  it('5 wrong attempts lock the booking, notify the lcs_admin, and further attempts are OTP_LOCKED', async () => {
    for (let attempt = 1; attempt < OTP_MAX_ATTEMPTS; attempt += 1) {
      await expect(f.service.startJob(ctx(), b.id, '0000')).rejects.toMatchObject({
        code: 'OTP_INVALID',
      });
    }
    await expect(f.service.startJob(ctx(), b.id, '0000')).rejects.toMatchObject({
      code: 'OTP_ATTEMPTS_EXCEEDED',
    });
    expect(f.store.bookings.get(b.id)?.otpLockedAt).not.toBeNull();
    expect(f.notifier.sent.some((n) => n.kind === 'otp_locked')).toBe(true);

    // Even the correct OTP is refused once locked.
    await expect(f.service.startJob(ctx(), b.id, START_OTP)).rejects.toMatchObject({
      code: 'OTP_LOCKED',
    });
  });

  it('rejects a malformed OTP (not 4 digits) without touching the attempt counter', async () => {
    await expect(f.service.startJob(ctx(), b.id, '12')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(f.store.bookings.get(b.id)?.startOtpAttempts).toBe(0);
  });
});

describe('workerJobs: earnings', () => {
  it("lists the worker's completed bookings", async () => {
    const f = setup();
    const completed = makeBooking({ status: 'completed', completedAt: NOW, wagePaise: 45_000 });
    f.store.bookings.set(completed.id, completed);
    const stillActive = makeBooking({ status: 'in_progress' });
    f.store.bookings.set(stillActive.id, stillActive);

    const rows = await f.service.earnings(ctx());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ bookingId: completed.id, wagePaise: 45_000 });
  });
});
