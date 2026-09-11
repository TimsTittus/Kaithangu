/**
 * Customer bookings (Phase 5; AGENTS.md 6.2, 6.4, 6.5, 6.6). Follows the
 * tenancy pattern of services/workers.ts: reads go through a ScopeFilter the
 * repository applies in SQL, a row outside the scope is NOT_FOUND, and the
 * loaded row is re-checked with assertCan. Customers see only their own
 * bookings.
 *
 * Prices are always computed here from state config (never taken from the
 * client). createBooking is idempotent per (customer, Idempotency-Key): the
 * same key with the same body returns the first booking; with a different
 * body it is a CONFLICT.
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { assertCan, can, requireRole, scopeFilter, type ResourceScope } from '../authz';
import type { ScopeFilter } from '../authz';
import { deriveJobOtp, workerCheckCode, type JobOtpKind } from '../booking/codes';
import { bookableSlots, isBookableSlot } from '../booking/slots';
import { canTransition, assertTransition, type BookingStatus } from '../booking/stateMachine';
import { ROLES, type RequestContext, type Role, type UserActor } from '../context';
import { AppError } from '../errors';
import type { LngLat } from '../geo';
import { canonicalJson } from '../canonicalJson';
import {
  quote as computeQuote,
  type PricingLineKey,
  type PricingStateConfig,
  type TradeRates,
  type Urgency,
} from '../pricing';
import { isCertifiedRequired, TRADE_CODES, type TradeCode } from '../trades';
import type { WorkerStatus } from './workers';
import { parseInput } from '../validation';

export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
/** Idempotency-Key header: 16–128 URL-safe characters (a UUID fits). */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
/** A GPS point further than this from every known post office gets no pincode. */
export const NEAREST_PINCODE_MAX_METERS = 30_000;
export const MAX_BOOKING_LIST = 50;
export const MAX_SAVED_ADDRESSES = 5;
export const PROBLEM_TEXT_MAX_LENGTH = 1000;
export const ADDRESS_TEXT_MAX_LENGTH = 300;
export const CANCEL_REASON_MAX_LENGTH = 200;
export const MAX_ESTIMATED_MINUTES = 24 * 60;

const locationFields = {
  pincode: z.string().trim().regex(PINCODE_PATTERN).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
};

interface LocationInput {
  pincode?: string | undefined;
  lat?: number | undefined;
  lng?: number | undefined;
}

/** lat and lng come together; without them a pincode is required. */
function hasLocation({ pincode, lat, lng }: LocationInput): boolean {
  if ((lat === undefined) !== (lng === undefined)) return false;
  return lat !== undefined || pincode !== undefined;
}

const quoteFields = {
  tradeCode: z.enum(TRADE_CODES),
  ...locationFields,
  urgency: z.enum(['normal', 'emergency']).default('normal'),
  estimatedMinutes: z.number().int().min(1).max(MAX_ESTIMATED_MINUTES).optional(),
};

export const quoteInputSchema = z
  .object(quoteFields)
  .refine(hasLocation, { path: ['pincode'], message: 'location required' });

export const createBookingInputSchema = z
  .object({
    ...quoteFields,
    problemText: z.string().trim().min(3).max(PROBLEM_TEXT_MAX_LENGTH),
    addressText: z.string().trim().min(3).max(ADDRESS_TEXT_MAX_LENGTH),
    scheduledFor: z.iso.datetime({ offset: true }).optional(),
    expectedTotalPaise: z.number().int().min(0).optional(),
  })
  .refine(hasLocation, { path: ['pincode'], message: 'location required' })
  .refine((input) => !(input.urgency === 'emergency' && input.scheduledFor !== undefined), {
    path: ['scheduledFor'],
    message: 'an emergency cannot be scheduled',
  });

export const cancelBookingInputSchema = z.object({
  reason: z.string().trim().min(1).max(CANCEL_REASON_MAX_LENGTH).optional(),
});

