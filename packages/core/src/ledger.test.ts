import { createHash } from 'node:crypto';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  buildEntriesForCash,
  buildEntriesForUpi,
  canonicalJson,
  computeHash,
  GENESIS_HASH,
  ledgerAccounts,
  sealEntries,
  verifyChain,
  type LedgerBooking,
  type LedgerEntry,
  type LedgerEntryDraft,
} from './ledger';
import { paise } from './money';

const AT = '2026-09-10T10:00:00.000Z';

describe('ledgerAccounts', () => {
  it('names the AGENTS.md 6.7 accounts', () => {
    expect(ledgerAccounts.worker('w-1')).toBe('worker:w-1');
    expect(ledgerAccounts.welfare('s-1')).toBe('welfare:s-1');
    expect(ledgerAccounts.platform).toBe('platform');
    expect(ledgerAccounts.platformGst).toBe('platform:gst');
    expect(ledgerAccounts.society('s-1')).toBe('society:s-1');
    expect(ledgerAccounts.cashOffset('w-1')).toBe('cash_offset:worker:w-1');
  });
});

function booking(overrides: Partial<Record<keyof LedgerBooking, unknown>> = {}): LedgerBooking {
  return {
    id: 'b-1',
    workerId: 'w-1',
    societyId: 's-1',
    wagePaise: paise(18750),
    welfarePaise: paise(938),
    platformFeePaise: paise(938),
    gstPaise: paise(169),
    totalPaise: paise(20795),
    ...overrides,
  } as LedgerBooking;
}

const sum = (entries: readonly LedgerEntryDraft[], direction: 'credit' | 'debit') =>
  entries.filter((e) => e.direction === direction).reduce((s, e) => s + e.amountPaise, 0);

describe('buildEntriesForUpi', () => {
  it('credits worker wage, welfare, platform fee and GST', () => {
    expect(buildEntriesForUpi(booking())).toEqual([
      {
        account: 'worker:w-1',
        bookingId: 'b-1',
        amountPaise: 18750,
        direction: 'credit',
        kind: 'wage',
      },
      {
        account: 'welfare:s-1',
        bookingId: 'b-1',
        amountPaise: 938,
        direction: 'credit',
        kind: 'welfare',
      },
      {
        account: 'platform',
        bookingId: 'b-1',
        amountPaise: 938,
        direction: 'credit',
        kind: 'platform_fee',
      },
      {
        account: 'platform:gst',
        bookingId: 'b-1',
        amountPaise: 169,
        direction: 'credit',
        kind: 'gst',
      },
    ]);
  });

  it('omits zero lines (no GST outside institution invoices)', () => {
    const entries = buildEntriesForUpi(booking({ gstPaise: 0, totalPaise: 20626 }));
    expect(entries.map((e) => e.kind)).toEqual(['wage', 'welfare', 'platform_fee']);
    expect(sum(entries, 'credit')).toBe(20626);
  });
});

describe('buildEntriesForCash', () => {
  it('credits the wage and debits the cash offset for everything else owed', () => {
    expect(buildEntriesForCash(booking())).toEqual([
      {
        account: 'worker:w-1',
        bookingId: 'b-1',
        amountPaise: 18750,
        direction: 'credit',
        kind: 'wage',
      },
      {
        account: 'cash_offset:worker:w-1',
        bookingId: 'b-1',
        amountPaise: 938 + 938 + 169,
        direction: 'debit',
        kind: 'cash_offset',
      },
    ]);
  });

  it('omits the offset when nothing is owed', () => {
    const entries = buildEntriesForCash(
      booking({ welfarePaise: 0, platformFeePaise: 0, gstPaise: 0, totalPaise: 18750 }),
    );
    expect(entries).toHaveLength(1);
  });
});

