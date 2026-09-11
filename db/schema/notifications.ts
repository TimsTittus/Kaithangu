import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, tstz } from './columns';
import { notificationChannel } from './enums';
import { bookings } from './bookings';
import { users } from './users';

type Json = Record<string, unknown>;

/** In-app notification center (AGENTS.md 6.4/6.6 "channel: app"). */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    bookingId: uuid('booking_id').references(() => bookings.id),
    channel: notificationChannel('channel').notNull(),
    kind: text('kind').notNull(),
    titleKey: text('title_key').notNull(),
    params: jsonb('params').$type<Json>().notNull().default({}),
    readAt: tstz('read_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('notifications_user_created_idx').on(t.userId, t.createdAt),
    index('notifications_booking_idx').on(t.bookingId),
  ],
);