export type QuoteRequest = z.output<typeof quoteInputSchema>;
export type CreateBookingRequest = z.output<typeof createBookingInputSchema>;

// ------------------------------------------------------------------ ports

export interface BookingPricingInputs {
  stateConfig: PricingStateConfig & { timezone: string; isPlaceholder: boolean };
  rates: TradeRates & { isPlaceholder: boolean };
}

export interface BookingPricingRepo {
  load(stateCode: string, tradeCode: TradeCode): Promise<BookingPricingInputs | null>;
}

export interface PincodeGeocode {
  location: LngLat;
  officeName: string;
  district: string;
  stateName: string;
}

export interface PlaceRepo {
  /** A location for the pincode (one of its post offices), or null when unknown. */
  pincodeLocation(pincode: string): Promise<LngLat | null>;
  /** Post office centroid plus locality labels, or null when the pincode is unknown. */
  geocodePincode(pincode: string): Promise<PincodeGeocode | null>;
  /** Pincode of the nearest post office within maxMeters, or null. */
  nearestPincode(point: LngLat, maxMeters: number): Promise<string | null>;
}

export interface SavedAddress {
  id: string;
  addressText: string;
  pincode: string;
  location: LngLat;
}

export interface BookingDraft {
  customerId: string;
  stateCode: string;
  tradeCode: TradeCode;
  problemText: string;
  urgency: Urgency;
  scheduledFor: Date | null;
  estimatedMinutes: number;
  location: LngLat;
  addressText: string;
  pincode: string;
  /** Full pricing breakdown (inputs, rates used, result) as quoted. */
  quote: Record<string, unknown>;
  wagePaise: number;
  welfarePaise: number;
  platformFeePaise: number;
  gstPaise: number;
  totalPaise: number;
}

export interface IdempotentBooking {
  requestHash: string;
  bookingId: string;
  status: BookingStatus;
}

export type CreateBookingOutcome =
  { kind: 'created' | 'replayed'; id: string; status: BookingStatus } | { kind: 'conflict' };

export interface BookingEventRecord {
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  at: Date;
}

export interface BookingWorkerRecord {
  id: string;
  name: string | null;
  ratingSum: number;
  ratingCount: number;
  qrKeyVersion: number;
}

export interface BookingRecord {
  id: string;
  customerId: string;
  stateCode: string;
  workerId: string | null;
  tradeCode: TradeCode;
  problemText: string;
  urgency: Urgency;
  scheduledFor: Date | null;
  addressText: string;
  pincode: string;
  status: BookingStatus;
  wagePaise: number;
  surchargePaise: number;
  welfarePaise: number;
  platformFeePaise: number;
  gstPaise: number;
  totalPaise: number;
  createdAt: Date;
  events: BookingEventRecord[];
  worker: BookingWorkerRecord | null;
}

export interface BookingSummaryRecord {
  id: string;
  tradeCode: TradeCode;
  status: BookingStatus;
  urgency: Urgency;
  scheduledFor: Date | null;
  createdAt: Date;
  totalPaise: number;
}

export interface BookingTransition {
  bookingId: string;
  from: BookingStatus;
  to: BookingStatus;
  actorRole: Role;
  actorId: string;
  meta: Record<string, unknown>;
  cancelledReason: string | null;
}

/**
 * A booking on the open job board: one no worker has taken yet. Workers claim
 * from this board, so no offer round, timeout or background dispatcher is
 * needed (there is no job consumer in this deployment).
 */
export interface OpenJobRecord {
  id: string;
  tradeCode: TradeCode;
  status: BookingStatus;
  urgency: Urgency;
  problemText: string;
  addressText: string;
  pincode: string;
  scheduledFor: Date | null;
  createdAt: Date;
  estimatedMinutes: number;
  wagePaise: number;
  totalPaise: number;
}

/** Filter for the open job board: the trades a worker may take, in their state. */
export interface OpenJobFilter {
  tradeCodes: readonly TradeCode[];
  stateCode: string;
  limit: number;
}

