import { describe, expect, it } from 'vitest';
import { computeTwilioSignature, isValidTwilioSignature } from './signature';

const AUTH_TOKEN = 'test-auth-token';
const URL = 'https://voice.example.com/twilio/voice/incoming';
const PARAMS = { CallSid: 'CA123', From: '+919999999999', To: '+911234567890' };

describe('twilio signature validation', () => {
  it('accepts a correctly computed signature', () => {
    const signature = computeTwilioSignature(AUTH_TOKEN, URL, PARAMS);
    expect(isValidTwilioSignature(AUTH_TOKEN, URL, PARAMS, signature)).toBe(true);
  });

  it('rejects a tampered signature', () => {
    const signature = computeTwilioSignature(AUTH_TOKEN, URL, PARAMS);
    const tampered = signature.slice(0, -1) + (signature.endsWith('A') ? 'B' : 'A');
    expect(isValidTwilioSignature(AUTH_TOKEN, URL, PARAMS, tampered)).toBe(false);
  });

  it('rejects when params were tampered with after signing', () => {
    const signature = computeTwilioSignature(AUTH_TOKEN, URL, PARAMS);
    const tamperedParams = { ...PARAMS, To: '+910000000000' };
    expect(isValidTwilioSignature(AUTH_TOKEN, URL, tamperedParams, signature)).toBe(false);
  });

  it('rejects when the URL does not match what was signed', () => {
    const signature = computeTwilioSignature(AUTH_TOKEN, URL, PARAMS);
    expect(isValidTwilioSignature(AUTH_TOKEN, `${URL}/other`, PARAMS, signature)).toBe(false);
  });

  it('rejects a missing signature', () => {
    expect(isValidTwilioSignature(AUTH_TOKEN, URL, PARAMS, undefined)).toBe(false);
  });
});
