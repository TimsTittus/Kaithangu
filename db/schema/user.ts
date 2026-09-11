import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, identityColumns, phoneE164Check, point } from './columns';
import { states } from './region';

/** Customers who book services. `"user"` is quoted: USER is reserved in PostgreSQL. */
export const user = pgTable(
  'user',
  {
    ...identityColumns('user'),
    stateCode: text('state_code').references(() => states.code),
  },
  (t) => [phoneE164Check('user', t.phone), index('user_state_idx').on(t.stateCode)],
);

export const addresses = pgTable(
  'addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id),
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
