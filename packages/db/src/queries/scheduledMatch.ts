/**
 * Scheduled-match scan (AGENTS.md 6.4): bookings still 'requested' whose
 * scheduled_for has entered the lead window. Used by apps/jobs'
 * scheduled-match tick (see its doc comment for why this is a poll, not a
 * delay queue).
 */
import { SCHEDULED_MATCH_LEAD_MINUTES, type Urgency } from '@kaithangu/core';
import { sql } from 'drizzle-orm';
import type { Database } from '../client';

export interface DueScheduledBooking {
  id: string;
  urgency: Urgency;
  scheduledFor: string;
}

export async function findDueScheduledBookings(db: Database): Promise<DueScheduledBooking[]> {
  const rows = await db.execute<{ id: string; urgency: Urgency; scheduled_for: Date }>(sql`
    SELECT id, urgency, scheduled_for
    FROM bookings
    WHERE status = 'requested'
      AND scheduled_for IS NOT NULL
      AND scheduled_for <= now() + (interval '1 minute' * ${SCHEDULED_MATCH_LEAD_MINUTES})
  `);
  return rows.map((row) => ({
    id: row.id,
    urgency: row.urgency,
    scheduledFor: row.scheduled_for.toISOString(),
  }));
}
