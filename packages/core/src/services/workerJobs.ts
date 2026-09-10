/**
 * Worker-side job progression (AGENTS.md 6.6): availability, the current
 * offer, the active job (en_route -> start OTP -> complete OTP), and 30-day
 * earnings. Follows services/workers.ts's tenancy pattern: every read is
 * scoped to the signed-in worker (own_worker), never a bare id lookup.
 */
import { assertCan, requireRole } from '../authz';
import { workerCheckCode } from '../booking/codes';
import type { BookingStatus } from '../booking/stateMachine';
import { canTransition } from '../booking/stateMachine';
import type { RequestContext, UserActor } from '../context';
import { AppError } from '../errors';
import type { LngLat } from '../geo';
import { OTP_MAX_ATTEMPTS, verifyOtp } from '../otp';
import type { Urgency } from '../pricing';
import type { TradeCode } from '../trades';
import { parseInput } from '../validation';
import type { LcsAdminContact } from './dispatch';
import { z } from 'zod';

/**
 * What the repo reads/writes. Keeps `qrKeyVersion` rather than a computed
 * check code: the DB layer never sees the OTP pepper (AGENTS.md 5), so
 * deriving the worker's check code is the service's job (see toSnapshot).
 */
export interface WorkerJobRow {
  bookingId: string;
  status: BookingStatus;
  workerId: string;
  customerName: string | null;
  addressText: string;
  location: LngLat;
  tradeCode: TradeCode;
  urgency: Urgency;
  wagePaise: number;
  qrKeyVersion: number;
  startOtpHash: string | null;
  completeOtpHash: string | null;
  startOtpAttempts: number;
  completeOtpAttempts: number;
  otpLockedAt: Date | null;
  societyId: string | null;
}

export interface WorkerJobSnapshot {
  bookingId: string;
  status: BookingStatus;
  workerId: string;
  customerName: string | null;
  addressText: string;
  location: LngLat;
  tradeCode: TradeCode;
  urgency: Urgency;
  wagePaise: number;
  checkCode: string;
  startOtpAttempts: number;
  completeOtpAttempts: number;
  otpLockedAt: Date | null;
}

export interface WorkerOfferSnapshot {
  offerId: string;
  bookingId: string;
  tradeCode: TradeCode;
  urgency: Urgency;
  area: string | null;
  distanceKm: number;
  wagePaise: number;
  offeredAt: Date;
  expiresAt: Date;
}

export interface WorkerEarningRow {
  bookingId: string;
  tradeCode: TradeCode;
  completedAt: Date;
  wagePaise: number;
}

export interface WorkerJobTransitionInput {
  bookingId: string;
  from: BookingStatus;
  to: BookingStatus;
  actorUserId: string;
  meta: Record<string, unknown>;
}

export interface WorkerJobRepo {
  setAvailable(workerId: string, available: boolean, now: Date): Promise<void>;
  activeJob(workerId: string): Promise<WorkerJobRow | null>;
  getForWorker(bookingId: string, workerId: string): Promise<WorkerJobRow | null>;
  transition(input: WorkerJobTransitionInput): Promise<boolean>;
  /** Atomically bumps the attempt counter; locks (sets otp_locked_at) at OTP_MAX_ATTEMPTS. */
  incrementOtpAttempts(
    bookingId: string,
    kind: 'start' | 'complete',
    now: Date,
  ): Promise<{ attempts: number; locked: boolean }>;
  markLastJobCompleted(workerId: string, at: Date): Promise<void>;
  currentOffer(workerId: string): Promise<WorkerOfferSnapshot | null>;
  earnings(workerId: string, sinceDays: number): Promise<WorkerEarningRow[]>;
  lcsAdmins(societyId: string): Promise<LcsAdminContact[]>;
}

/** Enqueues the payment/rating follow-up (stubs until Phases 8-9). */
export interface PostCompletionQueue {
  enqueue(bookingId: string): Promise<void>;
}

export interface WorkerAlertNotifier {
  notify(input: {
    userId: string;
    channel: 'app' | 'sms' | 'ivr';
    kind: string;
    bookingId: string | null;
    titleKey: string;
    params: Record<string, string | number>;
    locale: string;
    phone: string | null;
  }): Promise<void>;
}

export interface WorkerJobDeps {
  jobs: WorkerJobRepo;
  postCompletion: PostCompletionQueue;
  notifier: WorkerAlertNotifier;
  now?: () => Date;
}

const bookingIdSchema = z.uuid();
const otpSchema = z.string().regex(/^\d{4}$/, 'must be 4 digits');
const EARNINGS_WINDOW_DAYS = 30;

function requireWorker(ctx: RequestContext): UserActor & { role: 'worker' } {
  const { actor } = requireRole(ctx, ['worker']);
  return actor;
}

async function loadOwn(deps: WorkerJobDeps, actor: UserActor, bookingId: string) {
  if (!bookingIdSchema.safeParse(bookingId).success) throw new AppError('NOT_FOUND');
  const job = await deps.jobs.getForWorker(bookingId, actor.userId);
  if (job === null) throw new AppError('NOT_FOUND');
  assertCan(actor, 'booking.progress', { workerId: job.workerId });
  return job;
}

