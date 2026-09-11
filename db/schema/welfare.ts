import { boolean, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { tstz } from './columns';
import { enrolmentStatus } from './enums';
import { states } from './region';
import { workers } from './workers';

export const welfareSchemes = pgTable('welfare_schemes', {
  code: text('code').primaryKey(),
  // Null for national schemes.
  stateCode: text('state_code').references(() => states.code),
  nameKey: text('name_key').notNull(),
  rules: jsonb('rules').$type<Record<string, unknown>>().notNull().default({}),
  isPlaceholder: boolean('is_placeholder').notNull().default(true),
});

export const welfareEnrolments = pgTable(
  'welfare_enrolments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workerId: uuid('worker_id')
      .notNull()
      .references(() => workers.userId),
    schemeCode: text('scheme_code')
      .notNull()
      .references(() => welfareSchemes.code),
    status: enrolmentStatus('status').notNull().default('interested'),
    reference: text('reference'),
    updatedAt: tstz('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique('welfare_enrolments_worker_scheme_unique').on(t.workerId, t.schemeCode)],
);
