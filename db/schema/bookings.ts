import { sql } from 'drizzle-orm';
import {
  bigserial,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, paise, point, tstz } from './columns';
import {
  bookingSource,
  bookingStatus,
  disputeStatus,
  offerChannel,
  offerResponse,
  ratingChannel,
  sentiment,
  urgency,
} from './enums';
import { institutions } from './institutions';
import { societies } from './org';
import { disasterEvents } from './planning';
import { states, trades } from './region';
import { users } from './users';
import { workers } from './workers';

type Json = Record<string, unknown>;

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id),
    institutionId: uuid('institution_id').references(() => institutions.id),
    stateCode: text('state_code')
      .notNull()
      .references(() => states.code),
    societyId: uuid('society_id').references(() => societies.id),
    workerId: uuid('worker_id').references(() => workers.userId),
    tradeCode: text('trade_code')
      .notNull()
      .references(() => trades.code),
    problemText: text('problem_text').notNull(),
    problemSummaryEn: text('problem_summary_en'),
    source: bookingSource('source').notNull(),
    urgency: urgency('urgency').notNull().default('normal'),
    disasterEventId: uuid('disaster_event_id').references(() => disasterEvents.id),
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
    startOtpHash: text('start_otp_hash'),
    completeOtpHash: text('complete_otp_hash'),
    // AGENTS.md 6.6: max 5 attempts per OTP, then lock + alert.
    startOtpAttempts: smallint('start_otp_attempts').notNull().default(0),
    completeOtpAttempts: smallint('complete_otp_attempts').notNull().default(0),
    otpLockedAt: tstz('otp_locked_at'),
    startedAt: tstz('started_at'),
    completedAt: tstz('completed_at'),
    cancelledReason: text('cancelled_reason'),
    createdAt: createdAt(),
    updatedAt: tstz('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('bookings_status_idx').on(t.status),
    index('bookings_society_created_idx').on(t.societyId, t.createdAt),
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
    check(
      'bookings_otp_attempts_range',
      sql`${t.startOtpAttempts} BETWEEN 0 AND 5 AND ${t.completeOtpAttempts} BETWEEN 0 AND 5`,
    ),
  ],
);

export const bookingOffers = pgTable(
  'booking_offers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
    workerId: uuid('worker_id')
      .notNull()
      .references(() => workers.userId),
    rank: smallint('rank').notNull(),
    channel: offerChannel('channel').notNull(),
    score: numeric('score', { precision: 6, scale: 4 }).notNull(),
    breakdown: jsonb('breakdown').$type<Json>().notNull(),
    explanationKey: text('explanation_key').notNull(),
    explanationParams: jsonb('explanation_params').$type<Json>().notNull().default({}),
    offeredAt: tstz('offered_at').notNull().defaultNow(),
    expiresAt: tstz('expires_at').notNull(),
    respondedAt: tstz('responded_at'),
    response: offerResponse('response'),
  },
  (t) => [
    index('booking_offers_booking_idx').on(t.bookingId),
    index('booking_offers_worker_idx').on(t.workerId, t.response),
    check('booking_offers_rank_positive', sql`${t.rank} >= 1`),
  ],
);

export const bookingEvents = pgTable(
  'booking_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
    actorUserId: uuid('actor_user_id').references(() => users.id),
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
      sql`${t.actorUserId} IS NOT NULL OR ${t.actorSystem} IS NOT NULL`,
    ),
  ],
);

export const ratings = pgTable(
  'ratings',
  {
    bookingId: uuid('booking_id')
      .primaryKey()
      .references(() => bookings.id),
    stars: smallint('stars').notNull(),
    commentText: text('comment_text'),
    channel: ratingChannel('channel').notNull(),
    sentiment: sentiment('sentiment'),
    flags: text('flags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdAt: createdAt(),
  },
  (t) => [check('ratings_stars_range', sql`${t.stars} BETWEEN 1 AND 5`)],
);

export const disputes = pgTable(
  'disputes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
    raisedBy: uuid('raised_by')
      .notNull()
      .references(() => users.id),
    reasonCode: text('reason_code').notNull(),
    description: text('description'),
    status: disputeStatus('status').notNull().default('open'),
    resolutionNote: text('resolution_note'),
    createdAt: createdAt(),
    resolvedAt: tstz('resolved_at'),
  },
  (t) => [index('disputes_booking_idx').on(t.bookingId), index('disputes_status_idx').on(t.status)],
);
