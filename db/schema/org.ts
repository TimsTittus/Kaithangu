import { boolean, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, point } from './columns';
import { states } from './region';

/** Labour Cooperative Societies (LCS). */
export const societies = pgTable(
  'societies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
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
