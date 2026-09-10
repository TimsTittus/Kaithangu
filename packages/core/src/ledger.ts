/**
 * Ledger (AGENTS.md 6.7). Append-only, hash-chained entries.
 *   UPI captured: credit worker:{id} wage, welfare:{society_id} welfare,
 *                 platform platform_fee, platform:gst gst.
 *   Cash:         credit worker:{id} wage; debit cash_offset:worker:{id} for
 *                 welfare + platform_fee + gst owed (recovered from future payouts).
 *   hash = sha256(prev_hash || canonical_json(entry without hash)); genesis prev_hash = 64 zeros.
 * Zero-amount lines are omitted (the DB requires amount_paise > 0). The hashed
 * JSON uses the DB column names, so a row read back from ledger_entries can be
 * re-verified. Writers must assign `id` and `createdAt` before hashing, inside
 * the transaction that locks ledger_head.
 */
import { createHash } from 'node:crypto';
import { addPaise, type Paise } from './money';

export const GENESIS_HASH = '0'.repeat(64);

export type LedgerDirection = 'credit' | 'debit';
export type LedgerKind =
  'wage' | 'welfare' | 'platform_fee' | 'gst' | 'cash_offset' | 'payout' | 'adjustment';

export const ledgerAccounts = {
  worker: (workerId: string) => `worker:${workerId}`,
  welfare: (societyId: string) => `welfare:${societyId}`,
  platform: 'platform',
  platformGst: 'platform:gst',
  society: (societyId: string) => `society:${societyId}`,
  cashOffset: (workerId: string) => `cash_offset:worker:${workerId}`,
} as const;

export interface LedgerEntryDraft {
  account: string;
  bookingId: string | null;
  amountPaise: Paise;
  direction: LedgerDirection;
  kind: LedgerKind;
}

export interface UnsealedLedgerEntry extends LedgerEntryDraft {
  id: number;
  /** ISO-8601 UTC timestamp, e.g. "2026-09-10T10:00:00.000Z". */
  createdAt: string;
  prevHash: string;
}

export interface LedgerEntry extends UnsealedLedgerEntry {
  hash: string;
}

/** The money fields of a priced booking (AGENTS.md 6.2). */
export interface LedgerBooking {
  id: string;
  workerId: string;
  societyId: string;
  wagePaise: Paise;
  welfarePaise: Paise;
  platformFeePaise: Paise;
  gstPaise: Paise;
  totalPaise: Paise;
}

const HASH_FORMAT = /^[0-9a-f]{64}$/;

function assertBooking(booking: LedgerBooking): void {
  const parts = [
    booking.wagePaise,
    booking.welfarePaise,
    booking.platformFeePaise,
    booking.gstPaise,
  ];
  if (parts.some((part) => !Number.isSafeInteger(part) || part < 0)) {
    throw new RangeError(`booking ${booking.id}: money parts must be non-negative integers`);
  }
  if (addPaise(...parts) !== booking.totalPaise) {
    throw new RangeError(`booking ${booking.id}: parts do not sum to the total`);
  }
}

function credit(
  account: string,
  booking: LedgerBooking,
  amountPaise: Paise,
  kind: LedgerKind,
): LedgerEntryDraft[] {
  return amountPaise > 0
    ? [{ account, bookingId: booking.id, amountPaise, direction: 'credit', kind }]
    : [];
}

/** Entries for a captured UPI payment of `booking.totalPaise`. */
export function buildEntriesForUpi(booking: LedgerBooking): LedgerEntryDraft[] {
  assertBooking(booking);
  return [
    ...credit(ledgerAccounts.worker(booking.workerId), booking, booking.wagePaise, 'wage'),
    ...credit(ledgerAccounts.welfare(booking.societyId), booking, booking.welfarePaise, 'welfare'),
    ...credit(ledgerAccounts.platform, booking, booking.platformFeePaise, 'platform_fee'),
    ...credit(ledgerAccounts.platformGst, booking, booking.gstPaise, 'gst'),
  ];
}

