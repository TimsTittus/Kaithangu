import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { RequestContext, UserActor } from '../context';
import { createAdminService, type AdminService } from './admin';
import {
  MemoryAdminRepo,
  MemoryDispatchRepo,
  MemoryDispatchStore,
  type InternalBooking,
  type InternalWorker,
} from './testing';

const SOCIETY_A = 'society-a';
const SOCIETY_B = 'society-b';
const NOW = new Date('2026-09-10T05:00:00Z');

function makeBooking(overrides: Partial<InternalBooking> = {}): InternalBooking {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    status: 'unassigned',
    tradeCode: 'plumber',
    urgency: 'normal',
    societyId: SOCIETY_A,
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

function makeWorker(societyId: string): InternalWorker {
  const userId = randomUUID();
  return {
    userId,
    name: 'Test Worker',
    phone: '+919900000000',
    locale: 'en',
    hasSmartphone: true,
    societyId,
    available: true,
    candidate: {
      workerId: userId,
      distanceKm: 2,
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
  admin: MemoryAdminRepo;
  service: AdminService;
}

function setup(): Fixture {
  const store = new MemoryDispatchStore();
  const admin = new MemoryAdminRepo(store);
  const dispatch = new MemoryDispatchRepo(store, SOCIETY_A);
  const service = createAdminService({ admin, dispatch, now: () => NOW });
  return { store, admin, service };
}

function lcsCtx(societyId: string = SOCIETY_A): RequestContext {
  const actor: UserActor = { userId: 'admin-1', role: 'lcs_admin', societyId, stateCode: 'KL' };
  return { actor, requestId: 'req-1', locale: 'en' };
}

function stateCtx(): RequestContext {
  const actor: UserActor = { userId: 'admin-2', role: 'state_admin', stateCode: 'KL' };
  return { actor, requestId: 'req-2', locale: 'en' };
}

describe('admin: listUnassigned', () => {
  it("lists only the lcs_admin's own society's unassigned bookings", async () => {
    const f = setup();
    const own = makeBooking({ societyId: SOCIETY_A });
    const other = makeBooking({ societyId: SOCIETY_B });
    const assigned = makeBooking({ societyId: SOCIETY_A, status: 'accepted' });
    f.store.bookings.set(own.id, own);
    f.store.bookings.set(other.id, other);
    f.store.bookings.set(assigned.id, assigned);

    const list = await f.service.listUnassigned(lcsCtx(SOCIETY_A));
    expect(list.map((b) => b.id)).toEqual([own.id]);
  });

  it('a state admin (no single society scope) is forbidden from this minimal screen', async () => {
    const f = setup();
    await expect(f.service.listUnassigned(stateCtx())).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('admin: candidatesFor', () => {
  it('ranks eligible candidates for an unassigned booking', async () => {
    const f = setup();
    const b = makeBooking({ societyId: SOCIETY_A });
    f.store.bookings.set(b.id, b);
    const near = makeWorker(SOCIETY_A);
    near.candidate.distanceKm = 1;
    const far = makeWorker(SOCIETY_A);
    far.candidate.distanceKm = 6;
    f.store.workers.set(near.userId, near);
    f.store.workers.set(far.userId, far);

    const result = await f.service.candidatesFor(lcsCtx(SOCIETY_A), b.id);
    expect(result.status).toBe('unassigned');
    expect(result.candidates.map((c) => c.candidate.workerId)).toEqual([near.userId, far.userId]);
  });

  it("rejects an lcs_admin outside the booking's society", async () => {
    const f = setup();
    const b = makeBooking({ societyId: SOCIETY_A });
    f.store.bookings.set(b.id, b);

    await expect(f.service.candidatesFor(lcsCtx(SOCIETY_B), b.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});

describe('admin: verifyWorker / suspendWorker', () => {
  it("verifies a worker within the admin's society", async () => {
    const f = setup();
    const w = makeWorker(SOCIETY_A);
    f.store.workers.set(w.userId, w);

    await f.service.verifyWorker(lcsCtx(SOCIETY_A), w.userId);
    expect(f.admin.statusByWorker.get(w.userId)).toBe('verified');
  });

  it("rejects verifying a worker outside the admin's society", async () => {
    const f = setup();
    const w = makeWorker(SOCIETY_B);
    f.store.workers.set(w.userId, w);

    await expect(f.service.verifyWorker(lcsCtx(SOCIETY_A), w.userId)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('a missing worker is NOT_FOUND', async () => {
    const f = setup();
    await expect(f.service.suspendWorker(lcsCtx(SOCIETY_A), randomUUID())).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
