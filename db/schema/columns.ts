import type { LngLat } from '@/lib/core';
import { sql, type SQLWrapper } from 'drizzle-orm';
import { bigint, check, customType, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { formatEwktPoint, parseEwkbPoint } from '../geometry';

/**
 * geometry(Point, 4326). Drizzle's built-in `geometry` column declares no SRID
 * and writes `point(x y)` without one, which PostGIS rejects for an SRID-typed
 * column, so points are written as EWKT and read back from hex EWKB.
 */
export const point = customType<{ data: LngLat; driverData: string }>({
  dataType: () => 'geometry(Point,4326)',
  toDriver: (value) => formatEwktPoint(value),
  fromDriver: (value) => parseEwkbPoint(value),
});

/** timestamptz (AGENTS.md 5: UTC in the DB). */
export const tstz = (name: string) => timestamp(name, { withTimezone: true });

export const createdAt = () => tstz('created_at').notNull().defaultNow();

/** Money in integer paise (bigint in the DB, safe-integer number in TS). */
export const paise = (name: string) => bigint(name, { mode: 'number' });

export type IdentityTable = 'user' | 'worker' | 'corporate';

/** Phone, locale and session columns shared by user / worker / corporate. */
export function identityColumns(table: IdentityTable) {
  return {
    id: uuid('id').primaryKey().defaultRandom(),
    phone: text('phone').notNull().unique(`${table}_phone_unique`),
    name: text('name'),
    // Null means "use the state's default_locale".
    locale: text('locale'),
    // Bumped to revoke every outstanding session JWT for this actor.
    sessionVersion: integer('session_version').notNull().default(0),
    createdAt: createdAt(),
  };
}

export function phoneE164Check(table: IdentityTable, phone: SQLWrapper) {
  return check(`${table}_phone_e164`, sql`${phone} ~ '^\\+[1-9][0-9]{7,14}$'`);
}
