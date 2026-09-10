import { and } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb } from '../client';
import { workers } from '../schema';
import { workerScopeCondition } from './workers';

// Builds SQL only; no connection is made.
const { db, client } = createDb('postgres://user:pass@localhost:5432/none', { max: 1 });

function whereOf(condition: ReturnType<typeof workerScopeCondition>) {
  return db.select({ id: workers.userId }).from(workers).where(and(condition)).toSQL();
}

describe('workerScopeCondition', () => {
  it('applies no filter for national scope', () => {
    expect(workerScopeCondition({ kind: 'all' })).toBeUndefined();
  });

  it('filters by society state, society or own user id as bound parameters', () => {
    const state = whereOf(workerScopeCondition({ kind: 'state', stateCode: 'KL' }));
    expect(state.sql).toContain('"societies"."state_code" = $1');
    expect(state.params).toEqual(['KL']);

    const society = whereOf(workerScopeCondition({ kind: 'society', societyId: 's-1' }));
    expect(society.sql).toContain('"workers"."society_id" = $1');
    expect(society.params).toEqual(['s-1']);

    const own = whereOf(workerScopeCondition({ kind: 'own_worker', userId: 'u-1' }));
    expect(own.sql).toContain('"workers"."user_id" = $1');
    expect(own.params).toEqual(['u-1']);
  });

  it('matches nothing for scopes that never apply to workers', () => {
    for (const scope of [
      { kind: 'institution', institutionId: 'i' },
      { kind: 'own_customer', userId: 'u' },
    ] as const) {
      const query = whereOf(workerScopeCondition(scope));
      expect(query.sql).toMatch(/where false$/);
      expect(query.params).toEqual([]);
    }
  });
});

// Nothing was connected, but end the pool so the test process exits cleanly.
await client.end({ timeout: 0 });
