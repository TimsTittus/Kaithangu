import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { generateOtp, hashOtp, JOB_OTP_DIGITS, OTP_MAX_ATTEMPTS, verifyOtp } from './otp';

// Test-only pepper; the real one comes from env OTP_PEPPER.
const PEPPER = 'test-pepper-not-a-secret';

describe('generateOtp', () => {
  it('returns 4 digits by default (job OTPs) with at most 5 attempts', () => {
    expect(JOB_OTP_DIGITS).toBe(4);
    expect(OTP_MAX_ATTEMPTS).toBe(5);
    for (let i = 0; i < 200; i++) {
      expect(generateOtp()).toMatch(/^\d{4}$/);
    }
  });

  it('honours the requested length and keeps leading zeros', () => {
    expect(generateOtp(6)).toMatch(/^\d{6}$/);
    expect(generateOtp(10)).toMatch(/^\d{10}$/);
    const seen = new Set(Array.from({ length: 2000 }, () => generateOtp(4)));
    // 2000 draws from 10 000 values: many distinct codes, some starting with 0.
    expect(seen.size).toBeGreaterThan(1500);
    expect([...seen].some((code) => code.startsWith('0'))).toBe(true);
  });

  it('rejects unsupported lengths', () => {
    for (const digits of [0, 3, 11, 4.5]) {
      expect(() => generateOtp(digits)).toThrow(RangeError);
    }
  });
});

describe('hashOtp / verifyOtp', () => {
  it('is HMAC-SHA-256 keyed with the pepper, never the raw OTP', () => {
    const hash = hashOtp('0421', PEPPER);
    expect(hash).toBe(createHmac('sha256', PEPPER).update('0421').digest('hex'));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('0421');
    expect(hashOtp('0421', 'another-pepper')).not.toBe(hash);
  });

  it('verifies the right OTP and rejects everything else', () => {
    const hash = hashOtp('0421', PEPPER);
    expect(verifyOtp('0421', hash, PEPPER)).toBe(true);
    expect(verifyOtp('0422', hash, PEPPER)).toBe(false);
    expect(verifyOtp('421', hash, PEPPER)).toBe(false);
    expect(verifyOtp('0421', hash, 'another-pepper')).toBe(false);
    expect(verifyOtp('04a1', hash, PEPPER)).toBe(false);
    expect(verifyOtp('', hash, PEPPER)).toBe(false);
    expect(verifyOtp('0421', 'not-hex', PEPPER)).toBe(false);
    expect(verifyOtp('0421', hash.slice(0, 32), PEPPER)).toBe(false);
  });

  it('rejects an empty pepper and non-digit OTPs when hashing', () => {
    expect(() => hashOtp('1234', '')).toThrow(RangeError);
    expect(() => verifyOtp('1234', 'ab', '')).toThrow(RangeError);
    expect(() => hashOtp('12 34', PEPPER)).toThrow(RangeError);
  });
});
