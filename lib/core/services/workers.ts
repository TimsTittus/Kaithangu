/**
 * Worker directory — the reference pattern for tenant-scoped services
 * (AGENTS.md 4.2). Later services copy this shape:
 * 1. Validate input with zod (parseInput).
 * 2. Derive a ScopeFilter from the actor with scopeFilter(actor, action); the
 *    repository applies it in SQL, so out-of-scope rows are never loaded.
 * 3. For a single record, a row outside the scope is NOT_FOUND (its existence
 *    is not revealed), then assertCan re-checks the loaded row.
 */
import { z } from 'zod';
import { assertCan, scopeFilter, type ScopeFilter } from '../authz';
import type { RequestContext } from '../context';
import { AppError } from '../errors';
import { TRADE_CODES, type TradeCode } from '../trades';
import { parseInput } from '../validation';

export const WORKER_STATUSES = ['pending', 'verified', 'suspended'] as const;
export type WorkerStatus = (typeof WORKER_STATUSES)[number];

export const MAX_WORKER_PAGE_SIZE = 100;

const booleanParam = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((v) => v === 'true'),
]);

/** Filters narrow the actor's scope; they can never widen it. */
export const workerListFiltersSchema = z.object({
  status: z.enum(WORKER_STATUSES).optional(),
  tradeCode: z.enum(TRADE_CODES).optional(),
  societyId: z.uuid().optional(),
  available: booleanParam.optional(),
  limit: z.coerce.number().int().min(1).max(MAX_WORKER_PAGE_SIZE).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

export type WorkerListFilters = z.output<typeof workerListFiltersSchema>;

export interface WorkerSkillSummary {
  tradeCode: TradeCode;
  level: number;
  certified: boolean;
  verified: boolean;
}

export interface WorkerSummary {
  id: string;
  name: string | null;
  phone: string;
  status: WorkerStatus;
  societyId: string | null;
  stateCode: string | null;
  available: boolean;
  hasSmartphone: boolean;
  ratingCount: number;
  skills: WorkerSkillSummary[];
}

export interface WorkerRepo {
  list(scope: ScopeFilter, filters: WorkerListFilters): Promise<WorkerSummary[]>;
  get(workerId: string, scope: ScopeFilter): Promise<WorkerSummary | null>;
}

const workerIdSchema = z.uuid();

export function createWorkerService({ workers }: { workers: WorkerRepo }) {
  return {
    /** Workers inside the actor's scope. Workers and customers may not list. */
    async listWorkers(ctx: RequestContext, filters: unknown): Promise<WorkerSummary[]> {
      const scope = scopeFilter(ctx.actor, 'worker.read');
      if (scope.kind === 'own_worker' || scope.kind === 'own_customer') {
        throw new AppError('FORBIDDEN', undefined, undefined, { action: 'worker.list' });
      }
      return workers.list(scope, parseInput(workerListFiltersSchema, filters ?? {}));
    },

    /** One worker inside the actor's scope (a worker may read their own record). */
    async getWorker(ctx: RequestContext, workerId: string): Promise<WorkerSummary> {
      const scope = scopeFilter(ctx.actor, 'worker.read');
      if (!workerIdSchema.safeParse(workerId).success) throw new AppError('NOT_FOUND');
      const worker = await workers.get(workerId, scope);
      if (worker === null) throw new AppError('NOT_FOUND');
      assertCan(ctx.actor, 'worker.read', {
        stateCode: worker.stateCode,
        societyId: worker.societyId,
        workerId: worker.id,
      });
      return worker;
    },
  };
}

export type WorkerService = ReturnType<typeof createWorkerService>;
