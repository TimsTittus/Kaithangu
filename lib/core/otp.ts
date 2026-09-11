/**
 * One-time passwords (AGENTS.md 5, 6.6). OTPs are generated with a CSPRNG and
 * only their hashes are stored: HMAC-SHA-256 keyed with the server pepper
 * (env OTP_PEPPER), hex encoded. Verification is constant-time. Job OTPs are
 * 4 digits with at most OTP_MAX_ATTEMPTS tries before the booking is locked.
 */
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const JOB_OTP_DIGITS = 4;
export const OTP_MAX_ATTEMPTS = 5;

const MIN_DIGITS = 4;
const MAX_DIGITS = 10;
const DIGITS_ONLY = /^\d+$/;

/** Uniformly random numeric code with exactly `digits` digits (leading zeros kept). */
export function generateOtp(digits: number = JOB_OTP_DIGITS): string {
  if (!Number.isInteger(digits) || digits < MIN_DIGITS || digits > MAX_DIGITS) {
    throw new RangeError(`OTP digits must be an integer in [${MIN_DIGITS}, ${MAX_DIGITS}]`);
  }
  return randomInt(0, 10 ** digits)
    .toString()
    .padStart(digits, '0');
}

function assertPepper(pepper: string): void {
  if (pepper === '') {
    throw new RangeError('OTP pepper must not be empty');
  }
}

export function hashOtp(otp: string, pepper: string): string {
  assertPepper(pepper);
  if (!DIGITS_ONLY.test(otp)) {
    throw new RangeError('OTP must contain digits only');
  }
  return createHmac('sha256', pepper).update(otp).digest('hex');
}

/** Constant-time comparison of `otp` against a stored hash; malformed input → false. */
export function verifyOtp(otp: string, storedHash: string, pepper: string): boolean {
  assertPepper(pepper);
  if (!DIGITS_ONLY.test(otp)) return false;
  const expected = Buffer.from(storedHash, 'hex');
  const actual = Buffer.from(hashOtp(otp, pepper), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
