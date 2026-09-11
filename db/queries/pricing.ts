import type { TradeCode } from '@/lib/core';
import { and, eq } from 'drizzle-orm';
import type { Database } from '..';
import { stateConfig, stateTradeRates } from '../schema';

export type StateConfigRow = typeof stateConfig.$inferSelect;
export type StateTradeRateRow = typeof stateTradeRates.$inferSelect;

export interface PricingInputs {
  stateConfig: StateConfigRow;
  rates: StateTradeRateRow;
}

/**
 * The state_config row and state_trade_rates row that core's quote() needs
 * (AGENTS.md 6.2), or null when either is not configured for the state.
 */
export async function loadPricingInputs(
  db: Database,
  stateCode: string,
  tradeCode: TradeCode,
): Promise<PricingInputs | null> {
  const [config] = await db
    .select()
    .from(stateConfig)
    .where(eq(stateConfig.stateCode, stateCode))
    .limit(1);
  const [rates] = await db
    .select()
    .from(stateTradeRates)
    .where(and(eq(stateTradeRates.stateCode, stateCode), eq(stateTradeRates.tradeCode, tradeCode)))
    .limit(1);
  if (config === undefined || rates === undefined) return null;
  return { stateConfig: config, rates };
}
