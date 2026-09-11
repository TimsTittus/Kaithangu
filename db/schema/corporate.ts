import { index, pgTable, uuid } from 'drizzle-orm/pg-core';
import { identityColumns, phoneE164Check } from './columns';
import { societies } from './org';

export const corporate = pgTable(
  'corporate',
  {
    ...identityColumns('corporate'),
    societyId: uuid('society_id').references(() => societies.id),
  },
  (t) => [phoneE164Check('corporate', t.phone), index('corporate_society_idx').on(t.societyId)],
);
