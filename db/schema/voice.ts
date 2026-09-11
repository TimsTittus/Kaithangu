import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { tstz } from './columns';
import { bookings } from './bookings';
import { callDirection, callPurpose } from './enums';
import { users } from './users';

export const callSessions = pgTable(
  'call_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    callSid: text('call_sid').notNull().unique('call_sessions_call_sid_unique'),
    direction: callDirection('direction').notNull(),
    purpose: callPurpose('purpose').notNull(),
    phone: text('phone').notNull(),
    userId: uuid('user_id').references(() => users.id),
    locale: text('locale'),
    state: jsonb('state').$type<Record<string, unknown>>().notNull().default({}),
    transcript: jsonb('transcript')
      .$type<Record<string, unknown>[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    outcome: text('outcome'),
    bookingId: uuid('booking_id').references(() => bookings.id),
    startedAt: tstz('started_at').notNull().defaultNow(),
    endedAt: tstz('ended_at'),
  },
  (t) => [index('call_sessions_phone_idx').on(t.phone)],
);
