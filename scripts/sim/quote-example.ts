/**
 * Print the AGENTS.md 6.2 price breakdown for a plumber job estimated at 50
 * minutes, normal vs emergency, using the seeded rates of DEFAULT_STATE read
 * from the database (run `bun run db:seed` first).
 * Run: bun run sim:quote-example
 */
import {
  formatINR,
  parseEnv,
  quote,
  subPaise,
  type Paise,
  type PricingLineKey,
  type Quote,
  type Urgency,
} from '@kaithangu/core';
import { createDb, loadPricingInputs, redactDatabaseUrl } from '@kaithangu/db';
import { z } from 'zod';

const TRADE = 'plumber';
const ESTIMATED_MINUTES = 50;

const env = parseEnv(
  z.object({
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    DEFAULT_STATE: z.string().regex(/^[A-Z]{2}$/),
  }),
  process.env,
);

function printQuote(urgency: Urgency, q: Quote): void {
  // `wage` includes the surcharge; show the base wage and the surcharge separately.
  const lines: [PricingLineKey, Paise][] = [
    ['pricing.wage', subPaise(q.wage, q.surcharge)],
    ['pricing.emergency_surcharge', q.surcharge],
    ['pricing.welfare', q.welfare],
    ['pricing.platform_fee', q.platformFee],
    ['pricing.gst', q.gst],
  ];
  console.log(`\n${urgency.toUpperCase()}  (billable minutes: ${q.billableMinutes})`);
  for (const [key, amount] of lines) {
    if (!q.breakdownKeys.includes(key)) continue;
    console.log(`  ${key.padEnd(30)} ${formatINR(amount, 'en').padStart(12)}  ${amount} paise`);
  }
  console.log(
    `  ${'worker wage (incl. surcharge)'.padEnd(30)} ${formatINR(q.wage, 'en').padStart(12)}  ${q.wage} paise`,
  );
  console.log(`  ${'TOTAL'.padEnd(30)} ${formatINR(q.total, 'en').padStart(12)}  ${q.total} paise`);
}

const { db, client } = createDb(env.DATABASE_URL, { max: 1 });
try {
  console.log(
    `DB: ${redactDatabaseUrl(env.DATABASE_URL)}  state: ${env.DEFAULT_STATE}  trade: ${TRADE}  estimated minutes: ${ESTIMATED_MINUTES}`,
  );
  const inputs = await loadPricingInputs(db, env.DEFAULT_STATE, TRADE);
  if (inputs === null) {
    throw new Error(
      `no state_config / state_trade_rates for ${env.DEFAULT_STATE}/${TRADE}; run bun run db:seed`,
    );
  }
  const { rates, stateConfig } = inputs;
  console.log('state_trade_rates:', {
    wage_floor_per_hour_paise: rates.wageFloorPerHourPaise,
    min_billable_minutes: rates.minBillableMinutes,
    visit_charge_paise: rates.visitChargePaise,
    emergency_surcharge_pct: rates.emergencySurchargePct,
    is_placeholder: rates.isPlaceholder,
  });
  console.log('state_config:', {
    welfare_pct: stateConfig.welfarePct,
    platform_fee_pct: stateConfig.platformFeePct,
    gst_pct_on_platform_fee: stateConfig.gstPctOnPlatformFee,
    is_placeholder: stateConfig.isPlaceholder,
  });
  if (rates.isPlaceholder || stateConfig.isPlaceholder) {
    console.log('WARNING: these are TODO_VERIFY placeholder values, not official rates.');
  }
  for (const urgency of ['normal', 'emergency'] as const) {
    printQuote(
      urgency,
      quote({
        rates,
        stateConfig,
        estimatedMinutes: ESTIMATED_MINUTES,
        urgency,
        isInstitution: false,
      }),
    );
  }
} catch (error) {
  console.error('quote-example FAILED', error);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
