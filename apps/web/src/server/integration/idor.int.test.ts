/**
 * IDOR / tenancy suite (Phase 4): the admin worker API only ever returns rows
 * inside the caller's scope, whatever ids or filters the caller sends.
 * Runs the real route handlers against the test database.
 */
import { SESSION_COOKIE } from '@kaithangu/core';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as getWorkerRoute } from '@/app/api/v1/admin/workers/[id]/route';
import { GET as listWorkersRoute } from '@/app/api/v1/admin/workers/route';
import { GET as meRoute } from '@/app/api/v1/me/route';
import { closeDatastores } from '@/lib/datastores';
import {
  createAuthFixture,
  deleteAuthFixture,
  openTestDb,
  prepareTestDatabase,
  sessionCookie,
  type AuthFixture,
  type FixtureUser,
} from '@/test/fixtures';

let fixture: AuthFixture;
let testDb: ReturnType<typeof openTestDb>;

beforeAll(async () => {
  testDb = openTestDb(await prepareTestDatabase());
  fixture = await createAuthFixture(testDb.db, { consented: true });
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

async function send(
  path: string,
  as: FixtureUser | string | null,
  handler: (request: NextRequest) => Promise<Response>,
): Promise<ApiResponse> {
  const headers: Record<string, string> = {};
  if (typeof as === 'string') headers.cookie = as;
  else if (as !== null) headers.cookie = await sessionCookie(as);
  const response = await handler(new NextRequest(`http://localhost${path}`, { headers }));
  return { status: response.status, body: (await response.json()) as ApiResponse['body'] };
}

const list = (as: FixtureUser | string | null, query = '') =>
  send(`/api/v1/admin/workers?limit=100${query}`, as, (request) => listWorkersRoute(request));

const get = (as: FixtureUser | string | null, id: string) =>
  send(`/api/v1/admin/workers/${id}`, as, (request) =>
    getWorkerRoute(request, { params: Promise.resolve({ id }) }),
  );

const ids = (response: ApiResponse) => (response.body.data as { id: string }[]).map((w) => w.id);

describe('lcs_admin of society A', () => {
  it('lists only society A workers', async () => {
    const response = await list(fixture.users.lcsA);
    expect(response.status).toBe(200);
    expect(ids(response)).toContain(fixture.workerIds.a);
    expect(ids(response)).not.toContain(fixture.workerIds.b);
    expect(ids(response)).not.toContain(fixture.workerIds.tn);
    const societies = new Set(
      (response.body.data as { societyId: string }[]).map((w) => w.societyId),
    );
    expect([...societies]).toEqual([fixture.societyIds.a]);
  });

  it('cannot widen the scope with a societyId filter', async () => {
    const response = await list(fixture.users.lcsA, `&societyId=${fixture.societyIds.b}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it('gets its own worker, with skills', async () => {
    const response = await get(fixture.users.lcsA, fixture.workerIds.a);
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: fixture.workerIds.a,
      societyId: fixture.societyIds.a,
      stateCode: 'KL',
      skills: [{ tradeCode: 'plumber', level: 2 }],
    });
  });

  it('cannot get a society B worker (404, existence not revealed)', async () => {
    for (const id of [fixture.workerIds.b, fixture.workerIds.tn]) {
      const response = await get(fixture.users.lcsA, id);
      expect(response.status).toBe(404);
      expect(response.body.error).toMatchObject({
        code: 'NOT_FOUND',
        messageKey: 'error.NOT_FOUND',
      });
      expect(response.body.data).toBeUndefined();
    }
  });

  it('society B admin is symmetric', async () => {
    expect(ids(await list(fixture.users.lcsB))).not.toContain(fixture.workerIds.a);
    expect((await get(fixture.users.lcsB, fixture.workerIds.a)).status).toBe(404);
    expect((await get(fixture.users.lcsB, fixture.workerIds.b)).status).toBe(200);
  });
});

describe('state_admin', () => {
  it('KL admin sees workers of every KL society but not TN', async () => {
    const response = await list(fixture.users.stateKL);
    expect(response.status).toBe(200);
    expect(ids(response)).toEqual(
      expect.arrayContaining([fixture.workerIds.a, fixture.workerIds.b]),
    );
    expect(ids(response)).not.toContain(fixture.workerIds.tn);
    const states = new Set((response.body.data as { stateCode: string }[]).map((w) => w.stateCode));
    expect([...states]).toEqual(['KL']);
    expect((await get(fixture.users.stateKL, fixture.workerIds.b)).status).toBe(200);
    expect((await get(fixture.users.stateKL, fixture.workerIds.tn)).status).toBe(404);
  });

  it('TN admin sees TN only', async () => {
    const response = await list(fixture.users.stateTN);
    expect(ids(response)).toContain(fixture.workerIds.tn);
    expect(ids(response)).not.toContain(fixture.workerIds.a);
    expect((await get(fixture.users.stateTN, fixture.workerIds.a)).status).toBe(404);
  });
});

describe('national_admin', () => {
  it('sees workers in every state', async () => {
    const response = await list(fixture.users.national);
    expect(ids(response)).toEqual(
      expect.arrayContaining([fixture.workerIds.a, fixture.workerIds.b, fixture.workerIds.tn]),
    );
    expect((await get(fixture.users.national, fixture.workerIds.tn)).status).toBe(200);
  });
});

describe('non-admin roles and bad sessions', () => {
  it.each(['worker', 'customer', 'institution'] as const)(
    '%s gets 403 from every /api/v1/admin route',
    async (key) => {
      const user = fixture.users[key];
      const listed = await list(user);
      expect(listed.status).toBe(403);
      expect(listed.body.error?.code).toBe('FORBIDDEN');
      expect((await get(user, fixture.workerIds.a)).status).toBe(403);
      expect((await get(user, user.id)).status).toBe(403);
    },
  );

  it('no session → 401', async () => {
    expect((await list(null)).status).toBe(401);
    expect((await get(null, fixture.workerIds.a)).status).toBe(401);
  });

  it('a tampered or revoked token → 401', async () => {
    const cookie = await sessionCookie(fixture.users.lcsA);
    expect((await list(`${cookie}x`)).status).toBe(401);
    // session_version is 0 in the DB; a token claiming 1 is not current.
    expect((await list(await sessionCookie(fixture.users.lcsA, 1))).status).toBe(401);
    expect((await list(`${SESSION_COOKIE}=garbage`)).status).toBe(401);
  });

  it('a token whose role claim was changed is rejected even when correctly signed', async () => {
    const forged = await sessionCookie({ ...fixture.users.customer, role: 'national_admin' });
    expect((await list(forged)).status).toBe(401);
  });

  it('/api/v1/me reports the caller and their scope', async () => {
    const response = await send('/api/v1/me', fixture.users.lcsA, (request) => meRoute(request));
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: fixture.users.lcsA.id,
      role: 'lcs_admin',
      societyId: fixture.societyIds.a,
      stateCode: 'KL',
      consent: { platformTerms: true },
    });
    expect((await send('/api/v1/me', null, (request) => meRoute(request))).status).toBe(401);
  });
});
