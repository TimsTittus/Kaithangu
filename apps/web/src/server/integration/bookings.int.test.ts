/**
 * Booking API integration (Phase 5): the real /api/v1 route handlers against
 * the test database — customer ownership, idempotency, cancel transitions,
 * the PostGIS nearest-pincode lookup and the STT upload limits.
 */
import { deriveJobOtp } from '@kaithangu/core';
import { bookingEvents, bookings, idempotencyKeys } from '@kaithangu/db/schema';
import { asc, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as cancelRoute } from '@/app/api/v1/bookings/[id]/cancel/route';
import { GET as getRoute } from '@/app/api/v1/bookings/[id]/route';
import { GET as listRoute, POST as createRoute } from '@/app/api/v1/bookings/route';
import { POST as quoteRoute } from '@/app/api/v1/quotes/route';
import { POST as sttRoute } from '@/app/api/v1/stt/route';
import { closeDatastores } from '@/lib/datastores';
import {
  createAuthFixture,
  deleteAuthFixture,
  ensureTestPincode,
  openTestDb,
  prepareTestDatabase,
  sessionCookie,
  type AuthFixture,
  type FixtureUser,
} from '@/test/fixtures';

let fixture: AuthFixture;
let testDb: ReturnType<typeof openTestDb>;
let pincode: string;

beforeAll(async () => {
  testDb = openTestDb(await prepareTestDatabase());
  fixture = await createAuthFixture(testDb.db, { consented: true });
  pincode = await ensureTestPincode(testDb.db);
});

afterAll(async () => {
  if (fixture) await deleteAuthFixture(testDb.db, fixture);
  await testDb?.client.end({ timeout: 5 });
  await closeDatastores();
});

interface ApiResponse {
  status: number;
  body: { data?: unknown; error?: { code: string; messageKey: string; requestId: string } };
}

interface SendOptions {
  as: FixtureUser | null;
  method?: 'GET' | 'POST';
  body?: BodyInit;
  headers?: Record<string, string>;
}

async function send(
  path: string,
  { as, method = 'GET', body, headers = {} }: SendOptions,
  handler: (request: NextRequest) => Promise<Response>,
): Promise<ApiResponse> {
  const all: Record<string, string> = { ...headers };
  if (as !== null) all.cookie = await sessionCookie(as);
  const init: ConstructorParameters<typeof NextRequest>[1] = { method, headers: all };
  if (body !== undefined) init.body = body;
  const response = await handler(new NextRequest(`http://localhost${path}`, init));
  return { status: response.status, body: (await response.json()) as ApiResponse['body'] };
}

const json = (as: FixtureUser | null, body: unknown, headers: Record<string, string> = {}) => ({
  as,
  method: 'POST' as const,
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', ...headers },
});

const quote = (as: FixtureUser | null, body: unknown) =>
  send('/api/v1/quotes', json(as, body), (r) => quoteRoute(r));

const create = (as: FixtureUser | null, body: unknown, key?: string) =>
  send(
    '/api/v1/bookings',
    json(as, body, key === undefined ? {} : { 'idempotency-key': key }),
    (r) => createRoute(r),
  );

const get = (as: FixtureUser | null, id: string) =>
  send(`/api/v1/bookings/${id}`, { as }, (r) => getRoute(r, { params: Promise.resolve({ id }) }));

const cancel = (as: FixtureUser | null, id: string) =>
  send(`/api/v1/bookings/${id}/cancel`, json(as, {}), (r) =>
    cancelRoute(r, { params: Promise.resolve({ id }) }),
  );

const stt = (as: FixtureUser | null, body: Uint8Array, type: string) =>
  send(
    '/api/v1/stt',
    { as, method: 'POST', body: body.slice(), headers: { 'content-type': type } },
    (r) => sttRoute(r),
  );

let keyCounter = 0;
const newKey = () => `int-test-key-${Date.now()}-${(keyCounter += 1)}`;

const bookingBody = (overrides: Record<string, unknown> = {}) => ({
  tradeCode: 'plumber',
  pincode,
  problemText: 'Kitchen tap is leaking (integration test)',
  addressText: 'Test House (Demo)',
  ...overrides,
});

describe('POST /api/v1/quotes', () => {
  it('prices from the seeded state rates; parts add up to the total', async () => {
    const response = await quote(fixture.users.customer, { tradeCode: 'plumber', pincode });
    expect(response.status).toBe(200);
    const data = response.body.data as Record<string, number | string>;
    expect(data).toMatchObject({ tradeCode: 'plumber', stateCode: 'KL', pincode, gstPaise: 0 });
    expect(data.totalPaise).toBe(
      Number(data.wagePaise) + Number(data.welfarePaise) + Number(data.platformFeePaise),
    );
  });

  it('finds the nearest pincode for a GPS point (PostGIS)', async () => {
    const response = await quote(fixture.users.customer, {
      tradeCode: 'plumber',
      lat: 0.01,
      lng: 0.01,
    });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ pincode, location: { lat: 0.01, lng: 0.01 } });
  });

  it('maps errors to status codes', async () => {
    expect(
      (await quote(fixture.users.customer, { tradeCode: 'plumber', pincode: '110001' })).body.error,
    ).toMatchObject({ code: 'PINCODE_UNKNOWN' });
    expect((await quote(fixture.users.customer, { tradeCode: 'plumber' })).status).toBe(400);
    expect((await quote(null, { tradeCode: 'plumber', pincode })).status).toBe(401);
    expect((await quote(fixture.users.worker, { tradeCode: 'plumber', pincode })).status).toBe(403);
  });
});

