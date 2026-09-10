import { describe, expect, it } from 'vitest';
import { isCertifiedRequired, isTradeCode, TRADE_CODES } from './trades';

describe('trades', () => {
  it('lists the ten canonical trades', () => {
    expect(TRADE_CODES).toEqual([
      'plumber',
      'electrician',
      'carpenter',
      'painter',
      'domestic_help',
      'caregiver',
      'driver',
      'gardener',
      'cleaner',
      'technician',
    ]);
  });

  it('requires certification only for electrician and technician', () => {
    const certified = TRADE_CODES.filter(isCertifiedRequired);
    expect(certified).toEqual(['electrician', 'technician']);
  });

  it('recognises trade codes', () => {
    expect(isTradeCode('plumber')).toBe(true);
    expect(isTradeCode('astronaut')).toBe(false);
  });
});
