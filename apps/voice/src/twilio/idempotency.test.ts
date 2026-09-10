import { describe, expect, it } from 'vitest';
import { nextMeta, replayIfDuplicate, requestFingerprint } from './idempotency';

describe('requestFingerprint', () => {
  it('is stable regardless of key order', () => {
    const a = requestFingerprint({ Digits: '1', CallSid: 'CA1' });
    const b = requestFingerprint({ CallSid: 'CA1', Digits: '1' });
    expect(a).toBe(b);
  });

  it('differs when a value differs', () => {
    const a = requestFingerprint({ Digits: '1' });
    const b = requestFingerprint({ Digits: '2' });
    expect(a).not.toBe(b);
  });
});

describe('replayIfDuplicate / nextMeta', () => {
  it('has no cached replay on the first request', () => {
    expect(replayIfDuplicate(undefined, requestFingerprint({ Digits: '1' }))).toBeNull();
  });

  it('replays the same TwiML for a retried (identical) webhook', () => {
    const fp = requestFingerprint({ Digits: '1', CallSid: 'CA1' });
    const meta = nextMeta(undefined, fp, '<Response>first</Response>');
    expect(meta.turnIndex).toBe(1);
    expect(replayIfDuplicate(meta, fp)).toBe('<Response>first</Response>');
  });

  it('does not replay for a genuinely new request', () => {
    const meta = nextMeta(undefined, requestFingerprint({ Digits: '1' }), '<Response>first</Response>');
    expect(replayIfDuplicate(meta, requestFingerprint({ Digits: '2' }))).toBeNull();
  });

  it('increments turnIndex across distinct turns', () => {
    let meta = nextMeta(undefined, requestFingerprint({ Digits: '1' }), '<Response>a</Response>');
    meta = nextMeta(meta, requestFingerprint({ Digits: '2' }), '<Response>b</Response>');
    expect(meta.turnIndex).toBe(2);
  });
});