/** One worker taking one booking, walking the state machine to 'accepted'. */
export interface BookingClaim {
  bookingId: string;
  workerId: string;
  /** The status the booking must still be in, or the claim is a no-op. */
  from: BookingStatus;
  /** Each status to pass through, in order, ending at 'accepted'. */
  path: readonly BookingStatus[];
}

export interface BookingRepo {
  findIdempotent(key: string): Promise<IdempotentBooking | null>;
  /**
   * Atomically claim the idempotency key, insert the booking, its first
   * booking_events row and (if new) the saved address. A key claimed
   * concurrently resolves to 'replayed' (same hash) or 'conflict'.
   */
  create(input: {
    idempotencyKey: string;
    requestHash: string;
    draft: BookingDraft;
  }): Promise<CreateBookingOutcome>;
  get(bookingId: string, scope: ScopeFilter): Promise<BookingRecord | null>;
  list(scope: ScopeFilter, limit: number): Promise<BookingSummaryRecord[]>;
  /** Compare-and-set the status and write booking_events; false if the status moved. */
  transition(input: BookingTransition): Promise<boolean>;
  savedAddresses(userId: string, limit: number): Promise<SavedAddress[]>;
  /** Bookings still waiting for a worker, newest first. */
  openJobs(filter: OpenJobFilter): Promise<OpenJobRecord[]>;
  /**
   * Atomically take an unclaimed booking: set worker_id and walk `path`,
   * writing one booking_events row per step. False when another worker got
   * there first (the compare-and-set on status + null worker_id failed).
   */
  claim(input: BookingClaim): Promise<boolean>;
}

/** What decides whether a worker may see and take a job. */
export interface WorkerEligibility {
  status: WorkerStatus;
  available: boolean;
  skills: readonly { tradeCode: TradeCode; certified: boolean }[];
}

export interface WorkerEligibilityRepo {
  /** The worker's own status, availability and registered trades; null if none. */
  eligibility(workerId: string): Promise<WorkerEligibility | null>;
}

export interface MatchJob {
  bookingId: string;
  urgency: Urgency;
  scheduledFor: string | null;
}

/** Queue producer port. The dispatch consumer arrives with Phase 6. */
export interface JobQueue {
  enqueue(queue: 'match', payload: MatchJob): Promise<void>;
}

export interface BookingDeps {
  bookings: BookingRepo;
  workers: WorkerEligibilityRepo;
  pricing: BookingPricingRepo;
  places: PlaceRepo;
  consent: { assertConsented(ctx: RequestContext | null): Promise<void> };
  jobs: JobQueue;
  /** State used for pricing when the customer has none on their profile. */
  defaultStateCode: string;
  /** Server secret for derived job OTPs and worker check codes (≥ 32 chars). */
  codeSecret: string;
  now?: () => Date;
}

// ------------------------------------------------------------------ views

export interface QuoteView {
  tradeCode: TradeCode;
  urgency: Urgency;
  stateCode: string;
  pincode: string;
  location: LngLat;
  estimatedMinutes: number;
  billableMinutes: number;
  wagePaise: number;
  surchargePaise: number;
  welfarePaise: number;
  platformFeePaise: number;
  gstPaise: number;
  totalPaise: number;
  breakdownKeys: PricingLineKey[];
  /** True while the rates are TODO_VERIFY placeholders. */
  isPlaceholder: boolean;
}

export interface BookingOptions {
  tradeCode: TradeCode;
  timeZone: string;
  /** ISO start instants of bookable 2-hour slots. */
  slots: string[];
  savedAddresses: SavedAddress[];
}

export interface BookingWorkerView {
  name: string | null;
  tradeCode: TradeCode;
  /** Mean star rating to one decimal, null before the first rating. */
  rating: number | null;
  ratingCount: number;
  checkCode: string;
}

