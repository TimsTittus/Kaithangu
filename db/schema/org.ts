import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt } from './columns';
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
    createdAt: createdAt(),
  },
  (t) => [index('societies_state_idx').on(t.stateCode)],
);
