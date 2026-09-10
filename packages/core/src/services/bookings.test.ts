import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ScopeFilter } from '../authz';
import type { BookingStatus } from '../booking/stateMachine';
import type { RequestContext, UserActor } from '../context';
import type { LngLat } from '../geo';
import {
  createBookingService,
  type BookingDraft,
  type BookingPricingInputs,
  type BookingRecord,
  type BookingRepo,
  type BookingTransition,
  type CreateBookingOutcome,
  type IdempotentBooking,
  type MatchJob,
  type SavedAddress,
} from './bookings';

// Fictional test rates (not real wage data).
const PRICING: BookingPricingInputs = {
  stateConfig: {
    welfarePct: '5.00',
    platformFeePct: '5.00',
    gstPctOnPlatformFee: '18.00',
    timezone: 'Asia/Kolkata',
    isPlaceholder: true,
  },
  rates: {
    wageFloorPerHourPaise: 12_000,
    minBillableMinutes: 60,
    visitChargePaise: 5_000,
    emergencySurchargePct: '25.00',
    isPlaceholder: false,
  },
};
const TEST_PINCODE = '999001';
const TEST_POINT: LngLat = { lng: 76.5, lat: 10.5 };
const SECRET = 'test-only-code-secret-0123456789abcdef';
const NOW = new Date('2026-09-10T03:30:00Z'); // 09:00 IST
const FIRST_SLOT = '2026-09-10T05:30:00.000Z'; // 11:00 IST

function matches(scope: ScopeFilter, record: BookingRecord): boolean {
  switch (scope.kind) {
    case 'all':
      return true;
    case 'state':
      return record.stateCode === scope.stateCode;
    case 'society':
      return record.societyId === scope.societyId;
    case 'institution':
      return record.institutionId === scope.institutionId;
    case 'own_customer':
      return record.customerId === scope.userId;
    case 'own_worker':
      return record.workerId === scope.userId;
  }
}

class MemoryBookingRepo implements BookingRepo {
  readonly records = new Map<string, BookingRecord>();
  readonly keys = new Map<string, { requestHash: string; bookingId: string }>();
  readonly transitions: BookingTransition[] = [];
  readonly addresses: SavedAddress[] = [];
  /** Forces the next create() outcome (simulates a concurrent claim). */
  forceOutcome: CreateBookingOutcome | undefined;
  /** Forces transition() to report a lost race. */
  loseRace = false;

  findIdempotent(key: string): Promise<IdempotentBooking | null> {
    const entry = this.keys.get(key);
    const record = entry ? this.records.get(entry.bookingId) : undefined;
    return Promise.resolve(entry && record ? { ...entry, status: record.status } : null);
  }

  create(input: {
    idempotencyKey: string;
    requestHash: string;
    draft: BookingDraft;
  }): Promise<CreateBookingOutcome> {
    if (this.forceOutcome) return Promise.resolve(this.forceOutcome);
    const id = randomUUID();
    const { draft } = input;
    this.records.set(id, {
      id,
      customerId: draft.customerId,
      institutionId: null,
      stateCode: draft.stateCode,
      societyId: null,
      workerId: null,
      tradeCode: draft.tradeCode,
      problemText: draft.problemText,
      urgency: draft.urgency,
      scheduledFor: draft.scheduledFor,
      addressText: draft.addressText,
      pincode: draft.pincode,
      status: 'requested',
      wagePaise: draft.wagePaise,
      surchargePaise: Number(draft.quote.surchargePaise),
      welfarePaise: draft.welfarePaise,
      platformFeePaise: draft.platformFeePaise,
      gstPaise: draft.gstPaise,
      totalPaise: draft.totalPaise,
      createdAt: NOW,
      events: [{ fromStatus: null, toStatus: 'requested', at: NOW }],
      worker: null,
    });
    this.keys.set(input.idempotencyKey, { requestHash: input.requestHash, bookingId: id });
    return Promise.resolve({ kind: 'created', id, status: 'requested' });
  }

  get(bookingId: string, scope: ScopeFilter): Promise<BookingRecord | null> {
    const record = this.records.get(bookingId);
    return Promise.resolve(record && matches(scope, record) ? structuredClone(record) : null);
  }

  list(scope: ScopeFilter, limit: number) {
    return Promise.resolve(
      [...this.records.values()].filter((record) => matches(scope, record)).slice(0, limit),
    );
  }

