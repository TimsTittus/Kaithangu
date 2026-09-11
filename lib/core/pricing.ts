/**
 * Pricing (AGENTS.md 6.2). Rates and percentages come from state_trade_rates and
 * state_config; nothing is hardcoded here.
 *   billable_minutes = max(min_billable_minutes, estimated_minutes)
 *   wage = ceil(billable_minutes × wage_floor_per_hour_paise / 60) + visit_charge_paise
 *   emergency: surcharge = round(wage × emergency_surcharge_pct / 100); wage += surcharge
 *     (the surcharge goes 100% to the worker, so the returned `wage` includes it)
 *   welfare = round(wage × welfare_pct / 100)
 *   platform_fee = round(wage × platform_fee_pct / 100)
 *   gst = institution only: round(platform_fee × gst_pct_on_platform_fee / 100)
 *   total = wage + welfare + platform_fee + gst
 * round = half-up to the paisa (money.ts). Welfare is added on top, never deducted.
 */
import {
  addPaise,
  mulPct,
  paise,
  paiseFromBigInt,
  ZERO_PAISE,
  type Paise,
  type PercentInput,
} from './money';

export type Urgency = 'normal' | 'emergency';

/** A state_trade_rates row (field names match the Drizzle schema). */
export interface TradeRates {
  wageFloorPerHourPaise: number;
  minBillableMinutes: number;
  visitChargePaise: number;
  emergencySurchargePct: PercentInput;
}

/** The pricing columns of a state_config row. */
export interface PricingStateConfig {
  welfarePct: PercentInput;
  platformFeePct: PercentInput;
  gstPctOnPlatformFee: PercentInput;
}

export interface QuoteInput {
  rates: TradeRates;
  stateConfig: PricingStateConfig;
  estimatedMinutes: number;
  urgency: Urgency;
  isInstitution: boolean;
}

/** i18n keys of the customer-facing breakdown lines. */
export const PRICING_LINE_KEYS = {
  wage: 'pricing.wage',
  surcharge: 'pricing.emergency_surcharge',
  welfare: 'pricing.welfare',
  platformFee: 'pricing.platform_fee',
  gst: 'pricing.gst',
} as const;

export type PricingLineKey = (typeof PRICING_LINE_KEYS)[keyof typeof PRICING_LINE_KEYS];

export interface Quote {
  billableMinutes: number;
  /** Worker's full entitlement, including any emergency surcharge. */
  wage: Paise;
  /** Emergency surcharge contained in `wage` (0 for normal bookings). */
  surcharge: Paise;
  welfare: Paise;
  platformFee: Paise;
  gst: Paise;
  total: Paise;
  /** Keys of the lines that apply, in display order. */
  breakdownKeys: PricingLineKey[];
}

function assertInteger(name: string, value: number, min: number): void {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new RangeError(`${name} must be an integer >= ${min}, got ${value}`);
  }
}

export function quote(input: QuoteInput): Quote {
  const { rates, stateConfig, estimatedMinutes, urgency, isInstitution } = input;
  assertInteger('estimatedMinutes', estimatedMinutes, 1);
  assertInteger('minBillableMinutes', rates.minBillableMinutes, 1);
  assertInteger('wageFloorPerHourPaise', rates.wageFloorPerHourPaise, 1);
  assertInteger('visitChargePaise', rates.visitChargePaise, 0);

  const billableMinutes = Math.max(rates.minBillableMinutes, estimatedMinutes);
  const timeWage = paiseFromBigInt(
    (BigInt(billableMinutes) * BigInt(rates.wageFloorPerHourPaise) + 59n) / 60n,
  );
  const baseWage = addPaise(timeWage, paise(rates.visitChargePaise));
  const surcharge =
    urgency === 'emergency' ? mulPct(baseWage, rates.emergencySurchargePct) : ZERO_PAISE;
  const wage = addPaise(baseWage, surcharge);
  const welfare = mulPct(wage, stateConfig.welfarePct);
  const platformFee = mulPct(wage, stateConfig.platformFeePct);
  const gst = isInstitution ? mulPct(platformFee, stateConfig.gstPctOnPlatformFee) : ZERO_PAISE;
  const total = addPaise(wage, welfare, platformFee, gst);

  const breakdownKeys: PricingLineKey[] = [PRICING_LINE_KEYS.wage];
  if (urgency === 'emergency') breakdownKeys.push(PRICING_LINE_KEYS.surcharge);
  breakdownKeys.push(PRICING_LINE_KEYS.welfare, PRICING_LINE_KEYS.platformFee);
  if (isInstitution) breakdownKeys.push(PRICING_LINE_KEYS.gst);

  return { billableMinutes, wage, surcharge, welfare, platformFee, gst, total, breakdownKeys };
}
