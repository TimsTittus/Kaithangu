/**
 * `scheduled-match` (AGENTS.md 6.4: "Scheduled bookings: matching starts
 * 60 min before scheduled_for"). A self-republishing tick, exactly like
 * heartbeat.ts, rather than a delay queue: a scheduled booking's delay is
 * per-booking and arbitrary, and RabbitMQ only discards a per-message TTL at
 * the queue head, so a far-future booking published first would block a
 * near-future one published after it (see queueTopology.ts). Each tick scans
 * bookings directly (the DB is the source of truth for "when"), which also
 * means matching still starts within one tick interval even if this process
 * restarts.
 */
import { MATCH_QUEUE } from '@kaithangu/core';
import { findDueScheduledBookings, type Database } from '@kaithangu/db';
import type { Channel } from 'amqplib';
import type { Logger } from 'pino';
import { z } from 'zod';
import { publishJson } from './queue';

export const SCHEDULED_MATCH_TICK_QUEUE = 'scheduled-match';

export const scheduledMatchTickSchema = z.object({ sentAt: z.iso.datetime() });
export type ScheduledMatchTick = z.infer<typeof scheduledMatchTickSchema>;

export function createScheduledMatchTick(now: Date = new Date()): Buffer {
  const payload: ScheduledMatchTick = { sentAt: now.toISOString() };
  return Buffer.from(JSON.stringify(payload));
}

export function createScheduledMatchHandler(db: Database, channel: Channel, logger: Logger) {
  return async (_tick: ScheduledMatchTick): Promise<void> => {
    const due = await findDueScheduledBookings(db);
    for (const booking of due) {
      publishJson(channel, MATCH_QUEUE, {
        bookingId: booking.id,
        urgency: booking.urgency,
        scheduledFor: booking.scheduledFor,
      });
    }
    if (due.length > 0) {
      logger.info({ count: due.length }, 'scheduled-match: re-enqueued due bookings');
    }
  };
}