describe('POST /api/v1/bookings (idempotency)', () => {
  it('creates once per key and replays the same booking', async () => {
    const key = newKey();
    const first = await create(fixture.users.customer, bookingBody(), key);
    expect(first.status).toBe(201);
    const { id } = first.body.data as { id: string };

    const replay = await create(fixture.users.customer, bookingBody(), key);
    expect(replay.status).toBe(200);
    expect(replay.body.data).toMatchObject({ id, replayed: true });

    const conflict = await create(
      fixture.users.customer,
      bookingBody({ problemText: 'A different problem entirely' }),
      key,
    );
    expect(conflict.status).toBe(409);

    const rows = await testDb.db.select().from(bookings).where(eq(bookings.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: 'requested',
      source: 'pwa',
      customerId: fixture.users.customer.id,
      pincode,
    });
    const events = await testDb.db
      .select()
      .from(bookingEvents)
      .where(eq(bookingEvents.bookingId, id));
    expect(events).toMatchObject([{ fromStatus: null, toStatus: 'requested' }]);
    const [stored] = await testDb.db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, `booking.create:${fixture.users.customer.id}:${key}`));
    expect(stored?.response).toMatchObject({ bookingId: id });
  });

  it('requires the Idempotency-Key header', async () => {
    const response = await create(fixture.users.customer, bookingBody());
    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe('VALIDATION_FAILED');
  });
});

describe('GET /api/v1/bookings[/:id] (ownership)', () => {
  let id: string;

  beforeAll(async () => {
    const created = await create(fixture.users.customer, bookingBody(), newKey());
    id = (created.body.data as { id: string }).id;
  });

  it('shows the booking to its customer and lists it', async () => {
    const response = await get(fixture.users.customer, id);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id, status: 'requested', canCancel: true });
    const list = await send('/api/v1/bookings', { as: fixture.users.customer }, (r) =>
      listRoute(r),
    );
    expect((list.body.data as { id: string }[]).map((b) => b.id)).toContain(id);
  });

  it('hides it from users outside its scope (404)', async () => {
    for (const user of [fixture.users.worker, fixture.users.lcsA, fixture.users.stateTN]) {
      const response = await get(user, id);
      expect(response.status, user.role).toBe(404);
    }
    expect((await get(fixture.users.national, id)).status).toBe(200);
    expect((await get(null, id)).status).toBe(401);
  });

  it('shows the worker card and derived job codes after acceptance', async () => {
    await testDb.db
      .update(bookings)
      .set({ status: 'accepted', workerId: fixture.workerIds.a })
      .where(eq(bookings.id, id));
    const response = await get(fixture.users.customer, id);
    const data = response.body.data as {
      worker: { societyName: string; checkCode: string };
      otps: { start: string; complete: string };
    };
    expect(data.worker).toMatchObject({ societyName: 'Test Society A (Demo)' });
    expect(data.worker.checkCode).toMatch(/^\d{6}$/);
    expect(data.otps.start).toBe(deriveJobOtp(process.env.OTP_PEPPER ?? '', id, 'start'));
    expect(data.otps.complete).toMatch(/^\d{4}$/);
  });
});

describe('POST /api/v1/bookings/:id/cancel', () => {
  it('cancels once, records the event, then refuses', async () => {
    const created = await create(fixture.users.customer, bookingBody(), newKey());
    const { id } = created.body.data as { id: string };

    expect((await cancel(fixture.users.worker, id)).status).toBe(403);
    const response = await cancel(fixture.users.customer, id);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: 'cancelled', canCancel: false });

    const again = await cancel(fixture.users.customer, id);
    expect(again.status).toBe(409);
    expect(again.body.error?.code).toBe('INVALID_TRANSITION');

    const events = await testDb.db
      .select({ from: bookingEvents.fromStatus, to: bookingEvents.toStatus })
      .from(bookingEvents)
      .where(eq(bookingEvents.bookingId, id))
      .orderBy(asc(bookingEvents.id));
    expect(events).toEqual([
      { from: null, to: 'requested' },
      { from: 'requested', to: 'cancelled' },
    ]);
  });
});

describe('POST /api/v1/stt', () => {
  it('transcribes a small recording with the mock adapter', async () => {
    const response = await stt(
      fixture.users.customer,
      new Uint8Array([1, 2, 3]),
      'audio/webm;codecs=opus',
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ transcript: 'mock transcript (3 bytes)' });
  });

  it('refuses anonymous users, other formats and more than 1 MB', async () => {
    expect((await stt(null, new Uint8Array([1]), 'audio/webm')).status).toBe(401);
    expect((await stt(fixture.users.customer, new Uint8Array([1]), 'audio/wav')).status).toBe(415);
    const tooBig = await stt(fixture.users.customer, new Uint8Array(1_048_577), 'audio/ogg');
    expect(tooBig.status).toBe(413);
    expect(tooBig.body.error?.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
