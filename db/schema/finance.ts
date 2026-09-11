import { sql } from 'drizzle-orm';
import {
  bigserial,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, paise, tstz } from './columns';
import { ledgerDirection, ledgerKind, paymentMethod, paymentStatus } from './enums';
import { bookings } from './bookings';
import { institutions } from './institutions';
import { societies } from './org';

type Json = Record<string, unknown>;

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
    method: paymentMethod('method').notNull(),
    amountPaise: paise('amount_paise').notNull(),
    status: paymentStatus('status').notNull().default('created'),
    providerOrderId: text('provider_order_id'),
    providerPaymentId: text('provider_payment_id'),
    idempotencyKey: text('idempotency_key').notNull().unique('payments_idempotency_key_unique'),
    raw: jsonb('raw').$type<Json>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index('payments_booking_idx').on(t.bookingId),
    check('payments_amount_positive', sql`${t.amountPaise} > 0`),
  ],
);

/** Single-row head of the ledger hash chain; locked FOR UPDATE by writers. */
export const ledgerHead = pgTable(
  'ledger_head',
  {
    id: smallint('id').primaryKey(),
    lastHash: text('last_hash').notNull(),
  },
  (t) => [
    check('ledger_head_singleton', sql`${t.id} = 1`),
    check('ledger_head_hash_format', sql`${t.lastHash} ~ '^[0-9a-f]{64}$'`),
  ],
);

/** Append-only, hash-chained (AGENTS.md 6.7). A trigger rejects UPDATE/DELETE. */
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    account: text('account').notNull(),
    bookingId: uuid('booking_id').references(() => bookings.id),
    amountPaise: paise('amount_paise').notNull(),
    direction: ledgerDirection('direction').notNull(),
    kind: ledgerKind('kind').notNull(),
    createdAt: createdAt(),
    prevHash: text('prev_hash').notNull(),
    hash: text('hash').notNull().unique('ledger_entries_hash_unique'),
  },
  (t) => [
    index('ledger_entries_account_idx').on(t.account),
    index('ledger_entries_booking_idx').on(t.bookingId),
    check('ledger_entries_amount_positive', sql`${t.amountPaise} > 0`),
    check(
      'ledger_entries_hash_format',
      sql`${t.hash} ~ '^[0-9a-f]{64}$' AND ${t.prevHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(),
  scope: text('scope').notNull(),
  response: jsonb('response').$type<Json>(),
  createdAt: createdAt(),
});

export const invoiceSequences = pgTable(
  'invoice_sequences',
  {
    societyId: uuid('society_id')
      .notNull()
      .references(() => societies.id),
    fiscalYear: text('fiscal_year').notNull(),
    lastNumber: integer('last_number').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.societyId, t.fiscalYear] }),
    check('invoice_sequences_non_negative', sql`${t.lastNumber} >= 0`),
  ],
);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id').references(() => bookings.id),
    institutionId: uuid('institution_id').references(() => institutions.id),
    societyId: uuid('society_id')
      .notNull()
      .references(() => societies.id),
    number: text('number').notNull().unique('invoices_number_unique'),
    fiscalYear: text('fiscal_year').notNull(),
    lines: jsonb('lines').$type<Json[]>().notNull(),
    totals: jsonb('totals').$type<Json>().notNull(),
    pdfPath: text('pdf_path'),
    issuedAt: tstz('issued_at').notNull().defaultNow(),
  },
  (t) => [
    index('invoices_society_idx').on(t.societyId, t.fiscalYear),
    index('invoices_institution_idx').on(t.institutionId),
  ],
);
