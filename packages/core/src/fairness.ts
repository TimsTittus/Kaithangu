/**
 * Fairness metrics (AGENTS.md 6.3, 6.8). Earnings are 30-day wage totals in
 * integer paise among verified workers of one society (optionally one trade).
 * gini() is computed with exact integer arithmetic so equal earnings give
 * exactly 0 and the result is always within [0, 1].
 */

function assertNonNegativeIntegers(name: string, values: readonly number[]): void {
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`${name}: values must be non-negative safe integers, got ${value}`);
    }
  }
}

/** Median (mean of the two middle values for an even count); [] → 0. */
export function median(values: readonly number[]): number {
  for (const value of values) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`median: values must be finite, got ${value}`);
    }
  }
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? 0;
  if (sorted.length % 2 === 1) return upper;
  const lower = sorted[mid - 1] ?? 0;
  return (lower + upper) / 2;
}

/**
 * Gini coefficient of non-negative integer amounts; [] and all-zero → 0.
 * G = (2 Σ i·x₍ᵢ₎) / (n Σ x) − (n + 1) / n, with x sorted ascending, i = 1..n.
 */
export function gini(values: readonly number[]): number {
  assertNonNegativeIntegers('gini', values);
  const n = BigInt(values.length);
  const sorted = values.map(BigInt).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const total = sorted.reduce((sum, v) => sum + v, 0n);
  if (total === 0n) return 0;
  const weighted = sorted.reduce((sum, v, index) => sum + BigInt(index + 1) * v, 0n);
  const numerator = 2n * weighted - (n + 1n) * total;
  const denominator = n * total;
  return Number(numerator) / Number(denominator);
}

/** Share (0..1) of workers with zero jobs in the period; [] → 0. */
export function zeroJobShare(jobCounts: readonly number[]): number {
  assertNonNegativeIntegers('zeroJobShare', jobCounts);
  if (jobCounts.length === 0) return 0;
  return jobCounts.filter((count) => count === 0).length / jobCounts.length;
}
