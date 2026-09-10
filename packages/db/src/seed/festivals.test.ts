import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { festivalNameKey, parseFestivals } from './festivals';

const committed = readFileSync(
  new URL('../../../../data/seed/festivals.yaml', import.meta.url),
  'utf8',
);

// Synthetic festival; not a real event or date.
const one = (start: string, end: string, extra = '') => `
festivals:
  - name: "Test Fest"
    malayalamName: "ടെസ്റ്റ്"
    startDate: "${start}"
    endDate: "${end}"${extra}
`;

describe('festivalNameKey', () => {
  it('slugifies names into i18n keys', () => {
    expect(festivalNameKey('Eid al-Fitr')).toBe('festival.eid_al_fitr');
    expect(festivalNameKey('  Chingam Wedding Season ')).toBe('festival.chingam_wedding_season');
  });

  it('rejects names without ASCII letters', () => {
    expect(() => festivalNameKey('ഓണം')).toThrow(/no ASCII/);
  });
});

describe('parseFestivals', () => {
  it('reads the committed file with unique keys', () => {
    const festivals = parseFestivals(committed, 'festivals.yaml');
    expect(festivals.length).toBeGreaterThan(0);
    const keys = festivals.map((f) => f.nameKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const f of festivals) {
      expect(f.names.ml.length).toBeGreaterThan(0);
      expect(f.endDate >= f.startDate).toBe(true);
    }
  });

  it('defaults is_placeholder to false and honours an explicit flag', () => {
    expect(parseFestivals(one('2030-01-01', '2030-01-02'), 'f')[0]?.isPlaceholder).toBe(false);
    expect(
      parseFestivals(one('2030-01-01', '2030-01-02', '\n    is_placeholder: true'), 'f')[0]
        ?.isPlaceholder,
    ).toBe(true);
  });

  it('rejects reversed and malformed dates', () => {
    expect(() => parseFestivals(one('2030-01-02', '2030-01-01'), 'f')).toThrow(/before startDate/);
    expect(() => parseFestivals(one('2030-13-45', '2030-13-46'), 'f')).toThrow(/invalid date/);
    expect(() => parseFestivals(one('1 Jan', '2 Jan'), 'f')).toThrow();
  });
});