describe('payment paths: totals match (property)', () => {
  const arbBooking = fc
    .record({
      wage: fc.integer({ min: 1, max: 10_000_000 }),
      welfare: fc.integer({ min: 0, max: 1_000_000 }),
      fee: fc.integer({ min: 0, max: 1_000_000 }),
      gst: fc.integer({ min: 0, max: 200_000 }),
    })
    .map(({ wage, welfare, fee, gst }) =>
      booking({
        wagePaise: wage,
        welfarePaise: welfare,
        platformFeePaise: fee,
        gstPaise: gst,
        totalPaise: wage + welfare + fee + gst,
      }),
    );

  it('UPI credits sum to the customer total; cash wage + offset equal it too', () => {
    fc.assert(
      fc.property(arbBooking, (b) => {
        const upi = buildEntriesForUpi(b);
        expect(sum(upi, 'credit')).toBe(b.totalPaise);
        expect(sum(upi, 'debit')).toBe(0);

        const cash = buildEntriesForCash(b);
        const wageCredit = sum(cash, 'credit');
        const offsetDebit = sum(cash, 'debit');
        expect(wageCredit).toBe(b.wagePaise);
        expect(offsetDebit).toBe(b.welfarePaise + b.platformFeePaise + b.gstPaise);
        expect(wageCredit + offsetDebit).toBe(b.totalPaise);

        for (const entry of [...upi, ...cash]) expect(entry.amountPaise).toBeGreaterThan(0);
      }),
    );
  });

  it('rejects inconsistent bookings', () => {
    expect(() => buildEntriesForUpi(booking({ totalPaise: 1 }))).toThrow(RangeError);
    expect(() => buildEntriesForCash(booking({ wagePaise: -5 }))).toThrow(RangeError);
    expect(() => buildEntriesForCash(booking({ gstPaise: 1.5 }))).toThrow(RangeError);
  });
});

describe('canonicalJson', () => {
  it('sorts keys recursively and has no whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: null, y: true }], c: 'x' } })).toBe(
      '{"a":{"c":"x","d":[3,{"y":true,"z":null}]},"b":1}',
    );
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
    expect(canonicalJson('quote"')).toBe('"quote\\""');
  });

  it('rejects values without a canonical form', () => {
    for (const bad of [
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      1n,
      new Date(0),
      { a: undefined },
      () => 1,
    ]) {
      expect(() => canonicalJson(bad)).toThrow(TypeError);
    }
  });
});

const KINDS = [
  'wage',
  'welfare',
  'platform_fee',
  'gst',
  'cash_offset',
  'payout',
  'adjustment',
] as const;
const arbDraft: fc.Arbitrary<LedgerEntryDraft> = fc.record({
  account: fc.constantFrom(
    'worker:w-1',
    'welfare:s-1',
    'platform',
    'platform:gst',
    'cash_offset:worker:w-2',
  ),
  bookingId: fc.option(fc.uuid(), { nil: null }),
  amountPaise: fc.integer({ min: 1, max: 100_000_000 }).map(paise),
  direction: fc.constantFrom('credit' as const, 'debit' as const),
  kind: fc.constantFrom(...KINDS),
});

function chainOf(drafts: readonly LedgerEntryDraft[]): LedgerEntry[] {
  return sealEntries(drafts, { prevHash: GENESIS_HASH, firstId: 1, createdAt: AT });
}

