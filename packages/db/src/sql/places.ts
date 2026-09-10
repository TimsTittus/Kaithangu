/**
 * PostGIS place queries (raw SQL lives in src/sql, AGENTS.md 3). Always
 * parameterized; distances in meters on geography (AGENTS.md 5).
 */
import type { LngLat } from '@kaithangu/core';
import { sql } from 'drizzle-orm';
import type { Database } from '../client';

/** Pincode of the nearest post office within `maxMeters` of `point`, or null. */
export async function nearestPincode(
  db: Database,
  point: LngLat,
  maxMeters: number,
): Promise<string | null> {
  const here = sql`ST_SetSRID(ST_MakePoint(${point.lng}::double precision, ${point.lat}::double precision), 4326)::geography`;
  const rows = await db.execute<{ pincode: string }>(sql`
    SELECT pincode
    FROM pincodes
    WHERE ST_DWithin(location::geography, ${here}, ${maxMeters}::double precision)
    ORDER BY ST_Distance(location::geography, ${here}), pincode
    LIMIT 1
  `);
  return rows[0]?.pincode ?? null;
}
