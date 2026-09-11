import { readFileSync } from 'node:fs';
import { percentToBasisPoints, TRADE_CODES } from '@/lib/core';
import type { stateConfig, states, stateTradeRates } from '../schema';
import { parseStateRates, type StateRatesFile } from './rates';

/** Per-state rate files in data/seed (states, state_config, state_trade_rates). */
export const RATE_FILES = ['kerala_rates.yaml', 'tamilnadu_rates.yaml'] as const;

export function loadRateFiles(): StateRatesFile[] {
  return RATE_FILES.map((name) =>
    parseStateRates(
      readFileSync(new URL(`../../../data/seed/${name}`, import.meta.url), 'utf8'),
      `data/seed/${name}`,
    ),
  );
}

/**
 * numeric(5,2) text for a percentage, exactly: 5 → "5.00", 12.5 → "12.50".
 * More than two decimals is rejected instead of being rounded by Postgres.
 */
export function toNumericPct(pct: number): string {
  const bps = percentToBasisPoints(pct);
  return `${Math.trunc(bps / 100)}.${String(bps % 100).padStart(2, '0')}`;
}

export interface StateRows {
  states: (typeof states.$inferInsert)[];
  stateConfigs: (typeof stateConfig.$inferInsert)[];
  stateTradeRates: (typeof stateTradeRates.$inferInsert)[];
}

export function buildStateRows(files: readonly StateRatesFile[]): StateRows {
  const rows: StateRows = { states: [], stateConfigs: [], stateTradeRates: [] };
  const seen = new Set<string>();
  for (const file of files) {
    const code = file.state.code;
    if (seen.has(code)) throw new Error(`duplicate rates file for state ${code}`);
    seen.add(code);

    rows.states.push({ code, nameKey: file.state.name_key, active: file.state.active });
    const config = file.state_config;
    rows.stateConfigs.push({
      stateCode: code,
      welfarePct: toNumericPct(config.welfare_pct),
      platformFeePct: toNumericPct(config.platform_fee_pct),
      gstPctOnPlatformFee: toNumericPct(config.gst_pct_on_platform_fee),
      defaultLocale: config.default_locale,
      locales: [...config.locales],
      timezone: config.timezone,
      isPlaceholder: config.is_placeholder,
    });
    for (const trade of TRADE_CODES) {
      const rate = file.state_trade_rates[trade];
      if (rate === undefined) throw new Error(`${code}: missing rate for ${trade}`);
      rows.stateTradeRates.push({
        stateCode: code,
        tradeCode: trade,
        wageFloorPerHourPaise: rate.wage_floor_per_hour_paise,
        minBillableMinutes: rate.min_billable_minutes,
        visitChargePaise: rate.visit_charge_paise,
        emergencySurchargePct: toNumericPct(rate.emergency_surcharge_pct),
        isPlaceholder: rate.is_placeholder,
      });
    }
  }
  return rows;
}
