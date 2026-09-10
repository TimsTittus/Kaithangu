import { describe, expect, it } from 'vitest';
import type { ScopeFilter } from '../authz';
import { systemContext, type RequestContext, type Role, type UserActor } from '../context';
import {
  createWorkerService,
  type WorkerListFilters,
  type WorkerRepo,
  type WorkerSummary,
} from './workers';

// Fictional ids.
const SOCIETY_A = '00000000-0000-4000-8000-00000000000a';
const SOCIETY_B = '00000000-0000-4000-8000-00000000000b';
const W_A = '00000000-0000-4000-8000-0000000000a1';
const W_B = '00000000-0000-4000-8000-0000000000b1';

const worker = (id: string, societyId: string, stateCode: string): WorkerSummary => ({
  id,
  name: null,
  phone: '+919000000000',
  status: 'verified',
  societyId,
  stateCode,
  available: true,
  hasSmartphone: false,
  ratingCount: 0,
  skills: [],
});

/** Applies the scope the way the SQL repository does. */
class FakeRepo implements WorkerRepo {
  readonly calls: { scope: ScopeFilter; filters?: WorkerListFilters }[] = [];
  readonly rows = [worker(W_A, SOCIETY_A, 'KL'), worker(W_B, SOCIETY_B, 'TN')];

  private inScope(row: WorkerSummary, scope: ScopeFilter): boolean {
    switch (scope.kind) {
      case 'all':
        return true;
      case 'state':
        return row.stateCode === scope.stateCode;
      case 'society':
        return row.societyId === scope.societyId;
      case 'own_worker':
        return row.id === scope.userId;
      default:
        return false;
    }
  }

  list(scope: ScopeFilter, filters: WorkerListFilters) {
    this.calls.push({ scope, filters });
    return Promise.resolve(this.rows.filter((row) => this.inScope(row, scope)));
  }

  get(id: string, scope: ScopeFilter) {
    this.calls.push({ scope });
    return Promise.resolve(
      this.rows.find((row) => row.id === id && this.inScope(row, scope)) ?? null,
    );
  }
}

function ctx(role: Role, extra: Partial<UserActor> = {}): RequestContext {
  return { actor: { userId: 'u', role, ...extra }, requestId: 'r', locale: 'en' };
}

const lcsA = ctx('lcs_admin', { societyId: SOCIETY_A, stateCode: 'KL' });

describe('listWorkers', () => {
  it('passes the actor scope and parsed filters to the repository', async () => {
    const repo = new FakeRepo();
    const service = createWorkerService({ workers: repo });
    await expect(service.listWorkers(lcsA, { status: 'verified', limit: '10' })).resolves.toEqual([
      repo.rows[0],
    ]);
    expect(repo.calls[0]).toEqual({
      scope: { kind: 'society', societyId: SOCIETY_A },
      filters: { status: 'verified', limit: 10, offset: 0 },
    });
  });

  it('scopes state admins to their state and national admins / system to everything', async () => {
    const repo = new FakeRepo();
    const service = createWorkerService({ workers: repo });
    const kl = await service.listWorkers(ctx('state_admin', { stateCode: 'KL' }), {});
    expect(kl.map((w) => w.id)).toEqual([W_A]);
    expect(await service.listWorkers(ctx('national_admin'), undefined)).toHaveLength(2);
    expect(await service.listWorkers(systemContext('test'), {})).toHaveLength(2);
  });

  it.each(['worker', 'customer', 'institution_admin'] as const)(
    '%s may not list workers',
    async (role) => {
      const repo = new FakeRepo();
      const service = createWorkerService({ workers: repo });
      await expect(
        service.listWorkers(ctx(role, { institutionId: 'i' }), {}),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        httpStatus: 403,
      });
      expect(repo.calls).toHaveLength(0);
    },
  );

  it('fails closed when an admin has no scope id', async () => {
    const service = createWorkerService({ workers: new FakeRepo() });
    await expect(service.listWorkers(ctx('lcs_admin'), {})).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects invalid filters', async () => {
    const service = createWorkerService({ workers: new FakeRepo() });
    for (const filters of [
      { limit: 0 },
      { limit: 101 },
      { status: 'x' },
      { societyId: 'x' },
      { tradeCode: 'pilot' },
    ]) {
      await expect(service.listWorkers(lcsA, filters)).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
      });
    }
  });

  it('parses the available flag from query strings', async () => {
    const repo = new FakeRepo();
    const service = createWorkerService({ workers: repo });
    await service.listWorkers(lcsA, { available: 'false' });
    await service.listWorkers(lcsA, { available: true });
    expect(repo.calls.map((c) => c.filters?.available)).toEqual([false, true]);
  });
});

describe('getWorker', () => {
  it('returns an in-scope worker', async () => {
    const service = createWorkerService({ workers: new FakeRepo() });
    await expect(service.getWorker(lcsA, W_A)).resolves.toMatchObject({ id: W_A });
  });

  it('hides workers outside the scope as NOT_FOUND', async () => {
    const service = createWorkerService({ workers: new FakeRepo() });
    await expect(service.getWorker(lcsA, W_B)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    });
    await expect(
      service.getWorker(ctx('state_admin', { stateCode: 'KL' }), W_B),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('lets a worker read only their own record', async () => {
    const service = createWorkerService({ workers: new FakeRepo() });
    const self = { ...ctx('worker'), actor: { userId: W_A, role: 'worker' as const } };
    await expect(service.getWorker(self, W_A)).resolves.toMatchObject({ id: W_A });
    await expect(service.getWorker(self, W_B)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('forbids customers and treats malformed ids as NOT_FOUND', async () => {
    const service = createWorkerService({ workers: new FakeRepo() });
    await expect(service.getWorker(ctx('customer'), W_A)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(service.getWorker(lcsA, 'not-a-uuid')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('re-checks the loaded row even if a repository returns too much', async () => {
    const leaky: WorkerRepo = {
      list: () => Promise.resolve([]),
      get: () => Promise.resolve(worker(W_B, SOCIETY_B, 'TN')),
    };
    await expect(
      createWorkerService({ workers: leaky }).getWorker(lcsA, W_B),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
