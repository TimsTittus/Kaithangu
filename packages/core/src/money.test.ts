import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addPaise,
  formatINR,
  mulPct,
  paise,
  paiseFromBigInt,
  percentToBasisPoints,
  subPaise,
  ZERO_PAISE,
} from './money';

describe('paise', () => {
  it('accepts safe integers only', () => {
    expect(paise(0)).toBe(0);
    expect(paise(-250)).toBe(-250);
    expect(() => paise(1.5)).toThrow(RangeError);
    expect(() => paise(Number.NaN)).toThrow(RangeError);
    expect(() => paise(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });

  it('rejects BigInt results outside the safe range', () => {
    expect(paiseFromBigInt(42n)).toBe(42);
    expect(() => paiseFromBigInt(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(RangeError);
    expect(() => paiseFromBigInt(BigInt(Number.MIN_SAFE_INTEGER) - 1n)).toThrow(RangeError);
  });
});

describe('addPaise / subPaise', () => {
  it('adds and subtracts exactly', () => {
    expect(addPaise()).toBe(ZERO_PAISE);
    expect(addPaise(paise(100), paise(250), paise(-50))).toBe(300);
    expect(subPaise(paise(100), paise(250))).toBe(-150);
  });

  it('refuses to overflow the safe integer range', () => {
    const max = paise(Number.MAX_SAFE_INTEGER);
    expect(() => addPaise(max, paise(1))).toThrow(RangeError);
    expect(() => subPaise(paise(Number.MIN_SAFE_INTEGER), paise(1))).toThrow(RangeError);
  });
});

describe('percentToBasisPoints', () => {
  it('converts numbers and Postgres numeric strings exactly', () => {
    expect(percentToBasisPoints(5)).toBe(500);
    expect(percentToBasisPoints(5.25)).toBe(525);
    expect(percentToBasisPoints(0.29)).toBe(29);
    expect(percentToBasisPoints(100)).toBe(10000);
    expect(percentToBasisPoints('5.00')).toBe(500);
    expect(percentToBasisPoints('18')).toBe(1800);
    expect(percentToBasisPoints('0.5')).toBe(50);
    expect(percentToBasisPoints(' 12.340 ')).toBe(1234);
  });

  it('rejects negative, non-finite, malformed and over-precise values', () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, 5.125]) {
      expect(() => percentToBasisPoints(bad)).toThrow(RangeError);
    }
    for (const bad of ['', '-5', '5.125', 'abc', '5.', '.5', '1e2']) {
      expect(() => percentToBasisPoints(bad)).toThrow(RangeError);
    }
    expect(() => percentToBasisPoints('9'.repeat(20))).toThrow(RangeError);
  });
});

describe('mulPct', () => {
  it('rounds half-up to the paisa', () => {
    expect(mulPct(paise(10), 5)).toBe(1); // 0.5 → 1
    expect(mulPct(paise(9), 5)).toBe(0); // 0.45 → 0
    expect(mulPct(paise(30), 5)).toBe(2); // 1.5 → 2
    expect(mulPct(paise(29), 5)).toBe(1); // 1.45 → 1
    expect(mulPct(paise(15000), '5.00')).toBe(750);
    expect(mulPct(paise(750), 18)).toBe(135);
    expect(mulPct(paise(12345), 0)).toBe(0);
  });

  it('rejects negative amounts', () => {
    expect(() => mulPct(paise(-1), 5)).toThrow(RangeError);
  });

  it('equals the exact rational result rounded half-up (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        (amount, bps) => {
          const result = BigInt(mulPct(paise(amount), bps / 100));
          const exactTimes10000 = BigInt(amount) * BigInt(bps);
          // result - 1/2 <= exact < result + 1/2
          expect(result * 10000n - 5000n <= exactTimes10000).toBe(true);
          expect(exactTimes10000 < result * 10000n + 5000n).toBe(true);
        },
      ),
    );
  });
});

describe('formatINR', () => {
  it('formats with Indian digit grouping in English', () => {
    expect(formatINR(paise(12345678), 'en')).toBe('₹1,23,456.78');
    expect(formatINR(paise(5), 'en')).toBe('₹0.05');
    expect(formatINR(paise(0), 'en')).toBe('₹0.00');
    expect(formatINR(paise(-15050), 'en')).toBe('-₹150.50');
  });

  it('uses the -IN variant of every supported locale', () => {
    for (const [locale, tag] of [
      ['ml', 'ml-IN'],
      ['hi', 'hi-IN'],
      ['ta', 'ta-IN'],
    ] as const) {
      const expected = new Intl.NumberFormat(tag, {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(123456.78);
      expect(formatINR(paise(12345678), locale)).toBe(expected);
    }
  });

  it('formats amounts beyond float precision exactly', () => {
    // 9007199254740991 paise = Rs 90071992547409.91
    expect(formatINR(paise(Number.MAX_SAFE_INTEGER), 'en')).toBe('₹9,00,71,99,25,47,409.91');
  });

  it('rejects non-integer input', () => {
    expect(() => formatINR(1.5 as never, 'en')).toThrow(RangeError);
  });
});
