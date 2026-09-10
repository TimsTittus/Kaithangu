/**
 * Minimal LCS admin (AGENTS.md, Phase 6): unassigned bookings in scope, the
 * candidate list with scores for one of them (reuses dispatch's own
 * candidate query so the admin sees exactly what dispatch would have
 * offered), manual assign (delegates to dispatch.manualAssign so both paths
 * create the same kind of offer), and worker verify/suspend.
 */
import { assertCan, requireRole, scopeFilter } from '../authz';
import type { BookingStatus } from '../booking/stateMachine';
import type { RequestContext } from '../context';
import { AppError } from '../errors';
import type { DispatchRepo } from './dispatch';
import type { MatchMode, RankedCandidate } from '../matching/score';
import { rankCandidates } from '../matching/score';
import type { Urgency } from '../pricing';
import type { TradeCode } from '../trades';
import { parseInput } from '../validation';
import { z } from 'zod';

export interface UnassignedBookingSummary {
  id: string;
  tradeCode: TradeCode;
  urgency: Urgency;
  addressText: string;
  pincode: string;
  createdAt: Date;
  societyId: string | null;
}

export interface AdminRepo {
  unassignedBookings(societyId: string): Promise<UnassignedBookingSummary[]>;
  setWorkerStatus(
    workerId: string,
    status: 'verified' | 'suspended',
    verifiedBy: string,
    now: Date,
  ): Promise<boolean>;
  workerSocietyId(workerId: string): Promise<string | null>;
}

export interface AdminDeps {
  admin: AdminRepo;
  dispatch: Pick<DispatchRepo, 'getBooking' | 'loadMatchContext' | 'findCandidates'>;
  now?: () => Date;
}

function modeOf(urgency: Urgency): MatchMode {
  return urgency === 'emergency' ? 'emergency' : 'normal';
}

const bookingIdSchema = z.uuid();
const workerIdSchema = z.uuid();

export function createAdminService(deps: AdminDeps) {
  async function setStatus(
    ctx: RequestContext,
    workerIdInput: unknown,
    status: 'verified' | 'suspended',
  ): Promise<void> {
    const { actor } = requireRole(ctx, ['lcs_admin', 'state_admin', 'national_admin']);
    const workerId = parseInput(workerIdSchema, workerIdInput);
    const societyId = await deps.admin.workerSocietyId(workerId);
    if (societyId === null) throw new AppError('NOT_FOUND');
    assertCan(actor, status === 'verified' ? 'worker.verify' : 'worker.suspend', { societyId });
    const now = deps.now ?? (() => new Date());
    const moved = await deps.admin.setWorkerStatus(workerId, status, actor.userId, now());
    if (!moved) throw new AppError('NOT_FOUND');
  }

  return {
    async listUnassigned(ctx: RequestContext): Promise<UnassignedBookingSummary[]> {
      const { actor } = requireRole(ctx, ['lcs_admin', 'state_admin', 'national_admin']);
      const scope = scopeFilter(actor, 'booking.assign_manual');
      if (scope.kind !== 'society') {
        // state/national admins: no single society to scope this screen to yet.
        throw new AppError('FORBIDDEN', undefined, undefined, { action: 'admin.unassigned' });
      }
      return deps.admin.unassignedBookings(scope.societyId);
    },

    async candidatesFor(
      ctx: RequestContext,
      bookingIdInput: unknown,
    ): Promise<{ status: BookingStatus; candidates: RankedCandidate[] }> {
      const { actor } = requireRole(ctx, ['lcs_admin', 'state_admin', 'national_admin']);
      const bookingId = parseInput(bookingIdSchema, bookingIdInput);
      const booking = await deps.dispatch.getBooking(bookingId);
      if (booking === null) throw new AppError('NOT_FOUND');
      assertCan(actor, 'booking.assign_manual', {
        stateCode: booking.stateCode,
        societyId: booking.societyId,
      });
      if (booking.societyId === null) return { status: booking.status, candidates: [] };
      const context = await deps.dispatch.loadMatchContext(booking.societyId, booking.tradeCode);
      const candidates = await deps.dispatch.findCandidates(
        booking.id,
        booking.societyId,
        booking.tradeCode,
        booking.location,
        context.societyMeanRating,
      );
      return {
        status: booking.status,
        candidates: rankCandidates(candidates, context, modeOf(booking.urgency)),
      };
    },

    async verifyWorker(ctx: RequestContext, workerIdInput: unknown): Promise<void> {
      await setStatus(ctx, workerIdInput, 'verified');
    },

    async suspendWorker(ctx: RequestContext, workerIdInput: unknown): Promise<void> {
      await setStatus(ctx, workerIdInput, 'suspended');
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