export interface BookingView {
  id: string;
  status: BookingStatus;
  tradeCode: TradeCode;
  urgency: Urgency;
  problemText: string;
  addressText: string;
  pincode: string;
  scheduledFor: string | null;
  createdAt: string;
  price: {
    wagePaise: number;
    surchargePaise: number;
    welfarePaise: number;
    platformFeePaise: number;
    gstPaise: number;
    totalPaise: number;
  };
  events: { fromStatus: BookingStatus | null; toStatus: BookingStatus; at: string }[];
  worker: BookingWorkerView | null;
  /** Only for the booking's customer, while the code is still needed. */
  otps: { start: string | null; complete: string | null } | null;
  canCancel: boolean;
}

export interface BookingSummaryView {
  id: string;
  tradeCode: TradeCode;
  status: BookingStatus;
  urgency: Urgency;
  scheduledFor: string | null;
  createdAt: string;
  totalPaise: number;
}

/** An open job as the worker's board shows it. */
export interface OpenJobView {
  id: string;
  tradeCode: TradeCode;
  urgency: Urgency;
  problemText: string;
  addressText: string;
  pincode: string;
  scheduledFor: string | null;
  createdAt: string;
  estimatedMinutes: number;
  /** What this job pays the worker, before welfare and fees. */
  wagePaise: number;
  totalPaise: number;
}

export interface CreatedBooking {
  id: string;
  status: BookingStatus;
  replayed: boolean;
}

const WORKER_VISIBLE: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  'accepted',
  'en_route',
  'in_progress',
  'completed',
  'disputed',
  'resolved',
]);
const START_OTP_VISIBLE: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  'accepted',
  'en_route',
]);
const COMPLETE_OTP_VISIBLE: ReadonlySet<BookingStatus> = new Set<BookingStatus>([
  'accepted',
  'en_route',
  'in_progress',
]);

/**
 * A booking is on the open board while it has no worker. 'requested' is
 * included because this deployment has no match consumer to move bookings on
 * to 'matching' (server/jobs.ts only logs), so a claim walks the state machine
 * from wherever the booking actually is.
 */
export const OPEN_JOB_STATUSES: readonly BookingStatus[] = ['requested', 'matching', 'offered'];

/** The path a claim walks, per status the booking can be on the board in. */
const CLAIM_PATHS: Readonly<Partial<Record<BookingStatus, readonly BookingStatus[]>>> = {
  requested: ['matching', 'offered', 'accepted'],
  matching: ['offered', 'accepted'],
  offered: ['accepted'],
};

/** What a worker may move a job they hold to, and the code the customer reads out. */
const WORKER_STEPS: Readonly<
  Partial<Record<BookingStatus, { to: BookingStatus; otp: JobOtpKind | null }>>
> = {
  accepted: { to: 'en_route', otp: null },
  en_route: { to: 'in_progress', otp: 'start' },
  in_progress: { to: 'completed', otp: 'complete' },
};

const bookingIdSchema = z.uuid();

export const advanceBookingInputSchema = z.object({
  otp: z
    .string()
    .trim()
    .regex(/^[0-9]+$/)
    .optional(),
});

function resourceOf(record: BookingRecord): ResourceScope {
  return {
    stateCode: record.stateCode,
    customerId: record.customerId,
    workerId: record.workerId,
  };
}

function validationError(path: string, code: string): AppError {
  return new AppError('VALIDATION_FAILED', undefined, undefined, { issues: [{ path, code }] });
}

