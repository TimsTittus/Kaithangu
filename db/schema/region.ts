import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { paise, point } from './columns';

const pct = (name: string) => numeric(name, { precision: 5, scale: 2 });

export const states = pgTable(
  'states',
  {
    code: text('code').primaryKey(),
    nameKey: text('name_key').notNull(),
    active: boolean('active').notNull().default(false),
  },
  (t) => [check('states_code_format', sql`${t.code} ~ '^[A-Z]{2}$'`)],
);

export const stateConfig = pgTable(
  'state_config',
  {
    stateCode: text('state_code')
      .primaryKey()
      .references(() => states.code),
    welfarePct: pct('welfare_pct').notNull(),
    platformFeePct: pct('platform_fee_pct').notNull(),
    gstPctOnPlatformFee: pct('gst_pct_on_platform_fee').notNull(),
    defaultLocale: text('default_locale').notNull(),
    locales: text('locales').array().notNull(),
    timezone: text('timezone').notNull(),
    isPlaceholder: boolean('is_placeholder').notNull().default(true),
  },
  (t) => [
    check(
      'state_config_pct_range',
      sql`${t.welfarePct} BETWEEN 0 AND 100 AND ${t.platformFeePct} BETWEEN 0 AND 100
          AND ${t.gstPctOnPlatformFee} BETWEEN 0 AND 100`,
    ),
    check('state_config_default_locale_listed', sql`${t.defaultLocale} = ANY (${t.locales})`),
  ],
);

export const trades = pgTable('trades', {
  code: text('code').primaryKey(),
  certifiedRequired: boolean('certified_required').notNull().default(false),
  icon: text('icon').notNull(),
  sortOrder: integer('sort_order').notNull(),
});

export const stateTradeRates = pgTable(
  'state_trade_rates',
  {
    stateCode: text('state_code')
      .notNull()
      .references(() => states.code),
    tradeCode: text('trade_code')
      .notNull()
      .references(() => trades.code),
    wageFloorPerHourPaise: paise('wage_floor_per_hour_paise').notNull(),
    minBillableMinutes: integer('min_billable_minutes').notNull(),
    visitChargePaise: paise('visit_charge_paise').notNull(),
    emergencySurchargePct: pct('emergency_surcharge_pct').notNull(),
    isPlaceholder: boolean('is_placeholder').notNull().default(true),
  },
  (t) => [
    primaryKey({ columns: [t.stateCode, t.tradeCode] }),
    check(
      'state_trade_rates_non_negative',
      sql`${t.wageFloorPerHourPaise} > 0 AND ${t.minBillableMinutes} > 0
          AND ${t.visitChargePaise} >= 0 AND ${t.emergencySurchargePct} BETWEEN 0 AND 100`,
    ),
  ],
);

/** India Post office rows (several offices can share a pincode). */
export const pincodes = pgTable(
  'pincodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pincode: text('pincode').notNull(),
    officeName: text('office_name').notNull(),
    district: text('district').notNull(),
    stateName: text('state_name').notNull(),
    location: point('location').notNull(),
  },
  (t) => [
    index('pincodes_pincode_idx').on(t.pincode),
    index('pincodes_district_idx').on(t.stateName, t.district),
    index('pincodes_location_gist').using('gist', t.location),
    check('pincodes_pincode_format', sql`${t.pincode} ~ '^[1-9][0-9]{5}$'`),
  ],
);
