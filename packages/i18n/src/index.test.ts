import { describe, expect, it } from 'vitest';
import { catalogs, hasMessage, isSupportedLocale, messageKeys, SUPPORTED_LOCALES } from './index';

describe('catalogs', () => {
  const englishKeys = messageKeys(catalogs.en);

  it('has a catalog for every supported locale with exactly the English keys', () => {
    expect(englishKeys.length).toBeGreaterThan(0);
    for (const locale of SUPPORTED_LOCALES) {
      expect(messageKeys(catalogs[locale]), locale).toEqual(englishKeys);
    }
  });

  it('has no empty messages', () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of messageKeys(catalogs[locale])) {
        expect(hasMessage(locale, key), `${locale}:${key}`).toBe(true);
      }
    }
  });

  it('resolves leaf keys only', () => {
    expect(hasMessage('ml', 'trade.plumber')).toBe(true);
    expect(hasMessage('en', 'trade')).toBe(false);
    expect(hasMessage('en', 'trade.astronaut')).toBe(false);
    expect(hasMessage('en', 'trade.plumber.extra')).toBe(false);
  });
});

describe('messageKeys', () => {
  it('flattens nested catalogs into sorted dot paths', () => {
    expect(messageKeys({ b: 'x', a: { d: 'y', c: 'z' } })).toEqual(['a.c', 'a.d', 'b']);
  });
});

describe('isSupportedLocale', () => {
  it('accepts the four catalog locales and rejects others', () => {
    for (const locale of ['en', 'ml', 'hi', 'ta']) {
      expect(isSupportedLocale(locale)).toBe(true);
    }
    expect(isSupportedLocale('fr')).toBe(false);
    expect(isSupportedLocale('')).toBe(false);
  });
});
