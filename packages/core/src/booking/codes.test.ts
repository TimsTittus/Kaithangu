import { describe, expect, it } from 'vitest';
import { deriveJobOtp, workerCheckCode } from './codes';

const SECRET = 'test-only-code-secret-0123456789abcdef';
const BOOKING = '5b1f7a52-4a4c-4a53-9f3e-0d1d2a3b4c5d';
const OTHER = '6c2e8b63-5b5d-4b64-8a4f-1e2e3b4c5d6e';

describe('deriveJobOtp', () => {
  it('is a deterministic 4-digit code per booking and kind', () => {
    const start = deriveJobOtp(SECRET, BOOKING, 'start');
    expect(start).toMatch(/^\d{4}$/);
    expect(deriveJobOtp(SECRET, BOOKING, 'start')).toBe(start);
    expect(deriveJobOtp(SECRET, BOOKING, 'complete')).toMatch(/^\d{4}$/);
  });

  it('depends on the secret, the booking and the kind', () => {
    const codes = new Set(
      Array.from({ length: 50 }, (_, i) => deriveJobOtp(SECRET, `${BOOKING}-${i}`, 'start')),
    );
    expect(codes.size).toBeGreaterThan(40);
    const a = [deriveJobOtp(SECRET, BOOKING, 'start'), deriveJobOtp(SECRET, OTHER, 'start')];
    const b = [
      deriveJobOtp(`${SECRET}-other`, BOOKING, 'start'),
      deriveJobOtp(SECRET, BOOKING, 'complete'),
    ];
    // Different inputs are not all equal (collisions are possible for 4 digits, not for all).
    expect(new Set([...a, ...b]).size).toBeGreaterThan(1);
  });

  it('refuses a short secret', () => {
    expect(() => deriveJobOtp('short', BOOKING, 'start')).toThrow(RangeError);
  });
});

describe('workerCheckCode', () => {
  it('is a 6-digit code that changes with the worker key version', () => {
    const input = { bookingId: BOOKING, workerId: OTHER, keyVersion: 1 };
    const code = workerCheckCode(SECRET, input);
    expect(code).toMatch(/^\d{6}$/);
    expect(workerCheckCode(SECRET, input)).toBe(code);
    const rotated = Array.from({ length: 5 }, (_, i) =>
      workerCheckCode(SECRET, { ...input, keyVersion: i + 2 }),
    );
    expect(rotated.some((other) => other !== code)).toBe(true);
  });
});
