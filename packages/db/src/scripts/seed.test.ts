import { describe, expect, it } from 'vitest';
import { TRADE_ROWS } from '../seed/reference';
import { buildStateRows, loadRateFiles } from '../seed/stateRows';
import { previewReferenceData } from './seed';

// previewReferenceData only builds SQL; this URL is never connected to.
const UNUSED_URL = 'postgres://preview@localhost:1/never_connected';

describe('db:seed statements', () => {
  const rows = buildStateRows(loadRateFiles());

  it('upserts states, trades, state_config, state_trade_rates in FK order', async () => {
    const statements = await previewReferenceData(UNUSED_URL);
    expect(statements.map((s) => /^insert into "([a-z_]+)"/.exec(s.sql)?.[1])).toEqual([
      'states',
      'trades',
      'state_config',
      'state_trade_rates',
    ]);
    for (const { sql } of statements) {
      expect(sql).toMatch(/ on conflict \(.+\) do update set /);
    }
    expect(statements[3]?.sql).toContain('on conflict ("state_code","trade_code")');
  });

  it('binds every seeded value as a parameter (no values inlined)', async () => {
    const [statesSql, tradesSql, configSql, ratesSql] = await previewReferenceData(UNUSED_URL);
    expect(statesSql?.params).toHaveLength(rows.states.length * 3);
    expect(tradesSql?.params).toHaveLength(TRADE_ROWS.length * 4);
    expect(configSql?.params).toHaveLength(rows.stateConfigs.length * 8);
    expect(ratesSql?.params).toHaveLength(rows.stateTradeRates.length * 7);
    expect(ratesSql?.sql).not.toContain('plumber');
    expect(ratesSql?.params).toContain('plumber');
  });
});