export function createWorkerJobService(deps: WorkerJobDeps & { codeSecret: string }) {
  const now = deps.now ?? (() => new Date());

  function toSnapshot(row: WorkerJobRow): WorkerJobSnapshot {
    return {
      bookingId: row.bookingId,
      status: row.status,
      workerId: row.workerId,
      customerName: row.customerName,
      addressText: row.addressText,
      location: row.location,
      tradeCode: row.tradeCode,
      urgency: row.urgency,
      wagePaise: row.wagePaise,
      checkCode: workerCheckCode(deps.codeSecret, {
        bookingId: row.bookingId,
        workerId: row.workerId,
        keyVersion: row.qrKeyVersion,
      }),
      startOtpAttempts: row.startOtpAttempts,
      completeOtpAttempts: row.completeOtpAttempts,
      otpLockedAt: row.otpLockedAt,
    };
  }

  async function verifyAndAdvance(
    ctx: RequestContext,
    bookingIdInput: unknown,
    otpInput: unknown,
    kind: 'start' | 'complete',
    to: BookingStatus,
  ): Promise<WorkerJobSnapshot> {
    const actor = requireWorker(ctx);
    const bookingId = parseInput(bookingIdSchema, bookingIdInput);
    const job = await loadOwn(deps, actor, bookingId);
    // en_route -> in_progress and in_progress -> completed each have exactly
    // one valid predecessor, so this is equivalent to requiring job.status === from.
    if (!canTransition(job.status, to)) {
      throw new AppError('INVALID_TRANSITION', undefined, undefined, { from: job.status, to });
    }
    const otp = parseInput(otpSchema, otpInput);
    if (job.otpLockedAt !== null) throw new AppError('OTP_LOCKED');
    const hash = kind === 'start' ? job.startOtpHash : job.completeOtpHash;
    if (hash === null) throw new AppError('CONFLICT', undefined, undefined, { reason: 'no_otp' });

    const valid = verifyOtp(otp, hash, deps.codeSecret);
    if (!valid) {
      const { attempts, locked } = await deps.jobs.incrementOtpAttempts(bookingId, kind, now());
      if (locked) {
        if (job.societyId !== null) {
          const admins = await deps.jobs.lcsAdmins(job.societyId);
          await Promise.all(
            admins.map((admin) =>
              deps.notifier.notify({
                userId: admin.userId,
                channel: 'app',
                kind: 'otp_locked',
                bookingId,
                titleKey: 'notification.otp_locked',
                params: { trade: job.tradeCode },
                locale: admin.locale,
                phone: admin.phone,
              }),
            ),
          );
        }
        throw new AppError('OTP_ATTEMPTS_EXCEEDED');
      }
      throw new AppError('OTP_INVALID', undefined, undefined, {
        attemptsRemaining: OTP_MAX_ATTEMPTS - attempts,
      });
    }

    const moved = await deps.jobs.transition({
      bookingId,
      from: job.status,
      to,
      actorUserId: actor.userId,
      meta: { otpKind: kind },
    });
    if (!moved) throw new AppError('CONFLICT', undefined, undefined, { reason: 'status_changed' });
    if (to === 'completed') {
      await deps.jobs.markLastJobCompleted(actor.userId, now());
      await deps.postCompletion.enqueue(bookingId);
    }
    const updated = await deps.jobs.getForWorker(bookingId, actor.userId);
    if (updated === null) throw new AppError('NOT_FOUND');
    return toSnapshot(updated);
  }

  return {
    async setAvailable(ctx: RequestContext, availableInput: unknown): Promise<void> {
      const actor = requireWorker(ctx);
      const available = parseInput(z.boolean(), availableInput);
      assertCan(actor, 'worker.update', { workerId: actor.userId });
      await deps.jobs.setAvailable(actor.userId, available, now());
    },

    async myOffer(ctx: RequestContext): Promise<WorkerOfferSnapshot | null> {
      const actor = requireWorker(ctx);
      return deps.jobs.currentOffer(actor.userId);
    },

    async activeJob(ctx: RequestContext): Promise<WorkerJobSnapshot | null> {
      const actor = requireWorker(ctx);
      const row = await deps.jobs.activeJob(actor.userId);
      return row === null ? null : toSnapshot(row);
    },

    /** accepted -> en_route. */
    async markEnRoute(ctx: RequestContext, bookingIdInput: unknown): Promise<WorkerJobSnapshot> {
      const actor = requireWorker(ctx);
      const bookingId = parseInput(bookingIdSchema, bookingIdInput);
      const job = await loadOwn(deps, actor, bookingId);
      if (!canTransition(job.status, 'en_route')) {
        throw new AppError('INVALID_TRANSITION', undefined, undefined, {
          from: job.status,
          to: 'en_route',
        });
      }
      const moved = await deps.jobs.transition({
        bookingId,
        from: job.status,
        to: 'en_route',
        actorUserId: actor.userId,
        meta: {},
      });
      if (!moved)
        throw new AppError('CONFLICT', undefined, undefined, { reason: 'status_changed' });
      const updated = await deps.jobs.getForWorker(bookingId, actor.userId);
      if (updated === null) throw new AppError('NOT_FOUND');
      return toSnapshot(updated);
    },

    /** en_route -> in_progress, gated by the start OTP (AGENTS.md 6.6). */
    startJob(ctx: RequestContext, bookingId: unknown, otp: unknown): Promise<WorkerJobSnapshot> {
      return verifyAndAdvance(ctx, bookingId, otp, 'start', 'in_progress');
    },

    /** in_progress -> completed, gated by the complete OTP (AGENTS.md 6.6). */
    completeJob(ctx: RequestContext, bookingId: unknown, otp: unknown): Promise<WorkerJobSnapshot> {
      return verifyAndAdvance(ctx, bookingId, otp, 'complete', 'completed');
    },

    async earnings(ctx: RequestContext): Promise<WorkerEarningRow[]> {
      const actor = requireWorker(ctx);
      return deps.jobs.earnings(actor.userId, EARNINGS_WINDOW_DAYS);
    },
  };
}

export type WorkerJobService = ReturnType<typeof createWorkerJobService>;
