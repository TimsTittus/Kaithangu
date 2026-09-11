/**
 * Worker directory queries. Every query takes the ScopeFilter computed by
 * core's scopeFilter() and applies it in SQL (AGENTS.md 4.2), so rows outside
 * the actor's scope are never read.
 */
import type {
  ScopeFilter,
  TradeCode,
  WorkerListFilters,
  WorkerRepo,
  WorkerSkillSummary,
  WorkerSummary,
} from '@/lib/core';
import { and, asc, desc, eq, exists, inArray, sql, type SQL } from 'drizzle-orm';
import type { Database } from '..';
import { worker, workerSkills } from '../schema';

/** The SQL condition for a scope. Kinds that never apply to workers match nothing. */
export function workerScopeCondition(scope: ScopeFilter): SQL | undefined {
  switch (scope.kind) {
    case 'all':
      return undefined;
    case 'state':
      return sql`false`;
    case 'own_worker':
      return eq(worker.id, scope.userId);
    case 'own_customer':
      return sql`false`;
  }
}

function selectWorkers(db: Database) {
  return db
    .select({
      id: worker.id,
      name: worker.name,
      phone: worker.phone,
      status: worker.status,
      stateCode: sql<string | null>`null`,
      available: worker.available,
      hasSmartphone: worker.hasSmartphone,
      ratingCount: worker.ratingCount,
    })
    .from(worker);
}

type WorkerRow = Omit<WorkerSummary, 'skills'>;

async function withSkills(db: Database, rows: WorkerRow[]): Promise<WorkerSummary[]> {
  if (rows.length === 0) return [];
  const skills = await db
    .select({
      workerId: workerSkills.workerId,
      tradeCode: workerSkills.tradeCode,
      level: workerSkills.level,
      certified: workerSkills.certified,
      verified: workerSkills.verified,
    })
    .from(workerSkills)
    .where(
      inArray(
        workerSkills.workerId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(workerSkills.tradeCode));
  const byWorker = new Map<string, WorkerSkillSummary[]>();
  for (const { workerId, tradeCode, ...skill } of skills) {
    const list = byWorker.get(workerId) ?? [];
    list.push({ tradeCode: tradeCode as TradeCode, ...skill });
    byWorker.set(workerId, list);
  }
  return rows.map((row) => ({ ...row, skills: byWorker.get(row.id) ?? [] }));
}

export function createWorkerRepo(db: Database): WorkerRepo {
  return {
    async list(scope: ScopeFilter, filters: WorkerListFilters) {
      const conditions: (SQL | undefined)[] = [workerScopeCondition(scope)];
      if (filters.status !== undefined) conditions.push(eq(worker.status, filters.status));
      if (filters.available !== undefined) {
        conditions.push(eq(worker.available, filters.available));
      }
      if (filters.tradeCode !== undefined) {
        conditions.push(
          exists(
            db
              .select({ one: sql`1` })
              .from(workerSkills)
              .where(
                and(
                  eq(workerSkills.workerId, worker.id),
                  eq(workerSkills.tradeCode, filters.tradeCode),
                ),
              ),
          ),
        );
      }
      const rows = await selectWorkers(db)
        .where(and(...conditions))
        .orderBy(desc(worker.createdAt), asc(worker.id))
        .limit(filters.limit)
        .offset(filters.offset);
      return withSkills(db, rows);
    },

    async get(workerId: string, scope: ScopeFilter) {
      const rows = await selectWorkers(db)
        .where(and(eq(worker.id, workerId), workerScopeCondition(scope)))
        .limit(1);
      const [found] = await withSkills(db, rows);
      return found ?? null;
    },
  };
}
