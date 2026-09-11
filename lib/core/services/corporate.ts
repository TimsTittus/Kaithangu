/**
 * Corporate service — dashboard metrics, worker roster oversight, booking
 * activity, and worker verification. Corporate actors are unscoped platform
 * admins (AGENTS.md 4.2).
 */
import { z } from 'zod';
import { assertCan, requireRole, scopeFilter } from '../authz';
import type { RequestContext } from '../context';
import { AppError } from '../errors';
import { parseInput } from '../validation';
import { workerListFiltersSchema, type WorkerRepo, type WorkerSummary } from './workers';

export interface CorporateDashboardData {
  id: string;
  name: string | null;
  phone: string;
  role: 'corporate';
  workerCount: number;
  enrolmentCount: number;
  welfareFundPaise: number;
  schemes: { code: string; name: string; enrolled: number }[];
}

export interface CorporateProfileData {
  id: string;
  name: string | null;
  phone: string;
  workerCount: number;
  enrolmentCount: number;
  welfareFundPaise: number;
}

export interface CorporateBookingSummary {
  id: string;
  tradeCode: string;
  problemText: string;
  status: string;
  totalPaise: number;
  welfarePaise: number;
  createdAt: Date;
  scheduledFor: Date | null;
  pincode: string;
}

export interface CorporateRepo {
  dashboard(corporateId: string): Promise<CorporateDashboardData>;
  profile(corporateId: string): Promise<CorporateProfileData | null>;
  recentBookings(limit?: number): Promise<CorporateBookingSummary[]>;
  verifyWorker(workerId: string): Promise<boolean>;
  revokeWorker(workerId: string): Promise<boolean>;
}

export interface CorporateDeps {
  corporate: CorporateRepo;
  workers: WorkerRepo;
}

const workerActionSchema = z.object({
  workerId: z.uuid(),
});

const bookingListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export function createCorporateService({ corporate, workers }: CorporateDeps) {
  return {
    async getDashboard(ctx: RequestContext): Promise<CorporateDashboardData> {
      const { actor } = requireRole(ctx, ['corporate']);
      return corporate.dashboard(actor.userId);
    },

    async getProfile(ctx: RequestContext): Promise<CorporateProfileData> {
      const { actor } = requireRole(ctx, ['corporate']);
      const profile = await corporate.profile(actor.userId);
      if (!profile) throw new AppError('NOT_FOUND');
      return profile;
    },

    async listWorkers(ctx: RequestContext, filters?: unknown): Promise<WorkerSummary[]> {
      const { actor } = requireRole(ctx, ['corporate']);
      const scope = scopeFilter(actor, 'worker.read');
      if (scope.kind !== 'all' && scope.kind !== 'state') {
        throw new AppError('FORBIDDEN', undefined, undefined, { action: 'worker.read' });
      }
      const parsedFilters = parseInput(workerListFiltersSchema, filters ?? {});
      return workers.list(scope, parsedFilters);
    },

    async listBookings(ctx: RequestContext, input?: unknown): Promise<CorporateBookingSummary[]> {
      requireRole(ctx, ['corporate']);
      const parsed = parseInput(bookingListSchema, input ?? {});
      return corporate.recentBookings(parsed.limit);
    },

    async verifyWorker(
      ctx: RequestContext,
      input: unknown,
    ): Promise<{ success: boolean; worker: WorkerSummary }> {
      const { actor } = requireRole(ctx, ['corporate']);
      const { workerId } = parseInput(workerActionSchema, input);
      scopeFilter(actor, 'worker.verify');
      assertCan(actor, 'worker.verify', { workerId });

      const updated = await corporate.verifyWorker(workerId);
      if (!updated) {
        throw new AppError('CONFLICT');
      }

      const workerScope = scopeFilter(actor, 'worker.read');
      const workerRecord = await workers.get(workerId, workerScope);
      if (!workerRecord) {
        throw new AppError('NOT_FOUND');
      }

      return { success: true, worker: workerRecord };
    },

    async revokeVerification(
      ctx: RequestContext,
      input: unknown,
    ): Promise<{ success: boolean; worker: WorkerSummary }> {
      const { actor } = requireRole(ctx, ['corporate']);
      const { workerId } = parseInput(workerActionSchema, input);
      scopeFilter(actor, 'worker.verify');
      assertCan(actor, 'worker.verify', { workerId });

      const updated = await corporate.revokeWorker(workerId);
      if (!updated) {
        throw new AppError('CONFLICT');
      }

      const workerScope = scopeFilter(actor, 'worker.read');
      const workerRecord = await workers.get(workerId, workerScope);
      if (!workerRecord) {
        throw new AppError('NOT_FOUND');
      }

      return { success: true, worker: workerRecord };
    },
  };
}

export type CorporateService = ReturnType<typeof createCorporateService>;
