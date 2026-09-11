import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, point } from './columns';
import { institutionType } from './enums';
import { states } from './region';

export const institutions = pgTable(
  'institutions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    type: institutionType('type').notNull(),
    gstin: text('gstin'),
    stateCode: text('state_code')
      .notNull()
      .references(() => states.code),
    addressText: text('address_text').notNull(),
    location: point('location').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('institutions_location_gist').using('gist', t.location)],
);
