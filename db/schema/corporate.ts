import { pgTable } from 'drizzle-orm/pg-core';
import { identityColumns, phoneE164Check } from './columns';

export const corporate = pgTable('corporate', identityColumns('corporate'), (t) => [
  phoneE164Check('corporate', t.phone),
]);
