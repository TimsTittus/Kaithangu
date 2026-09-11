/**
 * Corporate service — society administration, dashboard metrics,
 * worker roster oversight, booking activity, and worker verification.
 * Follows tenant-scoped authorization pattern (AGENTS.md 4.2).
 */
import { z } from 'zod';
import { assertCan, scopeFilter, type Action } from '../authz';
import { isSystemActor, type RequestContext, type UserActor } from '../context';
import { AppError } from '../errors';
import { parseInput } from '../validation';
import {
  workerListFiltersSchema,
  type WorkerRepo,
  type WorkerSummary,
} from './workers';

export interface CorporateDashboardData {
  id: string;
  name: string | null;
  phone: string;
  role: 'corporate';
  societyId: string | null;
  societyName: string | null;
  workerCount: number;
  enrolmentCount: number;
  welfareFundPaise: number;
  schemes: { code: string; name: string; enrolled: number }[];
}

export interface CorporateProfileData {
  id: string;
  name: string | null;
  phone: string;
  societyId: string | null;
  societyName: string | null;
  stateCode: string | null;
  stateNameKey: string | null;
  societyCreatedAt: Date | null;
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
  dashboard(corporateId: string, societyId: string | null): Promise<CorporateDashboardData>;
  profile(corporateId: string): Promise<CorporateProfileData | null>;
  recentBookings(societyId: string, limit?: number): Promise<CorporateBookingSummary[]>;
  verifyWorker(workerId: string, societyId: string): Promise<boolean>;
  revokeWorker(workerId: string, societyId: string): Promise<boolean>;
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

function requireUserActor(ctx: RequestContext, action: Action): UserActor {
  if (isSystemActor(ctx.actor)) {
    throw new AppError('FORBIDDEN', undefined, undefined, { action });
  }
  return ctx.actor;
}

export function createCorporateService({ corporate, workers }: CorporateDeps) {
  return {
    /** Society dashboard aggregates scoped to the actor's society. */
    async getDashboard(ctx: RequestContext): Promise<CorporateDashboardData> {
      const actor = requireUserActor(ctx, 'society.read');
      // Corporate users without a linked society get empty data instead of FORBIDDEN
      const societyId = actor.societyId ?? null;
      return corporate.dashboard(actor.userId, societyId);
    },

    /** Corporate user + linked society details for the profile page. */
    async getProfile(ctx: RequestContext): Promise<CorporateProfileData> {
      const actor = requireUserActor(ctx, 'society.read');
      // Don't call scopeFilter — it throws when societyId is missing.
      // The profile query itself is scoped to the actor's own corporate row.
      const profile = await corporate.profile(actor.userId);
      if (!profile) throw new AppError('NOT_FOUND');
      return profile;
    },

    /** Worker roster within the actor's society scope. */
    async listWorkers(ctx: RequestContext, filters?: unknown): Promise<WorkerSummary[]> {
      const actor = requireUserActor(ctx, 'worker.read');
      if (!actor.societyId) return []; // no society linked yet
      const scope = scopeFilter(actor, 'worker.read');
      if (scope.kind !== 'society' && scope.kind !== 'all' && scope.kind !== 'state') {
        throw new AppError('FORBIDDEN', undefined, undefined, { action: 'worker.read' });
      }
      const parsedFilters = parseInput(workerListFiltersSchema, filters ?? {});
      return workers.list(scope, parsedFilters);
    },

    /** Recent bookings within the actor's society. */
    async listBookings(ctx: RequestContext, input?: unknown): Promise<CorporateBookingSummary[]> {
      const actor = requireUserActor(ctx, 'booking.read');
      if (!actor.societyId) return []; // no society linked yet
      const scope = scopeFilter(actor, 'booking.read');
      if (scope.kind !== 'society') {
        return [];
      }
      const parsed = parseInput(bookingListSchema, input ?? {});
      return corporate.recentBookings(scope.societyId, parsed.limit);
    },

    /**
     * Transition a worker from 'pending' to 'verified'.
     * Requires 'worker.verify' action scoped to the same society.
     */
    async verifyWorker(
      ctx: RequestContext,
      input: unknown,
    ): Promise<{ success: boolean; worker: WorkerSummary }> {
      const { workerId } = parseInput(workerActionSchema, input);
      const scope = scopeFilter(ctx.actor, 'worker.verify');
      if (scope.kind !== 'society') {
        throw new AppError('FORBIDDEN', undefined, undefined, { action: 'worker.verify' });
      }

      // Assert permission for this society and worker
      assertCan(ctx.actor, 'worker.verify', {
        societyId: scope.societyId,
        workerId,
      });

      const updated = await corporate.verifyWorker(workerId, scope.societyId);
      if (!updated) {
        throw new AppError('CONFLICT');
      }

      const workerScope = scopeFilter(ctx.actor, 'worker.read');
      const workerRecord = await workers.get(workerId, workerScope);
      if (!workerRecord) {
        throw new AppError('NOT_FOUND');
      }

      return { success: true, worker: workerRecord };
    },

    /**
     * Transition a worker from 'verified' back to 'pending'.
     * Requires 'worker.verify' action scoped to the same society.
     */
    async revokeVerification(
      ctx: RequestContext,
      input: unknown,
    ): Promise<{ success: boolean; worker: WorkerSummary }> {
      const { workerId } = parseInput(workerActionSchema, input);
      const scope = scopeFilter(ctx.actor, 'worker.verify');
      if (scope.kind !== 'society') {
        throw new AppError('FORBIDDEN', undefined, undefined, { action: 'worker.verify' });
      }

      // Assert permission for this society and worker
      assertCan(ctx.actor, 'worker.verify', {
        societyId: scope.societyId,
        workerId,
      });

      const updated = await corporate.revokeWorker(workerId, scope.societyId);
      if (!updated) {
        throw new AppError('CONFLICT');
      }

      const workerScope = scopeFilter(ctx.actor, 'worker.read');
      const workerRecord = await workers.get(workerId, workerScope);
      if (!workerRecord) {
        throw new AppError('NOT_FOUND');
      }

      return { success: true, worker: workerRecord };
    },
  };
}

export type CorporateService = ReturnType<typeof createCorporateService>;
