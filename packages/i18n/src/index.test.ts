import { describe, expect, it } from 'vitest';
import { isSupportedLocale } from './index';

describe('isSupportedLocale', () => {
  it('accepts the four catalog locales and rejects others', () => {
    for (const locale of ['en', 'ml', 'hi', 'ta']) {
      expect(isSupportedLocale(locale)).toBe(true);
    }
    expect(isSupportedLocale('fr')).toBe(false);
    expect(isSupportedLocale('')).toBe(false);
  });
});
