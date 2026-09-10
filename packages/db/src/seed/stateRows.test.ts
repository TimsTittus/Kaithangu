import { TRADE_CODES } from '@kaithangu/core';
import { describe, expect, it } from 'vitest';
import { buildStateRows, loadRateFiles, toNumericPct } from './stateRows';

describe('toNumericPct', () => {
  it('formats percentages exactly with two decimals', () => {
    expect(toNumericPct(5)).toBe('5.00');
    expect(toNumericPct(12.5)).toBe('12.50');
    expect(toNumericPct(0.29)).toBe('0.29');
    expect(toNumericPct(100)).toBe('100.00');
    expect(toNumericPct(0)).toBe('0.00');
  });

  it('rejects values Postgres would silently round', () => {
    expect(() => toNumericPct(5.125)).toThrow(RangeError);
  });
});

describe('buildStateRows (committed rate files)', () => {
  const files = loadRateFiles();
  const rows = buildStateRows(files);

  it('produces one state and config per file and a rate per trade', () => {
    expect(rows.states.map((s) => s.code)).toEqual(files.map((f) => f.state.code));
    expect(rows.stateConfigs).toHaveLength(files.length);
    expect(rows.stateTradeRates).toHaveLength(files.length * TRADE_CODES.length);
  });

  it('copies each file field for field, percentages as numeric text', () => {
    for (const file of files) {
      const code = file.state.code;
      expect(rows.states).toContainEqual({
        code,
        nameKey: file.state.name_key,
        active: file.state.active,
      });
      const config = rows.stateConfigs.find((c) => c.stateCode === code);
      expect(config).toEqual({
        stateCode: code,
        welfarePct: toNumericPct(file.state_config.welfare_pct),
        platformFeePct: toNumericPct(file.state_config.platform_fee_pct),
        gstPctOnPlatformFee: toNumericPct(file.state_config.gst_pct_on_platform_fee),
        defaultLocale: file.state_config.default_locale,
        locales: file.state_config.locales,
        timezone: file.state_config.timezone,
        isPlaceholder: file.state_config.is_placeholder,
      });
      for (const trade of TRADE_CODES) {
        const source = file.state_trade_rates[trade];
        const row = rows.stateTradeRates.find((r) => r.stateCode === code && r.tradeCode === trade);
        expect(row).toEqual({
          stateCode: code,
          tradeCode: trade,
          wageFloorPerHourPaise: source?.wage_floor_per_hour_paise,
          minBillableMinutes: source?.min_billable_minutes,
          visitChargePaise: source?.visit_charge_paise,
          emergencySurchargePct: toNumericPct(source?.emergency_surcharge_pct ?? Number.NaN),
          isPlaceholder: source?.is_placeholder,
        });
      }
    }
  });

  it('rejects two files for the same state', () => {
    const [first] = files;
    if (first === undefined) throw new Error('expected rate files');
    expect(() => buildStateRows([first, first])).toThrow(/duplicate/);
  });
});
