/**
 * In-memory implementations of the auth, dispatch and worker-job ports for
 * unit tests. Auth fakes follow the Redis semantics of the production stores
 * (TTL from Date.now(), so fake timers control expiry). Not exported from the
 * package root.
 */
import { randomUUID } from 'node:crypto';
import type { Locale } from '@kaithangu/i18n';
import type { SmsMessage } from '@kaithangu/adapters/sms/types';
import type {
  OtpRecord,
  OtpStore,
  RateLimiter,
  SessionUser,
  UpsertLoginInput,
  UserRepo,
} from './auth';
import type { BookingStatus } from '../booking/stateMachine';
import type { LngLat } from '../geo';
import type { MatchCandidate, MatchContext } from '../matching/score';
import { OTP_MAX_ATTEMPTS } from '../otp';
import type { Urgency } from '../pricing';
import type { TradeCode } from '../trades';
import type { AdminRepo, UnassignedBookingSummary } from './admin';
import type {
  CreateOfferRecord,
  DispatchBooking,
  DispatchOffer,
  DispatchRepo,
  DispatchTransitionInput,
  LcsAdminContact,
  Notifier,
  NotifyInput,
  OfferScheduler,
  WorkerContact,
} from './dispatch';
import type {
  PostCompletionQueue,
  WorkerEarningRow,
  WorkerJobRepo,
  WorkerJobRow,
  WorkerJobTransitionInput,
  WorkerOfferSnapshot,
} from './workerJobs';

interface Expiring<T> {
  value: T;
  expiresAt: number;
}

export class MemoryOtpStore implements OtpStore {
  readonly entries = new Map<string, Expiring<OtpRecord>>();

  private live(phone: string): Expiring<OtpRecord> | undefined {
    const entry = this.entries.get(phone);
    if (entry !== undefined && entry.expiresAt <= Date.now()) {
      this.entries.delete(phone);
      return undefined;
    }
    return entry;
  }

