import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, point, tstz } from './columns';
import { consentChannel, consentPurpose, userRole } from './enums';
import { institutions } from './institutions';
import { societies } from './org';
import { states } from './region';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: text('phone').notNull().unique('users_phone_unique'),
    name: text('name'),
    role: userRole('role').notNull(),
    // Null means "use the state's default_locale".
    locale: text('locale'),
    stateCode: text('state_code').references(() => states.code),
    societyId: uuid('society_id').references(() => societies.id),
    institutionId: uuid('institution_id').references(() => institutions.id),
    // Bumped to revoke every outstanding session JWT for this user.
    sessionVersion: integer('session_version').notNull().default(0),
    createdAt: createdAt(),
    lastLoginAt: tstz('last_login_at'),
  },
  (t) => [
    check('users_phone_e164', sql`${t.phone} ~ '^\\+[1-9][0-9]{7,14}$'`),
    index('users_society_idx').on(t.societyId),
    index('users_role_idx').on(t.role),
  ],
);

export const consents = pgTable(
  'consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    purpose: consentPurpose('purpose').notNull(),
    version: text('version').notNull(),
    channel: consentChannel('channel').notNull(),
    acceptedAt: tstz('accepted_at').notNull().defaultNow(),
    evidence: jsonb('evidence').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index('consents_user_purpose_idx').on(t.userId, t.purpose)],
);

export const addresses = pgTable(
  'addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    label: text('label'),
    addressText: text('address_text').notNull(),
    pincode: text('pincode').notNull(),
    location: point('location').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('addresses_user_idx').on(t.userId),
    index('addresses_location_gist').using('gist', t.location),
  ],
);
