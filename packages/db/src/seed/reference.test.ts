import { readFileSync } from 'node:fs';
import { hasMessage, SUPPORTED_LOCALES } from '@kaithangu/i18n';
import { describe, expect, it } from 'vitest';
import { parseFestivals } from './festivals';
import { parseStateRates } from './rates';
import { TRADE_ROWS, WELFARE_SCHEME_ROWS } from './reference';

const seedFile = (name: string): string =>
  readFileSync(new URL(`../../../../data/seed/${name}`, import.meta.url), 'utf8');

describe('reference seed rows', () => {
  it('seeds the ten trades with certification only for electrician and technician', () => {
    expect(TRADE_ROWS).toHaveLength(10);
    expect(TRADE_ROWS.filter((t) => t.certifiedRequired).map((t) => t.code)).toEqual([
      'electrician',
      'technician',
    ]);
    expect(new Set(TRADE_ROWS.map((t) => t.sortOrder)).size).toBe(10);
  });

  it('marks every welfare scheme as a placeholder with empty rules', () => {
    for (const scheme of WELFARE_SCHEME_ROWS) {
      expect(scheme.isPlaceholder).toBe(true);
      expect(scheme.rules).toEqual({});
    }
  });

  it('has an i18n message in every locale for every seeded name key', () => {
    const keys = [
      ...TRADE_ROWS.map((t) => `trade.${t.code}`),
      ...WELFARE_SCHEME_ROWS.map((s) => s.nameKey),
      ...['kerala_rates.yaml', 'tamilnadu_rates.yaml'].map(
        (f) => parseStateRates(seedFile(f), f).state.name_key,
      ),
      ...parseFestivals(seedFile('festivals.yaml'), 'festivals.yaml').map((f) => f.nameKey),
    ];
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of keys) {
        expect(hasMessage(locale, key), `${locale}:${key}`).toBe(true);
      }
    }
  });
});
