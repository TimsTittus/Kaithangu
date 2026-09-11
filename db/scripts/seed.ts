/**
 * Seed reference data from data/seed: states, trades, state_config and
 * state_trade_rates. Idempotent (rows are upserted in one transaction), so it
 * can be re-run after editing the YAML. Demo workers are not seeded here.
 * Run: bun run db:seed            (writes to DATABASE_URL)
 *      bun run db:seed -- --dry-run  (prints the exact SQL; no connection is made)
 */
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { createDb, type Database } from '..';
import { loadDbScriptEnv } from '../env';
import { redactDatabaseUrl } from '../index';
import { stateConfig, states, stateTradeRates, trades } from '../schema';
import { listPlaceholders } from '../seed/rates';
import { TRADE_ROWS } from '../seed/reference';
import { buildStateRows, loadRateFiles, type StateRows } from '../seed/stateRows';

/**
 * The upsert statements, in foreign-key order. Built but not executed: the
 * caller awaits them (inside a transaction) or prints them with toSQL().
 */
export function referenceUpserts(q: Pick<Database, 'insert'>, rows: StateRows) {
  return [
    q
      .insert(states)
      .values(rows.states)
      .onConflictDoUpdate({
        target: states.code,
        set: { nameKey: sql`excluded.name_key`, active: sql`excluded.active` },
      }),
    q
      .insert(trades)
      .values(TRADE_ROWS)
      .onConflictDoUpdate({
        target: trades.code,
        set: {
          certifiedRequired: sql`excluded.certified_required`,
          icon: sql`excluded.icon`,
          sortOrder: sql`excluded.sort_order`,
        },
      }),
    q
      .insert(stateConfig)
      .values(rows.stateConfigs)
      .onConflictDoUpdate({
        target: stateConfig.stateCode,
        set: {
          welfarePct: sql`excluded.welfare_pct`,
          platformFeePct: sql`excluded.platform_fee_pct`,
          gstPctOnPlatformFee: sql`excluded.gst_pct_on_platform_fee`,
          defaultLocale: sql`excluded.default_locale`,
          locales: sql`excluded.locales`,
          timezone: sql`excluded.timezone`,
          isPlaceholder: sql`excluded.is_placeholder`,
        },
      }),
    q
      .insert(stateTradeRates)
      .values(rows.stateTradeRates)
      .onConflictDoUpdate({
        target: [stateTradeRates.stateCode, stateTradeRates.tradeCode],
        set: {
          wageFloorPerHourPaise: sql`excluded.wage_floor_per_hour_paise`,
          minBillableMinutes: sql`excluded.min_billable_minutes`,
          visitChargePaise: sql`excluded.visit_charge_paise`,
          emergencySurchargePct: sql`excluded.emergency_surcharge_pct`,
          isPlaceholder: sql`excluded.is_placeholder`,
        },
      }),
  ] as const;
}

/** Upsert reference data; returns the placeholder (TODO_VERIFY) values seeded. */
export async function seedReferenceData(databaseUrl: string): Promise<string[]> {
  const files = loadRateFiles();
  const rows = buildStateRows(files);
  const { db, client } = createDb(databaseUrl, { max: 1 });
  try {
    await db.transaction(async (tx) => {
      for (const statement of referenceUpserts(tx, rows)) {
        await statement;
      }
    });
  } finally {
    await client.end({ timeout: 5 });
  }
  return files.flatMap(listPlaceholders);
}

/** The SQL and parameters seedReferenceData would run. Never connects. */
export async function previewReferenceData(
  databaseUrl: string,
): Promise<{ sql: string; params: unknown[] }[]> {
  const rows = buildStateRows(loadRateFiles());
  const { db, client } = createDb(databaseUrl, { max: 1 });
  try {
    return referenceUpserts(db, rows).map((statement) => statement.toSQL());
  } finally {
    await client.end({ timeout: 5 });
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const { DATABASE_URL } = loadDbScriptEnv(process.env);
    if (process.argv.includes('--dry-run')) {
      console.log(`db:seed --dry-run (not connecting to ${redactDatabaseUrl(DATABASE_URL)})`);
      for (const statement of await previewReferenceData(DATABASE_URL)) {
        console.log(`\n${statement.sql}`);
        console.log(`params: ${JSON.stringify(statement.params)}`);
      }
    } else {
      console.log(`db:seed → ${redactDatabaseUrl(DATABASE_URL)}`);
      const placeholders = await seedReferenceData(DATABASE_URL);
      console.log(`db:seed OK. TODO_VERIFY placeholders seeded (${placeholders.length}):`);
      for (const item of placeholders) console.log(`  - ${item}`);
    }
  } catch (error) {
    console.error('db:seed FAILED', error);
    process.exitCode = 1;
  }
}
