import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { listPlaceholders, parseStateRates } from './rates';

const seedFile = (name: string): string =>
  readFileSync(new URL(`../../../../data/seed/${name}`, import.meta.url), 'utf8');

/** Minimal valid file (synthetic values); `patch` swaps fragments to break it. */
const FIXTURE = `
state: { code: XX, name_key: state.XX, active: false, pincode_state_name: TESTLAND }
state_config:
  welfare_pct: 1
  platform_fee_pct: 1
  gst_pct_on_platform_fee: 1
  default_locale: en
  locales: [en]
  timezone: UTC
  is_placeholder: false
state_trade_rates:
  plumber: &r { wage_floor_per_hour_paise: 1, min_billable_minutes: 1, visit_charge_paise: 0, emergency_surcharge_pct: 0, is_placeholder: false }
  electrician: *r
  carpenter: *r
  painter: *r
  domestic_help: *r
  caregiver: *r
  driver: *r
  gardener: *r
  cleaner: *r
  technician: *r
`;

function fixture(patch: Record<string, string> = {}): string {
  return Object.entries(patch).reduce((acc, [from, to]) => acc.replace(from, to), FIXTURE);
}

describe('parseStateRates', () => {
  it('accepts the committed Kerala and Tamil Nadu files', () => {
    const kl = parseStateRates(seedFile('kerala_rates.yaml'), 'kerala_rates.yaml');
    const tn = parseStateRates(seedFile('tamilnadu_rates.yaml'), 'tamilnadu_rates.yaml');
    expect(kl.state).toEqual({
      code: 'KL',
      name_key: 'state.KL',
      active: true,
      pincode_state_name: 'KERALA',
    });
    expect(tn.state.pincode_state_name).toBe('TAMIL NADU');
    expect(tn.state.active).toBe(false);
    expect(Object.keys(kl.state_trade_rates)).toHaveLength(10);
  });

  it('accepts a minimal valid file', () => {
    expect(parseStateRates(fixture(), 'fixture').state.code).toBe('XX');
  });

  it('rejects an unfilled TODO_VERIFY in a numeric field', () => {
    expect(() =>
      parseStateRates(fixture({ 'welfare_pct: 1': "welfare_pct: 'TODO_VERIFY'" }), 'f'),
    ).toThrow(/state_config.welfare_pct/);
  });

  it('rejects a missing trade', () => {
    expect(() => parseStateRates(fixture({ '  technician: *r\n': '' }), 'f')).toThrow(
      /state_trade_rates\.technician/,
    );
  });

  it('rejects a default locale that is not listed, and unknown locales', () => {
    expect(() =>
      parseStateRates(fixture({ 'default_locale: en': 'default_locale: ml' }), 'f'),
    ).toThrow(/default_locale must be listed/);
    expect(() => parseStateRates(fixture({ 'locales: [en]': 'locales: [en, fr]' }), 'f')).toThrow(
      /locales/,
    );
  });

  it('rejects unknown keys and bad percentages', () => {
    expect(() =>
      parseStateRates(fixture({ 'timezone: UTC': 'timezone: UTC\n  extra: 1' }), 'f'),
    ).toThrow();
    expect(() => parseStateRates(fixture({ 'welfare_pct: 1': 'welfare_pct: 101' }), 'f')).toThrow();
  });
});

describe('listPlaceholders', () => {
  it('lists every flagged value in the committed Kerala file', () => {
    const kl = parseStateRates(seedFile('kerala_rates.yaml'), 'kerala_rates.yaml');
    const list = listPlaceholders(kl);
    expect(list).toContain('KL state_config');
    expect(list).toContain('KL state_trade_rates.electrician');
    expect(list).toHaveLength(11);
  });

  it('is empty when nothing is flagged', () => {
    expect(listPlaceholders(parseStateRates(fixture(), 'f'))).toEqual([]);
  });
});