  transition(input: BookingTransition): Promise<boolean> {
    const record = this.records.get(input.bookingId);
    if (this.loseRace || !record || record.status !== input.from) return Promise.resolve(false);
    record.status = input.to;
    record.events.push({ fromStatus: input.from, toStatus: input.to, at: NOW });
    this.transitions.push(input);
    return Promise.resolve(true);
  }

  savedAddresses(userId: string, limit: number) {
    return Promise.resolve(this.addresses.filter((a) => a.id.startsWith(userId)).slice(0, limit));
  }

  /** Put an existing booking into a given state (as dispatch would). */
  set(bookingId: string, patch: Partial<BookingRecord>) {
    const record = this.records.get(bookingId);
    if (!record) throw new Error('no such booking');
    Object.assign(record, patch);
  }
}

let repo: MemoryBookingRepo;
let jobs: MatchJob[];
let consented: boolean;
let pricing: BookingPricingInputs | null;

function service() {
  return createBookingService({
    bookings: repo,
    pricing: { load: () => Promise.resolve(pricing) },
    places: {
      pincodeLocation: (pincode) => Promise.resolve(pincode === TEST_PINCODE ? TEST_POINT : null),
      nearestPincode: (point) => Promise.resolve(point.lat > 0 ? TEST_PINCODE : null),
    },
    consent: {
      assertConsented: () =>
        consented
          ? Promise.resolve()
          : Promise.reject(Object.assign(new Error('consent'), { code: 'CONSENT_REQUIRED' })),
    },
    jobs: {
      enqueue: (_queue, payload) => {
        jobs.push(payload);
        return Promise.resolve();
      },
    },
    defaultStateCode: 'KL',
    codeSecret: SECRET,
    now: () => NOW,
  });
}

function ctxFor(actor: UserActor): RequestContext {
  return { actor, requestId: 'req-1', locale: 'en' };
}

const alice = ctxFor({ userId: randomUUID(), role: 'customer', stateCode: 'KL' });
const bob = ctxFor({ userId: randomUUID(), role: 'customer' });
const workerCtx = ctxFor({ userId: randomUUID(), role: 'worker', societyId: randomUUID() });
const KEY = 'key-0123456789abcdef';

const booking = (overrides: Record<string, unknown> = {}) => ({
  tradeCode: 'plumber',
  pincode: TEST_PINCODE,
  problemText: 'Kitchen tap is leaking',
  addressText: 'Test House, Test Street',
  ...overrides,
});

beforeEach(() => {
  repo = new MemoryBookingRepo();
  jobs = [];
  consented = true;
  pricing = PRICING;
});

