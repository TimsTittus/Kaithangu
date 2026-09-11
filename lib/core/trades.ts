/** Canonical trades (AGENTS.md 6.1). Display names are i18n keys `trade.<code>`. */
export const TRADE_CODES = [
  'plumber',
  'electrician',
  'carpenter',
  'painter',
  'domestic_help',
  'caregiver',
  'driver',
  'gardener',
  'cleaner',
  'technician',
] as const;

export type TradeCode = (typeof TRADE_CODES)[number];

const CERTIFIED_REQUIRED: ReadonlySet<TradeCode> = new Set<TradeCode>([
  'electrician',
  'technician',
]);

export function isTradeCode(value: string): value is TradeCode {
  return (TRADE_CODES as readonly string[]).includes(value);
}

/** Trades whose workers must hold a certified skill to be matched. */
export function isCertifiedRequired(code: TradeCode): boolean {
  return CERTIFIED_REQUIRED.has(code);
}
