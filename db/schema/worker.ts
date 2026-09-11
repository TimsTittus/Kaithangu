import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { identityColumns, phoneE164Check } from './columns';
import { workerStatus } from './enums';
import { societies } from './org';
import { trades } from './region';

export const worker = pgTable(
  'worker',
  {
    ...identityColumns('worker'),
    societyId: uuid('society_id').references(() => societies.id),
    status: workerStatus('status').notNull().default('pending'),
    available: boolean('available').notNull().default(false),
    hasSmartphone: boolean('has_smartphone').notNull().default(false),
    ratingSum: integer('rating_sum').notNull().default(0),
    ratingCount: integer('rating_count').notNull().default(0),
    qrKeyVersion: integer('qr_key_version').notNull().default(1),
  },
  (t) => [
    phoneE164Check('worker', t.phone),
    index('worker_society_status_available_idx').on(t.societyId, t.status, t.available),
    check(
      'worker_rating_consistent',
      sql`${t.ratingCount} >= 0 AND ${t.ratingSum} BETWEEN ${t.ratingCount} AND 5 * ${t.ratingCount}`,
    ),
  ],
);

export const workerSkills = pgTable(
  'worker_skills',
  {
    workerId: uuid('worker_id')
      .notNull()
      .references(() => worker.id),
    tradeCode: text('trade_code')
      .notNull()
      .references(() => trades.code),
    level: smallint('level').notNull(),
    certified: boolean('certified').notNull().default(false),
    verified: boolean('verified').notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.workerId, t.tradeCode] }),
    index('worker_skills_trade_idx').on(t.tradeCode),
    check('worker_skills_level_range', sql`${t.level} BETWEEN 1 AND 3`),
  ],
);
