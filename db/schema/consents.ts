import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { tstz } from './columns';
import { consentPurpose, userRole } from './enums';

export const consents = pgTable(
  'consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorRole: userRole('actor_role').notNull(),
    actorId: uuid('actor_id').notNull(),
    purpose: consentPurpose('purpose').notNull(),
    version: text('version').notNull(),
    acceptedAt: tstz('accepted_at').notNull().defaultNow(),
    evidence: jsonb('evidence').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index('consents_actor_purpose_idx').on(t.actorRole, t.actorId, t.purpose)],
);
