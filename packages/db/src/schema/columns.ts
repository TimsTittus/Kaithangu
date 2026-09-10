import type { LngLat } from '@kaithangu/core';
import { bigint, customType, timestamp } from 'drizzle-orm/pg-core';
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
