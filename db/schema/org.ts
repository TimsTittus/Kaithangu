import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, text, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { createdAt, point } from './columns';
import { federationLevel } from './enums';
import { states } from './region';

export const federations = pgTable(
  'federations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    stateCode: text('state_code').references(() => states.code),
    name: text('name').notNull(),
    level: federationLevel('level').notNull(),
    parentId: uuid('parent_id').references((): AnyPgColumn => federations.id),
    createdAt: createdAt(),
  },
  (t) => [
    // A state federation belongs to a state; the national federation does not.
    check(
      'federations_level_state',
      sql`(${t.level} = 'national' AND ${t.stateCode} IS NULL)
          OR (${t.level} = 'state' AND ${t.stateCode} IS NOT NULL)`,
    ),
  ],
);

/** Labour Cooperative Societies (LCS). */
export const societies = pgTable(
  'societies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    federationId: uuid('federation_id')
      .notNull()
      .references(() => federations.id),
    stateCode: text('state_code')
      .notNull()
      .references(() => states.code),
    name: text('name').notNull(),
    district: text('district').notNull(),
    regNo: text('reg_no'),
    location: point('location').notNull(),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index('societies_state_idx').on(t.stateCode),
    index('societies_location_gist').using('gist', t.location),
  ],
);
