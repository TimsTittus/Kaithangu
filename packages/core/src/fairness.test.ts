import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { gini, median, zeroJobShare } from './fairness';

describe('median', () => {
  it('handles empty, odd and even inputs without mutating them', () => {
    expect(median([])).toBe(0);
    expect(median([7])).toBe(7);
    const values = [9, 1, 5];
    expect(median(values)).toBe(5);
    expect(values).toEqual([9, 1, 5]);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([0, 0, 0, 100])).toBe(0);
  });

  it('rejects non-finite values', () => {
    expect(() => median([1, Number.NaN])).toThrow(RangeError);
  });
});

describe('gini', () => {
  it('is 0 for empty, all-equal and all-zero inputs', () => {
    expect(gini([])).toBe(0);
    expect(gini([0, 0, 0])).toBe(0);
    expect(gini([500, 500, 500, 500])).toBe(0);
    expect(gini([123])).toBe(0);
  });

  it('is (n − 1) / n when one worker has everything', () => {
    for (const n of [2, 3, 5, 10, 100]) {
      const values = Array.from({ length: n }, (_, i) => (i === 0 ? 98765 : 0));
      expect(gini(values)).toBeCloseTo((n - 1) / n, 12);
    }
  });

  it('matches the mean-absolute-difference definition', () => {
    // Σ|xi − xj| over ordered pairs = 2 × (1 + 2 + 3 + 1 + 2 + 1) = 20; 2 n² mean = 2 × 16 × 2.5 = 80
    expect(gini([1, 2, 3, 4])).toBeCloseTo(0.25, 12);
  });

  it('does not depend on order and stays within [0, 1] (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 10_000_000 }), { maxLength: 60 }),
        (values) => {
          const g = gini(values);
          expect(g).toBeGreaterThanOrEqual(0);
          expect(g).toBeLessThanOrEqual(1);
          expect(gini([...values].reverse())).toBe(g);
        },
      ),
    );
  });

  it('rejects negative or fractional amounts', () => {
    expect(() => gini([1, -1])).toThrow(RangeError);
    expect(() => gini([1.5])).toThrow(RangeError);
  });
});

describe('zeroJobShare', () => {
  it('returns the share of workers with no jobs', () => {
    expect(zeroJobShare([])).toBe(0);
    expect(zeroJobShare([0, 3, 0, 1])).toBe(0.5);
    expect(zeroJobShare([2, 2])).toBe(0);
    expect(zeroJobShare([0])).toBe(1);
  });

  it('rejects invalid counts', () => {
    expect(() => zeroJobShare([-1])).toThrow(RangeError);
  });
});