  save(phone: string, hash: string, ttlSeconds: number): Promise<void> {
    this.entries.set(phone, {
      value: { hash, attempts: 0 },
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return Promise.resolve();
  }

  recordAttempt(phone: string): Promise<OtpRecord | null> {
    const entry = this.live(phone);
    if (entry === undefined) return Promise.resolve(null);
    entry.value.attempts += 1;
    return Promise.resolve({ ...entry.value });
  }

  consume(phone: string): Promise<boolean> {
    return Promise.resolve(this.live(phone) !== undefined && this.entries.delete(phone));
  }
}

export class MemoryRateLimiter implements RateLimiter {
  readonly windows = new Map<string, Expiring<number>>();

  hit(key: string, windowSeconds: number) {
    let entry = this.windows.get(key);
    if (entry === undefined || entry.expiresAt <= Date.now()) {
      entry = { value: 0, expiresAt: Date.now() + windowSeconds * 1000 };
      this.windows.set(key, entry);
    }
    entry.value += 1;
    return Promise.resolve({
      count: entry.value,
      resetInSeconds: Math.ceil((entry.expiresAt - Date.now()) / 1000),
    });
  }
}

export class MemorySms {
  readonly sent: SmsMessage[] = [];
  failWith: Error | undefined;

  send(message: SmsMessage): Promise<void> {
    if (this.failWith !== undefined) return Promise.reject(this.failWith);
    this.sent.push(message);
    return Promise.resolve();
  }

  /** The code in the most recent message to `phone`. */
  lastCode(phone: string): string {
    const message = this.sent.filter((m) => m.to === phone).at(-1);
    const code = message?.params.code;
    if (typeof code !== 'string') throw new Error(`no code sent to ${phone}`);
    return code;
  }
}

export class MemoryUserRepo implements UserRepo {
  readonly users = new Map<string, SessionUser>();
  readonly lastLogin = new Map<string, Date>();

  add(user: Partial<SessionUser> & Pick<SessionUser, 'phone' | 'role'>): SessionUser {
    const full: SessionUser = {
      id: randomUUID(),
      name: null,
      locale: null,
      sessionVersion: 0,
      stateCode: null,
      societyId: null,
      societyStateCode: null,
      institutionId: null,
      institutionStateCode: null,
      ...user,
    };
    this.users.set(full.id, full);
    return full;
  }

  upsertOnLogin(input: UpsertLoginInput) {
    let user = [...this.users.values()].find((u) => u.phone === input.phone);
    const created = user === undefined;
    user ??= this.add({
      phone: input.phone,
      role: 'customer',
      locale: input.locale,
      stateCode: input.stateCode,
    });
    this.lastLogin.set(user.id, input.at);
    return Promise.resolve({ user: { ...user }, created });
  }

  findSessionUser(userId: string) {
    const user = this.users.get(userId);
    return Promise.resolve(user === undefined ? null : { ...user });
  }

  bumpSessionVersion(userId: string) {
    const user = this.users.get(userId);
    if (user === undefined) return Promise.resolve(null);
    user.sessionVersion += 1;
    return Promise.resolve(user.sessionVersion);
  }

  setLocale(userId: string, locale: Locale) {
    const user = this.users.get(userId);
    if (user !== undefined) user.locale = locale;
    return Promise.resolve();
  }
}

// --------------------------------------------------------- dispatch fakes

/** One row of shared state behind both MemoryDispatchRepo and MemoryWorkerJobRepo. */
export interface InternalBooking {
  id: string;
  status: BookingStatus;
  tradeCode: TradeCode;
  urgency: Urgency;
  societyId: string | null;
  stateCode: string;
  customerId: string;
  workerId: string | null;
  location: LngLat;
  scheduledFor: Date | null;
  completedAt: Date | null;
  addressText: string;
  customerName: string | null;
  wagePaise: number;
  qrKeyVersion: number;
  startOtpHash: string | null;
  completeOtpHash: string | null;
  startOtpAttempts: number;
  completeOtpAttempts: number;
  otpLockedAt: Date | null;
}

export interface InternalOffer extends DispatchOffer {
  score: number;
  breakdown: Record<string, unknown>;
  explanationKey: string;
  explanationParams: Record<string, unknown>;
}

export interface InternalWorker extends WorkerContact {
  societyId: string;
  candidate: MatchCandidate;
  available: boolean;
}

/**
 * The in-memory "database" a test scenario seeds directly (bookings,
 * workers, offers) and both MemoryDispatchRepo and MemoryWorkerJobRepo read
 * and write, so a single test can drive a booking through match -> offer ->
 * accept -> en_route -> start -> complete without a real Postgres.
 */
export class MemoryDispatchStore {
  readonly bookings = new Map<string, InternalBooking>();
  readonly offers = new Map<string, InternalOffer>();
  readonly workers = new Map<string, InternalWorker>();
  readonly customers = new Map<string, { phone: string; locale: Locale }>();
  readonly lcsAdminsBySociety = new Map<string, LcsAdminContact[]>();
  context: MatchContext = { societyMeanRating: 1, medianEarnings30dPaise: 0 };
  readonly transitions: DispatchTransitionInput[] = [];

  /** A real UUID, like the DB's `defaultRandom()` — offerIdSchema validates the shape. */
  nextOfferId(): string {
    return randomUUID();
  }
}

export class MemoryDispatchRepo implements DispatchRepo {
  constructor(
    readonly store: MemoryDispatchStore,
    readonly defaultSocietyId: string,
  ) {}

  getBooking(bookingId: string): Promise<DispatchBooking | null> {
    const b = this.store.bookings.get(bookingId);
    return Promise.resolve(b === undefined ? null : { ...b });
  }

  assignNearestSociety(bookingId: string): Promise<string> {
    const booking = this.store.bookings.get(bookingId);
    if (booking === undefined) return Promise.resolve(this.defaultSocietyId);
    if (booking.societyId === null) booking.societyId = this.defaultSocietyId;
    return Promise.resolve(booking.societyId);
  }

  loadMatchContext(): Promise<MatchContext> {
    return Promise.resolve(this.store.context);
  }

  findCandidates(bookingId: string): Promise<MatchCandidate[]> {
    const offered = new Set(
      [...this.store.offers.values()]
        .filter((o) => o.bookingId === bookingId)
        .map((o) => o.workerId),
    );
    const busy = new Set(
      [...this.store.bookings.values()]
        .filter(
          (b) => b.workerId !== null && ['accepted', 'en_route', 'in_progress'].includes(b.status),
        )
        .map((b) => b.workerId as string),
    );
    return Promise.resolve(
      [...this.store.workers.values()]
        .filter((w) => w.available && !offered.has(w.userId) && !busy.has(w.userId))
        .map((w) => w.candidate),
    );
  }

  offersForBooking(bookingId: string): Promise<DispatchOffer[]> {
    return Promise.resolve(
      [...this.store.offers.values()]
        .filter((o) => o.bookingId === bookingId)
        .map((o) => ({ ...o })),
    );
  }

  getOffer(offerId: string): Promise<DispatchOffer | null> {
    const o = this.store.offers.get(offerId);
    return Promise.resolve(o === undefined ? null : { ...o });
  }

  createOffer(record: CreateOfferRecord): Promise<DispatchOffer> {
    const id = this.store.nextOfferId();
    const offer: InternalOffer = { id, response: null, ...record };
    this.store.offers.set(id, offer);
    return Promise.resolve({ ...offer });
  }

  acceptOffer(
    offerId: string,
    workerId: string,
  ): Promise<'accepted' | 'offer_gone' | 'booking_gone'> {
    const offer = this.store.offers.get(offerId);
    if (offer === undefined || offer.workerId !== workerId || offer.response !== null) {
      return Promise.resolve('offer_gone');
    }
    const booking = this.store.bookings.get(offer.bookingId);
    if (booking === undefined || booking.status !== 'offered')
      return Promise.resolve('booking_gone');
    offer.response = 'accepted';
    booking.workerId = workerId;
    booking.status = 'accepted';
    this.store.transitions.push({
      bookingId: booking.id,
      from: 'offered',
      to: 'accepted',
      actor: { userId: workerId },
      meta: {},
    });
    return Promise.resolve('accepted');
  }

  supersedeOtherOffers(bookingId: string, exceptOfferId: string): Promise<void> {
    for (const offer of this.store.offers.values()) {
      if (offer.bookingId === bookingId && offer.id !== exceptOfferId && offer.response === null) {
        offer.response = 'superseded';
      }
    }
    return Promise.resolve();
  }

  respondOffer(offerId: string, to: 'declined' | 'timeout'): Promise<boolean> {
    const offer = this.store.offers.get(offerId);
    if (offer === undefined || offer.response !== null) return Promise.resolve(false);
    offer.response = to;
    return Promise.resolve(true);
  }

  transitionBooking(input: DispatchTransitionInput): Promise<boolean> {
    const booking = this.store.bookings.get(input.bookingId);
    if (booking === undefined || booking.status !== input.from) return Promise.resolve(false);
    booking.status = input.to;
    this.store.transitions.push(input);
    return Promise.resolve(true);
  }

  setJobOtps(bookingId: string, startHash: string, completeHash: string): Promise<void> {
    const booking = this.store.bookings.get(bookingId);
    if (booking !== undefined) {
      booking.startOtpHash = startHash;
      booking.completeOtpHash = completeHash;
    }
    return Promise.resolve();
  }

  workerContact(workerId: string): Promise<WorkerContact | null> {
    const w = this.store.workers.get(workerId);
    if (w === undefined) return Promise.resolve(null);
    return Promise.resolve({
      userId: w.userId,
      name: w.name,
      phone: w.phone,
      locale: w.locale,
      hasSmartphone: w.hasSmartphone,
    });
  }

  customerContact(customerId: string): Promise<{ phone: string; locale: Locale } | null> {
    return Promise.resolve(this.store.customers.get(customerId) ?? null);
  }

  lcsAdmins(societyId: string): Promise<LcsAdminContact[]> {
    return Promise.resolve(this.store.lcsAdminsBySociety.get(societyId) ?? []);
  }
}

export class MemoryOfferScheduler implements OfferScheduler {
  readonly scheduled: { offerId: string; delaySeconds: number }[] = [];

  scheduleOfferTimeout(offerId: string, delaySeconds: number): Promise<void> {
    this.scheduled.push({ offerId, delaySeconds });
    return Promise.resolve();
  }
}

export class MemoryNotifier implements Notifier {
  readonly sent: NotifyInput[] = [];

  notify(input: NotifyInput): Promise<void> {
    this.sent.push(input);
    return Promise.resolve();
  }
}

// ------------------------------------------------------- worker-job fakes

export class MemoryWorkerJobRepo implements WorkerJobRepo {
  constructor(readonly store: MemoryDispatchStore) {}

  private toRow(b: InternalBooking): WorkerJobRow {
    return {
      bookingId: b.id,
      status: b.status,
      workerId: b.workerId ?? '',
      customerName: b.customerName,
      addressText: b.addressText,
      location: b.location,
      tradeCode: b.tradeCode,
      urgency: b.urgency,
      wagePaise: b.wagePaise,
      qrKeyVersion: b.qrKeyVersion,
      startOtpHash: b.startOtpHash,
      completeOtpHash: b.completeOtpHash,
      startOtpAttempts: b.startOtpAttempts,
      completeOtpAttempts: b.completeOtpAttempts,
      otpLockedAt: b.otpLockedAt,
      societyId: b.societyId,
    };
  }

  setAvailable(workerId: string, available: boolean): Promise<void> {
    const w = this.store.workers.get(workerId);
    if (w !== undefined) w.available = available;
    return Promise.resolve();
  }

  activeJob(workerId: string): Promise<WorkerJobRow | null> {
    const b = [...this.store.bookings.values()].find(
      (row) =>
        row.workerId === workerId && ['accepted', 'en_route', 'in_progress'].includes(row.status),
    );
    return Promise.resolve(b === undefined ? null : this.toRow(b));
  }

  getForWorker(bookingId: string, workerId: string): Promise<WorkerJobRow | null> {
    const b = this.store.bookings.get(bookingId);
    if (b === undefined || b.workerId !== workerId) return Promise.resolve(null);
    return Promise.resolve(this.toRow(b));
  }

  transition(input: WorkerJobTransitionInput): Promise<boolean> {
    const booking = this.store.bookings.get(input.bookingId);
    if (booking === undefined || booking.status !== input.from) return Promise.resolve(false);
    booking.status = input.to;
    if (input.to === 'completed') booking.completedAt = new Date();
    this.store.transitions.push({
      bookingId: input.bookingId,
      from: input.from,
      to: input.to,
      actor: { userId: input.actorUserId },
      meta: input.meta,
    });
    return Promise.resolve(true);
  }

  incrementOtpAttempts(
    bookingId: string,
    kind: 'start' | 'complete',
    now: Date,
  ): Promise<{ attempts: number; locked: boolean }> {
    const booking = this.store.bookings.get(bookingId);
    if (booking === undefined) return Promise.resolve({ attempts: OTP_MAX_ATTEMPTS, locked: true });
    if (kind === 'start') booking.startOtpAttempts += 1;
    else booking.completeOtpAttempts += 1;
    const attempts = kind === 'start' ? booking.startOtpAttempts : booking.completeOtpAttempts;
    const locked = attempts >= OTP_MAX_ATTEMPTS;
    if (locked) booking.otpLockedAt = now;
    return Promise.resolve({ attempts, locked });
  }

  readonly lastJobCompletedCalls: { workerId: string; at: Date }[] = [];

  markLastJobCompleted(workerId: string, at: Date): Promise<void> {
    this.lastJobCompletedCalls.push({ workerId, at });
    return Promise.resolve();
  }

  currentOffer(workerId: string): Promise<WorkerOfferSnapshot | null> {
    const offer = [...this.store.offers.values()].find(
      (o) => o.workerId === workerId && o.response === null,
    );
    if (offer === undefined) return Promise.resolve(null);
    const booking = this.store.bookings.get(offer.bookingId);
    if (booking === undefined) return Promise.resolve(null);
    const distanceKm =
      typeof offer.breakdown.distanceKm === 'number' ? offer.breakdown.distanceKm : 0;
    return Promise.resolve({
      offerId: offer.id,
      bookingId: booking.id,
      tradeCode: booking.tradeCode,
      urgency: booking.urgency,
      area: null,
      distanceKm,
      wagePaise: booking.wagePaise,
      offeredAt: offer.offeredAt,
      expiresAt: offer.expiresAt,
    });
  }

  earnings(workerId: string): Promise<WorkerEarningRow[]> {
    return Promise.resolve(
      [...this.store.bookings.values()]
        .filter((b) => b.workerId === workerId && b.status === 'completed')
        .map((b) => ({
          bookingId: b.id,
          tradeCode: b.tradeCode,
          completedAt: b.completedAt ?? new Date(),
          wagePaise: b.wagePaise,
        })),
    );
  }

  lcsAdmins(societyId: string): Promise<LcsAdminContact[]> {
    return Promise.resolve(this.store.lcsAdminsBySociety.get(societyId) ?? []);
  }
}

export class MemoryPostCompletionQueue implements PostCompletionQueue {
  readonly enqueued: string[] = [];

  enqueue(bookingId: string): Promise<void> {
    this.enqueued.push(bookingId);
    return Promise.resolve();
  }
}

// ------------------------------------------------------------ admin fakes

export class MemoryAdminRepo implements AdminRepo {
  readonly statusByWorker = new Map<string, 'verified' | 'suspended'>();

  constructor(readonly store: MemoryDispatchStore) {}

  unassignedBookings(societyId: string): Promise<UnassignedBookingSummary[]> {
    return Promise.resolve(
      [...this.store.bookings.values()]
        .filter((b) => b.societyId === societyId && b.status === 'unassigned')
        .map((b) => ({
          id: b.id,
          tradeCode: b.tradeCode,
          urgency: b.urgency,
          addressText: b.addressText,
          pincode: '',
          createdAt: new Date(),
          societyId: b.societyId,
        })),
    );
  }

  setWorkerStatus(workerId: string, status: 'verified' | 'suspended'): Promise<boolean> {
    const w = this.store.workers.get(workerId);
    if (w === undefined) return Promise.resolve(false);
    this.statusByWorker.set(workerId, status);
    return Promise.resolve(true);
  }

  workerSocietyId(workerId: string): Promise<string | null> {
    const w = this.store.workers.get(workerId);
    return Promise.resolve(w === undefined ? null : w.societyId);
  }
}