function toSummaryView(record: BookingSummaryRecord): BookingSummaryView {
  return {
    ...record,
    scheduledFor: record.scheduledFor?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

export function createBookingService(deps: BookingDeps) {
  const now = deps.now ?? (() => new Date());

  const stateOf = (actor: UserActor): string => actor.stateCode ?? deps.defaultStateCode;

  async function pricingFor(stateCode: string, tradeCode: TradeCode) {
    const inputs = await deps.pricing.load(stateCode, tradeCode);
    if (inputs === null) {
      throw new AppError('NOT_SERVICEABLE', undefined, undefined, { stateCode, tradeCode });
    }
    return inputs;
  }

  async function resolveLocation(
    input: LocationInput,
  ): Promise<{ location: LngLat; pincode: string }> {
    if (input.lat !== undefined && input.lng !== undefined) {
      const location = { lng: input.lng, lat: input.lat };
      const pincode =
        input.pincode ?? (await deps.places.nearestPincode(location, NEAREST_PINCODE_MAX_METERS));
      if (pincode === null) throw new AppError('PINCODE_UNKNOWN');
      return { location, pincode };
    }
    if (input.pincode === undefined) throw validationError('pincode', 'required');
    const location = await deps.places.pincodeLocation(input.pincode);
    if (location === null) throw new AppError('PINCODE_UNKNOWN');
    return { location, pincode: input.pincode };
  }

  async function price(actor: UserActor, input: QuoteRequest) {
    const stateCode = stateOf(actor);
    const inputs = await pricingFor(stateCode, input.tradeCode);
    const place = await resolveLocation(input);
    // Default job length: the trade's minimum billable minutes for the state.
    const estimatedMinutes = input.estimatedMinutes ?? inputs.rates.minBillableMinutes;
    const result = computeQuote({
      rates: inputs.rates,
      stateConfig: inputs.stateConfig,
      estimatedMinutes,
      urgency: input.urgency,
      isInstitution: false,
    });
    const view: QuoteView = {
      tradeCode: input.tradeCode,
      urgency: input.urgency,
      stateCode,
      pincode: place.pincode,
      location: place.location,
      estimatedMinutes,
      billableMinutes: result.billableMinutes,
      wagePaise: result.wage,
      surchargePaise: result.surcharge,
      welfarePaise: result.welfare,
      platformFeePaise: result.platformFee,
      gstPaise: result.gst,
      totalPaise: result.total,
      breakdownKeys: result.breakdownKeys,
      isPlaceholder: inputs.rates.isPlaceholder || inputs.stateConfig.isPlaceholder,
    };
    return { inputs, view };
  }

  function toView(actor: UserActor, record: BookingRecord): BookingView {
    const isCustomer = actor.userId === record.customerId;
    const worker =
      record.worker !== null && WORKER_VISIBLE.has(record.status)
        ? {
            name: record.worker.name,
            tradeCode: record.tradeCode,
            rating:
              record.worker.ratingCount > 0
                ? Math.round((record.worker.ratingSum * 10) / record.worker.ratingCount) / 10
                : null,
            ratingCount: record.worker.ratingCount,
            checkCode: workerCheckCode(deps.codeSecret, {
              bookingId: record.id,
              workerId: record.worker.id,
              keyVersion: record.worker.qrKeyVersion,
            }),
          }
        : null;
    const showStart = isCustomer && START_OTP_VISIBLE.has(record.status);
    const showComplete = isCustomer && COMPLETE_OTP_VISIBLE.has(record.status);
    return {
      id: record.id,
      status: record.status,
      tradeCode: record.tradeCode,
      urgency: record.urgency,
      problemText: record.problemText,
      addressText: record.addressText,
      pincode: record.pincode,
      scheduledFor: record.scheduledFor?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      price: {
        wagePaise: record.wagePaise,
        surchargePaise: record.surchargePaise,
        welfarePaise: record.welfarePaise,
        platformFeePaise: record.platformFeePaise,
        gstPaise: record.gstPaise,
        totalPaise: record.totalPaise,
      },
      events: record.events.map((event) => ({
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        at: event.at.toISOString(),
      })),
      worker,
      otps:
        showStart || showComplete
          ? {
              start: showStart ? deriveJobOtp(deps.codeSecret, record.id, 'start') : null,
              complete: showComplete ? deriveJobOtp(deps.codeSecret, record.id, 'complete') : null,
            }
          : null,
      canCancel:
        canTransition(record.status, 'cancelled') &&
        can(actor, 'booking.cancel', resourceOf(record)),
    };
  }

  async function loadScoped(
    actor: UserActor,
    bookingId: string,
    action: 'booking.read' | 'booking.cancel',
  ) {
    const scope = scopeFilter(actor, action);
    if (!bookingIdSchema.safeParse(bookingId).success) throw new AppError('NOT_FOUND');
    const record = await deps.bookings.get(bookingId, scope);
    if (record === null) throw new AppError('NOT_FOUND');
    assertCan(actor, action, resourceOf(record));
    return record;
  }

  /**
   * The trades this worker may take right now. A worker must be verified and
   * available; a trade in CERTIFIED_REQUIRED (electrician, technician) also
   * needs a certified skill (core/trades.ts).
   */
  async function takeableTrades(workerId: string): Promise<TradeCode[]> {
    const eligibility = await deps.workers.eligibility(workerId);
    if (eligibility === null) return [];
    if (eligibility.status !== 'verified' || !eligibility.available) return [];
    return eligibility.skills
      .filter((skill) => skill.certified || !isCertifiedRequired(skill.tradeCode))
      .map((skill) => skill.tradeCode);
  }

  async function viewOf(actor: UserActor, bookingId: string): Promise<BookingView> {
    return toView(actor, await loadScoped(actor, bookingId, 'booking.read'));
  }

  function toOpenJobView(record: OpenJobRecord): OpenJobView {
    const { status, ...rest } = record;
    void status;
    return {
      ...rest,
      scheduledFor: record.scheduledFor?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
    };
  }

  async function enqueueMatch(bookingId: string, request: CreateBookingRequest) {
    await deps.jobs.enqueue('match', {
      bookingId,
      urgency: request.urgency,
      scheduledFor:
        request.scheduledFor === undefined ? null : new Date(request.scheduledFor).toISOString(),
    });
  }

  return {
    /** Price for a job at a place (AGENTS.md 6.2); nothing is stored. */
    async quote(ctx: RequestContext | null, input: unknown): Promise<QuoteView> {
      const { actor } = requireRole(ctx, ['user']);
      const request = parseInput(quoteInputSchema, input);
      return (await price(actor, request)).view;
    },

    /** What the booking wizard offers for a trade: time slots and saved addresses. */
    async bookingOptions(ctx: RequestContext | null, tradeCode: unknown): Promise<BookingOptions> {
      const { actor } = requireRole(ctx, ['user']);
      const trade = parseInput(z.enum(TRADE_CODES), tradeCode);
      const inputs = await pricingFor(stateOf(actor), trade);
      const { timezone } = inputs.stateConfig;
      return {
        tradeCode: trade,
        timeZone: timezone,
        slots: bookableSlots(now(), timezone).map((slot) => slot.toISOString()),
        savedAddresses: await deps.bookings.savedAddresses(actor.userId, MAX_SAVED_ADDRESSES),
      };
    },

    /**
     * Create a booking in 'requested' and enqueue matching. Idempotent per
     * (customer, idempotencyKey).
     */
    async createBooking(
      ctx: RequestContext | null,
      input: unknown,
      idempotencyKey: string | null | undefined,
    ): Promise<CreatedBooking> {
      const { actor } = requireRole(ctx, ['user']);
      assertCan(actor, 'booking.create', { customerId: actor.userId });
      if (typeof idempotencyKey !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
        throw validationError('idempotency-key', 'invalid_format');
      }
      const request = parseInput(createBookingInputSchema, input);
      await deps.consent.assertConsented(ctx);

      const key = `booking.create:${actor.userId}:${idempotencyKey}`;
      const requestHash = createHash('sha256')
        .update(canonicalJson(JSON.parse(JSON.stringify(request)) as unknown))
        .digest('hex');

      const existing = await deps.bookings.findIdempotent(key);
      if (existing !== null) {
        if (existing.requestHash !== requestHash) {
          throw new AppError('CONFLICT', undefined, undefined, {
            reason: 'idempotency_key_reused',
          });
        }
        // A retry after a failed enqueue must not leave the booking unmatched;
        // the match consumer is idempotent per booking.
        if (existing.status === 'requested') await enqueueMatch(existing.bookingId, request);
        return { id: existing.bookingId, status: existing.status, replayed: true };
      }

      const { inputs, view } = await price(actor, request);
      let scheduledFor: Date | null = null;
      if (request.scheduledFor !== undefined) {
        scheduledFor = new Date(request.scheduledFor);
        if (!isBookableSlot(scheduledFor, now(), inputs.stateConfig.timezone)) {
          throw validationError('scheduledFor', 'not_a_bookable_slot');
        }
      }
      if (
        request.expectedTotalPaise !== undefined &&
        request.expectedTotalPaise !== view.totalPaise
      ) {
        throw new AppError('PRICE_CHANGED', undefined, undefined, { totalPaise: view.totalPaise });
      }

      const outcome = await deps.bookings.create({
        idempotencyKey: key,
        requestHash,
        draft: {
          customerId: actor.userId,
          stateCode: view.stateCode,
          tradeCode: request.tradeCode,
          problemText: request.problemText,
          urgency: request.urgency,
          scheduledFor,
          estimatedMinutes: view.estimatedMinutes,
          location: view.location,
          addressText: request.addressText,
          pincode: view.pincode,
          quote: {
            ...view,
            rates: {
              wageFloorPerHourPaise: inputs.rates.wageFloorPerHourPaise,
              minBillableMinutes: inputs.rates.minBillableMinutes,
              visitChargePaise: inputs.rates.visitChargePaise,
              emergencySurchargePct: String(inputs.rates.emergencySurchargePct),
            },
            stateConfig: {
              welfarePct: String(inputs.stateConfig.welfarePct),
              platformFeePct: String(inputs.stateConfig.platformFeePct),
              gstPctOnPlatformFee: String(inputs.stateConfig.gstPctOnPlatformFee),
            },
          },
          wagePaise: view.wagePaise,
          welfarePaise: view.welfarePaise,
          platformFeePaise: view.platformFeePaise,
          gstPaise: view.gstPaise,
          totalPaise: view.totalPaise,
        },
      });
      if (outcome.kind === 'conflict') {
        throw new AppError('CONFLICT', undefined, undefined, { reason: 'idempotency_key_reused' });
      }
      if (outcome.status === 'requested') await enqueueMatch(outcome.id, request);
      return { id: outcome.id, status: outcome.status, replayed: outcome.kind === 'replayed' };
    },

    async getBooking(ctx: RequestContext | null, bookingId: string): Promise<BookingView> {
      const { actor } = requireRole(ctx, ROLES);
      return toView(actor, await loadScoped(actor, bookingId, 'booking.read'));
    },

    /** Bookings in the actor's scope, newest first (customers: their own). */
    async listBookings(ctx: RequestContext | null): Promise<BookingSummaryView[]> {
      const { actor } = requireRole(ctx, ROLES);
      const rows = await deps.bookings.list(scopeFilter(actor, 'booking.read'), MAX_BOOKING_LIST);
      return rows.map(toSummaryView);
    },

    /**
     * The open job board: bookings in the worker's state, for a trade they may
     * take, that no worker has claimed yet.
     */
    async openJobs(ctx: RequestContext | null): Promise<OpenJobView[]> {
      const { actor } = requireRole(ctx, ['worker']);
      const tradeCodes = await takeableTrades(actor.userId);
      if (tradeCodes.length === 0) return [];
      const rows = await deps.bookings.openJobs({
        tradeCodes,
        stateCode: stateOf(actor),
        limit: MAX_BOOKING_LIST,
      });
      return rows.map(toOpenJobView);
    },

    /**
     * Take an open job. The booking walks the state machine to 'accepted' in
     * one atomic step; the first worker to claim wins and the rest get a
     * CONFLICT.
     */
    async claimJob(ctx: RequestContext | null, bookingId: string): Promise<BookingView> {
      const { actor } = requireRole(ctx, ['worker']);
      if (!bookingIdSchema.safeParse(bookingId).success) throw new AppError('NOT_FOUND');

      const tradeCodes = await takeableTrades(actor.userId);
      if (tradeCodes.length === 0)
        throw new AppError('FORBIDDEN', undefined, undefined, {
          action: 'offer.respond',
        });

      // Read through the board's own filter: a booking the worker may not take
      // is simply not there.
      const [job] = await deps.bookings
        .openJobs({
          tradeCodes,
          stateCode: stateOf(actor),
          limit: MAX_BOOKING_LIST,
        })
        .then((rows) => rows.filter((row) => row.id === bookingId));
      if (job === undefined) throw new AppError('NOT_FOUND');

      const path = CLAIM_PATHS[job.status];
      if (path === undefined) throw new AppError('NOT_FOUND');
      // Every step must be legal before any of them is written.
      let from: BookingStatus = job.status;
      for (const to of path) {
        assertTransition(from, to);
        from = to;
      }

      const claimed = await deps.bookings.claim({
        bookingId,
        workerId: actor.userId,
        from: job.status,
        path,
      });
      if (!claimed) {
        throw new AppError('CONFLICT', undefined, undefined, { reason: 'already_claimed' });
      }
      return viewOf(actor, bookingId);
    },

    /**
     * Move a job the worker holds to its next status. Starting the work needs
     * the customer's start code and finishing it needs the complete code; both
     * are derived, never stored (core/booking/codes.ts).
     */
    async advanceBooking(
      ctx: RequestContext | null,
      bookingId: string,
      input: unknown,
    ): Promise<BookingView> {
      const { actor } = requireRole(ctx, ['worker']);
      const { otp } = parseInput(advanceBookingInputSchema, input ?? {});
      const record = await loadScoped(actor, bookingId, 'booking.read');
      assertCan(actor, 'booking.progress', resourceOf(record));

      const step = WORKER_STEPS[record.status];
      if (step === undefined) {
        throw new AppError('INVALID_TRANSITION', undefined, undefined, { from: record.status });
      }
      assertTransition(record.status, step.to);

      if (step.otp !== null) {
        const expected = deriveJobOtp(deps.codeSecret, record.id, step.otp);
        if (otp === undefined) throw validationError('otp', 'required');
        if (otp !== expected) throw validationError('otp', 'incorrect');
      }

      const moved = await deps.bookings.transition({
        bookingId: record.id,
        from: record.status,
        to: step.to,
        actorRole: actor.role,
        actorId: actor.userId,
        meta: {},
        cancelledReason: null,
      });
      if (!moved) {
        throw new AppError('CONFLICT', undefined, undefined, { reason: 'status_changed' });
      }
      return viewOf(actor, bookingId);
    },

    /** Cancel from any state the machine allows (AGENTS.md 6.5). */
    async cancelBooking(
      ctx: RequestContext | null,
      bookingId: string,
      input: unknown,
    ): Promise<BookingView> {
      const { actor } = requireRole(ctx, ROLES);
      const { reason } = parseInput(cancelBookingInputSchema, input ?? {});
      const record = await loadScoped(actor, bookingId, 'booking.cancel');
      assertTransition(record.status, 'cancelled');
      const moved = await deps.bookings.transition({
        bookingId: record.id,
        from: record.status,
        to: 'cancelled',
        actorRole: actor.role,
        actorId: actor.userId,
        meta: reason === undefined ? {} : { reason },
        cancelledReason: reason ?? null,
      });
      if (!moved)
        throw new AppError('CONFLICT', undefined, undefined, { reason: 'status_changed' });
      return toView(actor, await loadScoped(actor, bookingId, 'booking.read'));
    },
  };
}

export type BookingService = ReturnType<typeof createBookingService>;
