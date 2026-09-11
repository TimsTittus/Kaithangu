import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, point, tstz } from './columns';
import { skillSource, workerStatus } from './enums';
import { societies } from './org';
import { trades } from './region';
import { users } from './users';

export const workers = pgTable(
  'workers',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id),
    societyId: uuid('society_id')
      .notNull()
      .references(() => societies.id),
    status: workerStatus('status').notNull().default('pending'),
    serviceRadiusKm: numeric('service_radius_km', { precision: 4, scale: 1 })
      .notNull()
      .default('8'),
    homeLocation: point('home_location').notNull(),
    available: boolean('available').notNull().default(false),
    availableUpdatedAt: tstz('available_updated_at'),
    hasSmartphone: boolean('has_smartphone').notNull().default(false),
    ratingSum: integer('rating_sum').notNull().default(0),
    ratingCount: integer('rating_count').notNull().default(0),
    lastJobCompletedAt: tstz('last_job_completed_at'),
    eshramUan: text('eshram_uan'),
    qrKeyVersion: integer('qr_key_version').notNull().default(1),
    photoUrl: text('photo_url'),
    verifiedBy: uuid('verified_by').references(() => users.id),
    verifiedAt: tstz('verified_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('workers_society_status_available_idx').on(t.societyId, t.status, t.available),
    index('workers_home_location_gist').using('gist', t.homeLocation),
    check('workers_service_radius_positive', sql`${t.serviceRadiusKm} > 0`),
    check(
      'workers_rating_consistent',
      sql`${t.ratingCount} >= 0 AND ${t.ratingSum} BETWEEN ${t.ratingCount} AND 5 * ${t.ratingCount}`,
    ),
  ],
);

export const workerSkills = pgTable(
  'worker_skills',
  {
    workerId: uuid('worker_id')
      .notNull()
      .references(() => workers.userId),
    tradeCode: text('trade_code')
      .notNull()
      .references(() => trades.code),
    level: smallint('level').notNull(),
    years: integer('years').notNull().default(0),
    certified: boolean('certified').notNull().default(false),
    source: skillSource('source').notNull(),
    verified: boolean('verified').notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.workerId, t.tradeCode] }),
    index('worker_skills_trade_idx').on(t.tradeCode),
    check('worker_skills_level_range', sql`${t.level} BETWEEN 1 AND 3`),
    check('worker_skills_years_non_negative', sql`${t.years} >= 0`),
  ],
);
