import { describe, expect, it } from 'vitest';
import {
  catalogs,
  formatMessage,
  getMessage,
  hasMessage,
  isSupportedLocale,
  messageKeys,
  SUPPORTED_LOCALES,
} from './index';

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

describe('getMessage / formatMessage', () => {
  it('returns leaf messages only', () => {
    expect(getMessage('en', 'trade.plumber')).toBe('Plumber');
    expect(getMessage('en', 'trade')).toBeUndefined();
    expect(getMessage('en', 'nope.nope')).toBeUndefined();
  });

  it('substitutes {name} placeholders', () => {
    expect(formatMessage('en', 'auth.verify_hint', { phone: '+91******3210' })).toBe(
      'We sent a 6-digit code to +91******3210.',
    );
    expect(formatMessage('en', 'auth.digit_label', { n: 2 })).toBe('Digit 2 of 6');
  });

  it('throws on a missing key or parameter', () => {
    expect(() => formatMessage('en', 'auth.missing')).toThrow(/missing message/);
    expect(() => formatMessage('en', 'auth.verify_hint')).toThrow(/\{phone\}/);
  });
});

describe('consent and language messages', () => {
  it('uses one consent version across locales', () => {
    const versions = SUPPORTED_LOCALES.map((locale) => getMessage(locale, 'consent.version'));
    expect(new Set(versions).size).toBe(1);
  });

  it('shows each language name in its own script in every catalog', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(getMessage(locale, 'language.name.ml')).toBe('മലയാളം');
      expect(getMessage(locale, 'language.name.en')).toBe('English');
      expect(getMessage(locale, 'language.name.hi')).toBe('हिन्दी');
      expect(getMessage(locale, 'language.name.ta')).toBe('தமிழ்');
    }
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
