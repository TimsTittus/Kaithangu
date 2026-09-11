import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  numeric,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, tstz } from './columns';
import { reliefRateMode } from './enums';
import { states, trades } from './region';
import { users } from './users';

export const disasterEvents = pgTable(
  'disaster_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    stateCode: text('state_code')
      .notNull()
      .references(() => states.code),
    districts: text('districts').array().notNull(),
    active: boolean('active').notNull().default(true),
    reliefRateMode: reliefRateMode('relief_rate_mode').notNull().default('normal'),
    startedBy: uuid('started_by')
      .notNull()
      .references(() => users.id),
    startedAt: tstz('started_at').notNull().defaultNow(),
    endedAt: tstz('ended_at'),
  },
  (t) => [index('disaster_events_state_active_idx').on(t.stateCode, t.active)],
);

export const demandForecasts = pgTable(
  'demand_forecasts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    stateCode: text('state_code')
      .notNull()
      .references(() => states.code),
    h3Cell: text('h3_cell').notNull(),
    tradeCode: text('trade_code')
      .notNull()
      .references(() => trades.code),
    date: date('date', { mode: 'string' }).notNull(),
    predicted: numeric('predicted').notNull(),
    lower: numeric('lower').notNull(),
    upper: numeric('upper').notNull(),
    modelVersion: text('model_version').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique('demand_forecasts_cell_trade_date_model_unique').on(
      t.h3Cell,
      t.tradeCode,
      t.date,
      t.modelVersion,
    ),
    check(
      'demand_forecasts_interval',
      sql`${t.lower} <= ${t.predicted} AND ${t.predicted} <= ${t.upper}`,
    ),
  ],
);

export const festivals = pgTable(
  'festivals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    stateCode: text('state_code')
      .notNull()
      .references(() => states.code),
    nameKey: text('name_key').notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    isPlaceholder: boolean('is_placeholder').notNull().default(true),
  },
  (t) => [
    unique('festivals_state_name_start_unique').on(t.stateCode, t.nameKey, t.startDate),
    check('festivals_date_order', sql`${t.endDate} >= ${t.startDate}`),
  ],
);