describe('quote', () => {
  it('prices a normal job with the trade minimum as the default length', async () => {
    const quote = await service().quote(alice, { tradeCode: 'plumber', pincode: TEST_PINCODE });
    expect(quote).toMatchObject({
      tradeCode: 'plumber',
      urgency: 'normal',
      stateCode: 'KL',
      pincode: TEST_PINCODE,
      location: TEST_POINT,
      estimatedMinutes: 60,
      billableMinutes: 60,
      wagePaise: 17_000,
      surchargePaise: 0,
      welfarePaise: 850,
      platformFeePaise: 850,
      gstPaise: 0,
      totalPaise: 18_700,
      breakdownKeys: ['pricing.wage', 'pricing.welfare', 'pricing.platform_fee'],
      isPlaceholder: true,
    });
  });

  it('adds the emergency surcharge to the wage and honours estimatedMinutes', async () => {
    const quote = await service().quote(alice, {
      tradeCode: 'plumber',
      pincode: TEST_PINCODE,
      urgency: 'emergency',
      estimatedMinutes: 90,
    });
    // 90 min: ceil(90 × 12000 / 60) + 5000 = 23000; +25 % = 28750.
    expect(quote).toMatchObject({ billableMinutes: 90, surchargePaise: 5_750, wagePaise: 28_750 });
    expect(quote.totalPaise).toBe(quote.wagePaise + quote.welfarePaise + quote.platformFeePaise);
    expect(quote.breakdownKeys).toContain('pricing.emergency_surcharge');
  });

  it('uses the GPS point, finding the nearest pincode when none is given', async () => {
    const point = { lat: 10.1, lng: 76.2 };
    await expect(service().quote(alice, { tradeCode: 'plumber', ...point })).resolves.toMatchObject(
      { pincode: TEST_PINCODE, location: point },
    );
    await expect(
      service().quote(alice, { tradeCode: 'plumber', ...point, pincode: '682001' }),
    ).resolves.toMatchObject({ pincode: '682001', location: point });
    await expect(
      service().quote(alice, { tradeCode: 'plumber', lat: -10, lng: 76 }),
    ).rejects.toMatchObject({ code: 'PINCODE_UNKNOWN' });
  });

  it('prices with the default state when the customer has none', async () => {
    await expect(
      service().quote(bob, { tradeCode: 'plumber', pincode: TEST_PINCODE }),
    ).resolves.toMatchObject({ stateCode: 'KL' });
  });

  it('rejects unknown pincodes, missing locations and bad input', async () => {
    const svc = service();
    await expect(
      svc.quote(alice, { tradeCode: 'plumber', pincode: '110001' }),
    ).rejects.toMatchObject({ code: 'PINCODE_UNKNOWN' });
    for (const input of [
      { tradeCode: 'plumber' },
      { tradeCode: 'plumber', lat: 10 },
      { tradeCode: 'plumber', pincode: '012345' },
      { tradeCode: 'astronaut', pincode: TEST_PINCODE },
      { tradeCode: 'plumber', pincode: TEST_PINCODE, estimatedMinutes: 0 },
      { tradeCode: 'plumber', pincode: TEST_PINCODE, urgency: 'soon' },
    ]) {
      await expect(svc.quote(alice, input), JSON.stringify(input)).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      });
    }
  });

  it('is NOT_SERVICEABLE without rates for the state and trade', async () => {
    pricing = null;
    await expect(
      service().quote(alice, { tradeCode: 'plumber', pincode: TEST_PINCODE }),
    ).rejects.toMatchObject({ code: 'NOT_SERVICEABLE', httpStatus: 422 });
  });

  it('is for signed-in customers only', async () => {
    await expect(service().quote(null, {})).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(service().quote(workerCtx, {})).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('bookingOptions', () => {
  it('offers bookable slots and the customer’s saved addresses', async () => {
    const actor = alice.actor as UserActor;
    repo.addresses.push({
      id: `${actor.userId}-a1`,
      label: null,
      addressText: 'Test House',
      pincode: TEST_PINCODE,
      location: TEST_POINT,
    });
    const options = await service().bookingOptions(alice, 'electrician');
    expect(options.tradeCode).toBe('electrician');
    expect(options.timeZone).toBe('Asia/Kolkata');
    expect(options.slots[0]).toBe(FIRST_SLOT);
    expect(options.slots).toHaveLength(40);
    expect(options.savedAddresses).toHaveLength(1);
    await expect(service().bookingOptions(alice, 'astronaut')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });
});

describe('createBooking', () => {
  it('creates a requested booking with the server-side price and enqueues matching', async () => {
    const created = await service().createBooking(alice, booking(), KEY);
    expect(created).toMatchObject({ status: 'requested', replayed: false });
    const record = repo.records.get(created.id);
    expect(record).toMatchObject({
      customerId: (alice.actor as UserActor).userId,
      stateCode: 'KL',
      totalPaise: 18_700,
      problemText: 'Kitchen tap is leaking',
      scheduledFor: null,
    });
    expect(jobs).toEqual([{ bookingId: created.id, urgency: 'normal', scheduledFor: null }]);
  });

  it('is idempotent: the same key and body return the first booking', async () => {
    const svc = service();
    const first = await svc.createBooking(alice, booking(), KEY);
    const again = await svc.createBooking(alice, booking(), KEY);
    expect(again).toEqual({ id: first.id, status: 'requested', replayed: true });
    expect(repo.records.size).toBe(1);
    // Still 'requested', so matching is re-enqueued (the consumer is idempotent).
    expect(jobs.map((job) => job.bookingId)).toEqual([first.id, first.id]);
  });

  it('does not re-enqueue a replayed booking that has moved on', async () => {
    const svc = service();
    const first = await svc.createBooking(alice, booking(), KEY);
    repo.set(first.id, { status: 'matching' });
    await expect(svc.createBooking(alice, booking(), KEY)).resolves.toMatchObject({
      status: 'matching',
      replayed: true,
    });
    expect(jobs).toHaveLength(1);
  });

  it('refuses the same key with a different body (CONFLICT)', async () => {
    const svc = service();
    await svc.createBooking(alice, booking(), KEY);
    await expect(
      svc.createBooking(alice, booking({ problemText: 'Something else entirely' }), KEY),
    ).rejects.toMatchObject({ code: 'CONFLICT', httpStatus: 409 });
  });

  it('scopes idempotency keys per customer', async () => {
    const svc = service();
    const a = await svc.createBooking(alice, booking(), KEY);
    const b = await svc.createBooking(bob, booking(), KEY);
    expect(b.id).not.toBe(a.id);
    expect(repo.records.size).toBe(2);
  });

  it('maps a concurrent claim of the key to a replay or a conflict', async () => {
    const svc = service();
    repo.forceOutcome = { kind: 'replayed', id: 'b-1', status: 'requested' };
    await expect(svc.createBooking(alice, booking(), KEY)).resolves.toEqual({
      id: 'b-1',
      status: 'requested',
      replayed: true,
    });
    repo.forceOutcome = { kind: 'conflict' };
    await expect(svc.createBooking(alice, booking(), `${KEY}-2`)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('requires a well-formed idempotency key', async () => {
    for (const key of [null, undefined, '', 'short', 'x'.repeat(129), 'has spaces in it!!']) {
      await expect(service().createBooking(alice, booking(), key)).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      });
    }
  });

  it('validates the body', async () => {
    for (const body of [
      booking({ problemText: 'no' }),
      booking({ addressText: '' }),
      booking({ pincode: undefined }),
      booking({ urgency: 'emergency', scheduledFor: FIRST_SLOT }),
      booking({ scheduledFor: 'tomorrow' }),
      booking({ expectedTotalPaise: -1 }),
    ]) {
      await expect(service().createBooking(alice, body, KEY)).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      });
    }
    expect(repo.records.size).toBe(0);
  });

  it('accepts only offered slots for scheduled bookings', async () => {
    const created = await service().createBooking(
      alice,
      booking({ scheduledFor: FIRST_SLOT }),
      KEY,
    );
    expect(repo.records.get(created.id)?.scheduledFor?.toISOString()).toBe(FIRST_SLOT);
    expect(jobs[0]).toMatchObject({ scheduledFor: FIRST_SLOT });
    await expect(
      service().createBooking(alice, booking({ scheduledFor: '2026-09-10T06:00:00Z' }), `${KEY}-x`),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('refuses a booking when the price changed since the quote', async () => {
    await expect(
      service().createBooking(alice, booking({ expectedTotalPaise: 18_000 }), KEY),
    ).rejects.toMatchObject({ code: 'PRICE_CHANGED', details: { totalPaise: 18_700 } });
    await expect(
      service().createBooking(alice, booking({ expectedTotalPaise: 18_700 }), KEY),
    ).resolves.toMatchObject({ status: 'requested' });
  });

  it('requires consent and the customer role', async () => {
    consented = false;
    await expect(service().createBooking(alice, booking(), KEY)).rejects.toMatchObject({
      code: 'CONSENT_REQUIRED',
    });
    await expect(service().createBooking(null, booking(), KEY)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await expect(service().createBooking(workerCtx, booking(), KEY)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(repo.records.size).toBe(0);
  });
});

describe('getBooking / listBookings (ownership)', () => {
  it('shows customers their own bookings only; others get NOT_FOUND', async () => {
    const svc = service();
    const { id } = await svc.createBooking(alice, booking(), KEY);
    const view = await svc.getBooking(alice, id);
    expect(view).toMatchObject({
      id,
      status: 'requested',
      worker: null,
      otps: null,
      canCancel: true,
      price: { totalPaise: 18_700, surchargePaise: 0 },
    });
    expect(view.events).toEqual([
      { fromStatus: null, toStatus: 'requested', at: NOW.toISOString() },
    ]);
    await expect(svc.getBooking(bob, id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(svc.getBooking(alice, 'not-a-uuid')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(svc.getBooking(alice, randomUUID())).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(svc.getBooking(null, id)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });

    expect((await svc.listBookings(alice)).map((b) => b.id)).toEqual([id]);
    expect(await svc.listBookings(bob)).toEqual([]);
  });

  it('shows the worker card and job codes once a worker has accepted', async () => {
    const svc = service();
    const { id } = await svc.createBooking(alice, booking(), KEY);
    const workerId = randomUUID();
    repo.set(id, {
      status: 'accepted',
      workerId,
      worker: {
        id: workerId,
        name: 'Demo Worker',
        societyName: 'Demo Society',
        ratingSum: 14,
        ratingCount: 3,
        qrKeyVersion: 1,
      },
    });
    const view = await svc.getBooking(alice, id);
    expect(view.worker).toMatchObject({
      name: 'Demo Worker',
      societyName: 'Demo Society',
      tradeCode: 'plumber',
      rating: 4.7,
      ratingCount: 3,
    });
    expect(view.worker?.checkCode).toMatch(/^\d{6}$/);
    expect(view.otps?.start).toMatch(/^\d{4}$/);
    expect(view.otps?.complete).toMatch(/^\d{4}$/);

    repo.set(id, { status: 'in_progress' });
    const working = await svc.getBooking(alice, id);
    expect(working.otps).toEqual({ start: null, complete: view.otps?.complete });
    expect(working.canCancel).toBe(false);

    repo.set(id, { status: 'completed' });
    expect((await svc.getBooking(alice, id)).otps).toBeNull();
  });

  it('never shows job codes to anyone but the customer', async () => {
    const svc = service();
    const { id } = await svc.createBooking(alice, booking(), KEY);
    const workerId = randomUUID();
    repo.set(id, {
      status: 'accepted',
      workerId,
      worker: {
        id: workerId,
        name: null,
        societyName: 'S',
        ratingSum: 0,
        ratingCount: 0,
        qrKeyVersion: 1,
      },
    });
    const national = ctxFor({ userId: randomUUID(), role: 'national_admin' });
    const view = await svc.getBooking(national, id);
    expect(view.otps).toBeNull();
    expect(view.worker?.rating).toBeNull();
    expect(view.canCancel).toBe(true);

    const assigned = ctxFor({ userId: workerId, role: 'worker' });
    const asWorker = await svc.getBooking(assigned, id);
    expect(asWorker.otps).toBeNull();
    expect(asWorker.canCancel).toBe(false);
  });
});

describe('cancelBooking (state transitions)', () => {
  it.each<BookingStatus>([
    'requested',
    'matching',
    'offered',
    'unassigned',
    'accepted',
    'en_route',
  ])('cancels from %s and records the transition', async (from) => {
    const svc = service();
    const { id } = await svc.createBooking(alice, booking(), KEY);
    repo.set(id, { status: from });
    const view = await svc.cancelBooking(alice, id, { reason: 'Not needed' });
    expect(view.status).toBe('cancelled');
    expect(view.canCancel).toBe(false);
    expect(repo.transitions).toEqual([
      {
        bookingId: id,
        from,
        to: 'cancelled',
        actorUserId: (alice.actor as UserActor).userId,
        meta: { reason: 'Not needed' },
        cancelledReason: 'Not needed',
      },
    ]);
  });

  it.each<BookingStatus>(['in_progress', 'completed', 'cancelled', 'disputed', 'resolved'])(
    'refuses to cancel from %s (INVALID_TRANSITION)',
    async (from) => {
      const svc = service();
      const { id } = await svc.createBooking(alice, booking(), KEY);
      repo.set(id, { status: from });
      await expect(svc.cancelBooking(alice, id, {})).rejects.toMatchObject({
        code: 'INVALID_TRANSITION',
      });
      expect(repo.transitions).toEqual([]);
    },
  );

  it('works without a body and reports a lost race as CONFLICT', async () => {
    const svc = service();
    const { id } = await svc.createBooking(alice, booking(), KEY);
    repo.loseRace = true;
    await expect(svc.cancelBooking(alice, id, undefined)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    repo.loseRace = false;
    await expect(svc.cancelBooking(alice, id, undefined)).resolves.toMatchObject({
      status: 'cancelled',
    });
    expect(repo.transitions[0]).toMatchObject({ meta: {}, cancelledReason: null });
  });

  it('lets only the owner (or a scoped admin) cancel', async () => {
    const svc = service();
    const { id } = await svc.createBooking(alice, booking(), KEY);
    await expect(svc.cancelBooking(bob, id, {})).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(svc.cancelBooking(workerCtx, id, {})).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(svc.cancelBooking(alice, id, { reason: 'x'.repeat(201) })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    const stateAdmin = ctxFor({ userId: randomUUID(), role: 'state_admin', stateCode: 'KL' });
    await expect(svc.cancelBooking(stateAdmin, id, {})).resolves.toMatchObject({
      status: 'cancelled',
    });
  });
});
