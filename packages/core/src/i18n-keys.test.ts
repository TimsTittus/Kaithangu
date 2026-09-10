import { catalogs, hasMessage, SUPPORTED_LOCALES, type Catalog } from '@kaithangu/i18n';
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, errorMessageKey } from './errors';
import { SCORE_FACTORS } from './matching/score';
import { PRICING_LINE_KEYS } from './pricing';

// AGENTS.md 7: no user-facing strings in code. Every key core hands to the UI
// or voice layer must exist in every locale.
function message(catalog: Catalog, key: string): string {
  let node: string | Catalog | undefined = catalog;
  for (const part of key.split('.')) {
    node = typeof node === 'object' ? node[part] : undefined;
  }
  if (typeof node !== 'string') throw new Error(`missing ${key}`);
  return node;
}

const EXPLANATION_PARAMS: Record<(typeof SCORE_FACTORS)[number], string[]> = {
  proximity: ['{distanceKm}'],
  skill: ['{skillLevel}'],
  rating: ['{rating}'],
  fairness: [],
};

describe('i18n keys used by core', () => {
  it.each(SUPPORTED_LOCALES)('%s has every error and pricing message', (locale) => {
    for (const code of ERROR_CODES) {
      expect(hasMessage(locale, errorMessageKey(code)), code).toBe(true);
    }
    for (const key of Object.values(PRICING_LINE_KEYS)) {
      expect(hasMessage(locale, key), key).toBe(true);
    }
  });

  it.each(SUPPORTED_LOCALES)('%s has every "why this worker" message with its params', (locale) => {
    for (const factor of SCORE_FACTORS) {
      const text = message(catalogs[locale], `matching.why.${factor}`);
      for (const param of EXPLANATION_PARAMS[factor]) {
        expect(text, `${locale} matching.why.${factor}`).toContain(param);
      }
    }
  });
});
