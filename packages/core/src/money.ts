/**
 * Money (AGENTS.md 5, 6.2): integer paise only, never floats. Percentages are
 * converted to exact integer hundredths of a percent (basis points) and applied
 * with BigInt arithmetic, rounding half-up to the paisa.
 */
import type { Locale } from '@kaithangu/i18n';

declare const paiseBrand: unique symbol;

/** Integer amount of paise (1 rupee = 100 paise), a safe integer. */
export type Paise = number & { readonly [paiseBrand]: 'Paise' };

/** A percentage as a number (5.25) or a Postgres numeric string ("5.25"). */
export type PercentInput = number | string;

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);

export function paise(value: number): Paise {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`paise must be a safe integer, got ${value}`);
  }
  return value as Paise;
}

export const ZERO_PAISE: Paise = paise(0);

/** Convert an exact BigInt result back to Paise, rejecting unsafe magnitudes. */
export function paiseFromBigInt(value: bigint): Paise {
  if (value > MAX_SAFE || value < MIN_SAFE) {
    throw new RangeError(`paise out of safe integer range: ${value}`);
  }
  return paise(Number(value));
}

export function addPaise(...values: readonly Paise[]): Paise {
  return paiseFromBigInt(values.reduce((sum, v) => sum + BigInt(v), 0n));
}

export function subPaise(a: Paise, b: Paise): Paise {
  return paiseFromBigInt(BigInt(a) - BigInt(b));
}

const PERCENT_STRING = /^(\d+)(?:\.(\d+))?$/;

/**
 * Exact hundredths of a percent: 5 → 500, "5.25" → 525. Rejects negatives,
 * non-finite values and more than two significant decimal places.
 */
export function percentToBasisPoints(pct: PercentInput): number {
  if (typeof pct === 'string') {
    const match = PERCENT_STRING.exec(pct.trim());
    const whole = match?.[1];
    const fraction = match?.[2] ?? '';
    if (whole === undefined || !/^\d{0,2}0*$/.test(fraction)) {
      throw new RangeError(`invalid percentage: "${pct}"`);
    }
    const bps = Number(whole) * 100 + Number(fraction.slice(0, 2).padEnd(2, '0'));
    if (!Number.isSafeInteger(bps)) {
      throw new RangeError(`invalid percentage: "${pct}"`);
    }
    return bps;
  }
  if (!Number.isFinite(pct) || pct < 0) {
    throw new RangeError(`invalid percentage: ${pct}`);
  }
  const scaled = pct * 100;
  const bps = Math.round(scaled);
  if (Math.abs(scaled - bps) > 1e-6 || !Number.isSafeInteger(bps)) {
    throw new RangeError(`percentage has more than two decimals: ${pct}`);
  }
  return bps;
}

/** round(amount × pct / 100), half-up to the paisa. `amount` must be ≥ 0. */
export function mulPct(amount: Paise, pct: PercentInput): Paise {
  if (amount < 0) {
    throw new RangeError(`mulPct: amount must be non-negative, got ${amount}`);
  }
  const bps = BigInt(percentToBasisPoints(pct));
  // floor(amount × bps / 10000 + 1/2) with exact integers.
  return paiseFromBigInt((2n * BigInt(amount) * bps + 10_000n) / 20_000n);
}

const INTL_LOCALE: Readonly<Record<Locale, string>> = {
  en: 'en-IN',
  ml: 'ml-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
};

const formatters = new Map<Locale, Intl.NumberFormat>();

function formatterFor(locale: Locale): Intl.NumberFormat {
  let formatter = formatters.get(locale);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat(INTL_LOCALE[locale], {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatters.set(locale, formatter);
  }
  return formatter;
}

/** Display an amount in rupees for the locale, e.g. 12345678 → "₹1,23,456.78" (en). */
export function formatINR(amount: Paise, locale: Locale): string {
  const value = BigInt(paise(amount));
  const negative = value < 0n;
  const abs = negative ? -value : value;
  // An exact decimal string, so no float conversion ever touches the amount.
  const decimal = `${negative ? '-' : ''}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
  return formatterFor(locale).format(decimal as `${number}`);
}
