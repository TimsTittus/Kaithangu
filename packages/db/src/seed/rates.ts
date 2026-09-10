import { TRADE_CODES } from '@kaithangu/core';
import { SUPPORTED_LOCALES } from '@kaithangu/i18n';
import { parse } from 'yaml';
import { z } from 'zod';

const pct = z.number().min(0).max(100);
const locale = z.enum(SUPPORTED_LOCALES);

// Numeric fields reject strings, so an unfilled "TODO_VERIFY" can never be
// seeded silently: it must be replaced by a number flagged is_placeholder.
const tradeRate = z.strictObject({
  wage_floor_per_hour_paise: z.number().int().positive(),
  min_billable_minutes: z.number().int().positive(),
  visit_charge_paise: z.number().int().nonnegative(),
  emergency_surcharge_pct: pct,
  is_placeholder: z.boolean(),
});

export const stateRatesFileSchema = z.strictObject({
  state: z.strictObject({
    code: z.string().regex(/^[A-Z]{2}$/),
    name_key: z.string().min(1),
    active: z.boolean(),
    // Exact `statename` spelling in data/raw/pincodes.csv.
    pincode_state_name: z.string().trim().min(1),
  }),
  state_config: z
    .strictObject({
      welfare_pct: pct,
      platform_fee_pct: pct,
      gst_pct_on_platform_fee: pct,
      default_locale: locale,
      locales: z.array(locale).min(1),
      timezone: z.string().min(1),
      is_placeholder: z.boolean(),
    })
    .refine((c) => c.locales.includes(c.default_locale), {
      message: 'default_locale must be listed in locales',
    }),
  // zod records keyed by an enum are exhaustive: every trade must have a rate.
  state_trade_rates: z.record(z.enum(TRADE_CODES), tradeRate),
  // Human reference data kept alongside the rates; never seeded.
  reference_minimum_wages: z.unknown().optional(),
});

export type StateRatesFile = z.infer<typeof stateRatesFileSchema>;

export function parseStateRates(yamlText: string, source: string): StateRatesFile {
  const result = stateRatesFileSchema.safeParse(parse(yamlText));
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`Invalid rates file ${source}:\n  ${issues.join('\n  ')}`);
  }
  return result.data;
}

/** Human-readable list of every placeholder value, for logs and PROGRESS.md. */
export function listPlaceholders(file: StateRatesFile): string[] {
  const code = file.state.code;
  const out: string[] = [];
  if (file.state_config.is_placeholder) out.push(`${code} state_config`);
  for (const trade of TRADE_CODES) {
    if (file.state_trade_rates[trade]?.is_placeholder)
      out.push(`${code} state_trade_rates.${trade}`);
  }
  return out;
}