describe('hash chain', () => {
  it('hashes sha256(prev || canonical json of the DB columns)', () => {
    const [entry] = chainOf(buildEntriesForUpi(booking()));
    if (entry === undefined) throw new Error('expected an entry');
    const expected = createHash('sha256')
      .update(
        GENESIS_HASH +
          canonicalJson({
            id: 1,
            account: 'worker:w-1',
            booking_id: 'b-1',
            amount_paise: 18750,
            direction: 'credit',
            kind: 'wage',
            created_at: AT,
            prev_hash: GENESIS_HASH,
          }),
      )
      .digest('hex');
    expect(entry.hash).toBe(expected);
    expect(entry.prevHash).toBe(GENESIS_HASH);
    expect(GENESIS_HASH).toBe('0'.repeat(64));
  });

  it('a chain of 100 random entries verifies', () => {
    fc.assert(
      fc.property(fc.array(arbDraft, { minLength: 100, maxLength: 100 }), (drafts) => {
        const chain = chainOf(drafts);
        expect(chain.map((e) => e.id)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
        chain.slice(1).forEach((e, i) => expect(e.prevHash).toBe(chain[i]?.hash));
        expect(verifyChain(chain)).toEqual({ ok: true });
      }),
      { numRuns: 20 },
    );
  });

  it('altering any field of any entry breaks verification at that entry', () => {
    const chain = chainOf(fc.sample(arbDraft, { numRuns: 100, seed: 42 }));
    expect(chain).toHaveLength(100);
    const tamper: Record<keyof LedgerEntry, (e: LedgerEntry) => LedgerEntry> = {
      id: (e) => ({ ...e, id: e.id + 1000 }),
      account: (e) => ({ ...e, account: `${e.account}x` }),
      bookingId: (e) => ({ ...e, bookingId: e.bookingId === null ? 'b-x' : null }),
      amountPaise: (e) => ({ ...e, amountPaise: paise(e.amountPaise + 1) }),
      direction: (e) => ({ ...e, direction: e.direction === 'credit' ? 'debit' : 'credit' }),
      kind: (e) => ({ ...e, kind: e.kind === 'wage' ? 'payout' : 'wage' }),
      createdAt: (e) => ({ ...e, createdAt: '2026-09-10T10:00:00.001Z' }),
      prevHash: (e) => ({ ...e, prevHash: 'f'.repeat(64) }),
      hash: (e) => ({ ...e, hash: 'f'.repeat(64) }),
    };
    for (let index = 0; index < chain.length; index++) {
      for (const [field, change] of Object.entries(tamper)) {
        const original = chain[index];
        if (original === undefined) throw new Error('missing entry');
        const altered = change(original);
        const tampered = chain.with(index, altered);
        expect(verifyChain(tampered), `${field} at ${index}`).toEqual({
          ok: false,
          brokenAtId: altered.id,
        });
      }
    }
  });

  it('detects removed and reordered entries', () => {
    const chain = chainOf(fc.sample(arbDraft, { numRuns: 5, seed: 7 }));
    expect(verifyChain(chain.filter((_, i) => i !== 2))).toEqual({ ok: false, brokenAtId: 4 });
    const swapped = [chain[0], chain[2], chain[1], chain[3], chain[4]] as LedgerEntry[];
    expect(verifyChain(swapped)).toEqual({ ok: false, brokenAtId: 3 });
  });

  it('verifies a segment from a given head and an empty chain', () => {
    const chain = chainOf(fc.sample(arbDraft, { numRuns: 6, seed: 3 }));
    const head = chain[2]?.hash ?? '';
    expect(verifyChain(chain.slice(3), head)).toEqual({ ok: true });
    expect(verifyChain(chain.slice(3))).toEqual({ ok: false, brokenAtId: 4 });
    expect(verifyChain([])).toEqual({ ok: true });
  });

  it('continues an existing chain across writes', () => {
    const first = chainOf(buildEntriesForUpi(booking()));
    const last = first.at(-1);
    if (last === undefined) throw new Error('expected entries');
    const second = sealEntries(buildEntriesForCash(booking({ id: 'b-2' })), {
      prevHash: last.hash,
      firstId: last.id + 1,
      createdAt: '2026-09-11T08:30:00.000Z',
    });
    expect(verifyChain([...first, ...second])).toEqual({ ok: true });
  });

  it('rejects malformed input', () => {
    const [draft] = buildEntriesForUpi(booking());
    if (draft === undefined) throw new Error('expected a draft');
    const unsealed = { ...draft, id: 1, createdAt: AT, prevHash: GENESIS_HASH };
    expect(() => computeHash('abc', { ...unsealed, prevHash: 'abc' })).toThrow(RangeError);
    expect(() => computeHash('1'.repeat(64), unsealed)).toThrow(RangeError);
    const opts = { prevHash: GENESIS_HASH, firstId: 1, createdAt: AT };
    expect(() => sealEntries([draft], { ...opts, firstId: 0 })).toThrow(RangeError);
    expect(() => sealEntries([draft], { ...opts, createdAt: 'yesterday' })).toThrow(RangeError);
    expect(() => sealEntries([{ ...draft, amountPaise: paise(0) }], opts)).toThrow(RangeError);
    expect(() => sealEntries([draft], { ...opts, prevHash: 'nope' })).toThrow(RangeError);
    const [entry] = sealEntries([draft], opts);
    if (entry === undefined) throw new Error('expected an entry');
    expect(verifyChain([{ ...entry, prevHash: 'nope' }], 'nope')).toEqual({
      ok: false,
      brokenAtId: 1,
    });
  });
});