/** Entries for a booking whose worker collected `booking.totalPaise` in cash. */
export function buildEntriesForCash(booking: LedgerBooking): LedgerEntryDraft[] {
  assertBooking(booking);
  const owed = addPaise(booking.welfarePaise, booking.platformFeePaise, booking.gstPaise);
  const entries = credit(
    ledgerAccounts.worker(booking.workerId),
    booking,
    booking.wagePaise,
    'wage',
  );
  if (owed > 0) {
    entries.push({
      account: ledgerAccounts.cashOffset(booking.workerId),
      bookingId: booking.id,
      amountPaise: owed,
      direction: 'debit',
      kind: 'cash_offset',
    });
  }
  return entries;
}

function canonicalValue(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`canonicalJson: non-finite number ${value}`);
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalValue).join(',')}]`;
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalValue(record[k])}`).join(',')}}`;
  }
  throw new TypeError(`canonicalJson: unsupported value of type ${typeof value}`);
}

/**
 * Deterministic JSON: object keys sorted (by UTF-16 code units), no whitespace.
 * Only null, booleans, finite numbers, strings, arrays and plain objects are
 * allowed; anything else (undefined, bigint, Date, NaN) throws.
 */
export function canonicalJson(value: unknown): string {
  return canonicalValue(value);
}

function hashedFields(entry: UnsealedLedgerEntry): Record<string, unknown> {
  return {
    id: entry.id,
    account: entry.account,
    booking_id: entry.bookingId,
    amount_paise: entry.amountPaise,
    direction: entry.direction,
    kind: entry.kind,
    created_at: entry.createdAt,
    prev_hash: entry.prevHash,
  };
}

/** sha256(prevHash || canonical_json(entry without hash)), hex. */
export function computeHash(prevHash: string, entry: UnsealedLedgerEntry): string {
  if (!HASH_FORMAT.test(prevHash)) {
    throw new RangeError('prevHash must be 64 lowercase hex characters');
  }
  if (entry.prevHash !== prevHash) {
    throw new RangeError(`entry ${entry.id}: prevHash does not match the chain head`);
  }
  return createHash('sha256')
    .update(prevHash + canonicalJson(hashedFields(entry)))
    .digest('hex');
}

export interface SealOptions {
  /** Hash of the current chain head (ledger_head.last_hash). */
  prevHash: string;
  /** Id for the first draft; the rest get consecutive ids. */
  firstId: number;
  /** ISO-8601 UTC timestamp shared by the entries of one write. */
  createdAt: string;
}

/** Assign ids, timestamps and hashes, chaining each draft onto the previous one. */
export function sealEntries(
  drafts: readonly LedgerEntryDraft[],
  options: SealOptions,
): LedgerEntry[] {
  if (!Number.isSafeInteger(options.firstId) || options.firstId < 1) {
    throw new RangeError('firstId must be a positive integer');
  }
  if (Number.isNaN(Date.parse(options.createdAt))) {
    throw new RangeError('createdAt must be an ISO-8601 timestamp');
  }
  let prevHash = options.prevHash;
  return drafts.map((draft, index) => {
    if (!Number.isSafeInteger(draft.amountPaise) || draft.amountPaise <= 0) {
      throw new RangeError('ledger amounts must be positive integers');
    }
    const unsealed: UnsealedLedgerEntry = {
      ...draft,
      id: options.firstId + index,
      createdAt: options.createdAt,
      prevHash,
    };
    const entry: LedgerEntry = { ...unsealed, hash: computeHash(prevHash, unsealed) };
    prevHash = entry.hash;
    return entry;
  });
}

export type ChainVerification = { ok: true } | { ok: false; brokenAtId: number };

/** Check links and hashes in order, starting from `startHash` (genesis by default). */
export function verifyChain(
  entries: readonly LedgerEntry[],
  startHash: string = GENESIS_HASH,
): ChainVerification {
  let expectedPrev = startHash;
  for (const entry of entries) {
    if (entry.prevHash !== expectedPrev || !HASH_FORMAT.test(entry.prevHash)) {
      return { ok: false, brokenAtId: entry.id };
    }
    // prevHash is validated above, so computeHash cannot throw here.
    if (computeHash(entry.prevHash, entry) !== entry.hash) {
      return { ok: false, brokenAtId: entry.id };
    }
    expectedPrev = entry.hash;
  }
  return { ok: true };
}
