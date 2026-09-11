import { sql } from 'drizzle-orm';
import { bigserial, check, index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, paise, point, tstz } from './columns';
import { bookingStatus, urgency, userRole } from './enums';
import { states, trades } from './region';
import { user } from './user';
import { worker } from './worker';

type Json = Record<string, unknown>;

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => user.id),
    stateCode: text('state_code')
      .notNull()
      .references(() => states.code),
    workerId: uuid('worker_id').references(() => worker.id),
    tradeCode: text('trade_code')
      .notNull()
      .references(() => trades.code),
    problemText: text('problem_text').notNull(),
    urgency: urgency('urgency').notNull().default('normal'),
    scheduledFor: tstz('scheduled_for'),
    estimatedMinutes: integer('estimated_minutes').notNull(),
    location: point('location').notNull(),
    addressText: text('address_text').notNull(),
    pincode: text('pincode').notNull(),
    status: bookingStatus('status').notNull().default('requested'),
    // Full pricing breakdown (inputs, rates used, rounding) as quoted to the customer.
    quote: jsonb('quote').$type<Json>().notNull(),
    wagePaise: paise('wage_paise').notNull(),
    welfarePaise: paise('welfare_paise').notNull(),
    platformFeePaise: paise('platform_fee_paise').notNull(),
    gstPaise: paise('gst_paise').notNull().default(0),
    totalPaise: paise('total_paise').notNull(),
    cancelledReason: text('cancelled_reason'),
    createdAt: createdAt(),
  },
  (t) => [
    index('bookings_status_idx').on(t.status),
    index('bookings_created_idx').on(t.createdAt),
    index('bookings_worker_status_idx').on(t.workerId, t.status),
    index('bookings_customer_idx').on(t.customerId),
    index('bookings_location_gist').using('gist', t.location),
    check('bookings_estimated_minutes_positive', sql`${t.estimatedMinutes} > 0`),
    check(
      'bookings_money_non_negative',
      sql`${t.wagePaise} >= 0 AND ${t.welfarePaise} >= 0 AND ${t.platformFeePaise} >= 0
          AND ${t.gstPaise} >= 0`,
    ),
    // AGENTS.md 6.2 invariant, enforced by the DB as well as by property tests.
    check(
      'bookings_total_is_sum',
      sql`${t.totalPaise} = ${t.wagePaise} + ${t.welfarePaise} + ${t.platformFeePaise} + ${t.gstPaise}`,
    ),
  ],
);

export const bookingEvents = pgTable(
  'booking_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
    actorRole: userRole('actor_role'),
    actorId: uuid('actor_id'),
    actorSystem: text('actor_system'),
    fromStatus: bookingStatus('from_status'),
    toStatus: bookingStatus('to_status').notNull(),
    meta: jsonb('meta').$type<Json>().notNull().default({}),
    at: tstz('at').notNull().defaultNow(),
  },
  (t) => [
    index('booking_events_booking_idx').on(t.bookingId, t.at),
    check(
      'booking_events_has_actor',
      sql`(${t.actorRole} IS NOT NULL AND ${t.actorId} IS NOT NULL) OR ${t.actorSystem} IS NOT NULL`,
    ),
  ],
);

export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(),
  scope: text('scope').notNull(),
  response: jsonb('response').$type<Json>(),
  createdAt: createdAt(),
});
