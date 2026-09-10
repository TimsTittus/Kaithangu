import { describe, expect, it } from 'vitest';
import { resolveAdapterMode } from './index';

describe('resolveAdapterMode', () => {
  it('defaults to mock when nothing is set', () => {
    expect(resolveAdapterMode({}, 'payments')).toBe('mock');
  });

  it('falls back to ADAPTER_MODE when the per-adapter var is unset or empty', () => {
    expect(resolveAdapterMode({ ADAPTER_MODE: 'real' }, 'sms')).toBe('real');
    expect(resolveAdapterMode({ ADAPTER_MODE: 'real', SMS_MODE: '' }, 'sms')).toBe('real');
  });

  it('lets the per-adapter override win', () => {
    expect(resolveAdapterMode({ ADAPTER_MODE: 'real', PAYMENTS_MODE: 'mock' }, 'payments')).toBe(
      'mock',
    );
  });

  it('rejects unknown modes', () => {
    expect(() => resolveAdapterMode({ ADAPTER_MODE: 'live' }, 'llm')).toThrow();
  });
});
