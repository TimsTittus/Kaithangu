import type { Logger } from 'pino';
import { z } from 'zod';

export const HEARTBEAT_QUEUE = 'heartbeat';
export const HEARTBEAT_INTERVAL_MS = 60_000;

export const heartbeatPayloadSchema = z.object({
  sentAt: z.iso.datetime(),
});
export type HeartbeatPayload = z.infer<typeof heartbeatPayloadSchema>;

export function createHeartbeatPayload(now: Date = new Date()): Buffer {
  const payload: HeartbeatPayload = { sentAt: now.toISOString() };
  return Buffer.from(JSON.stringify(payload));
}

/**
 * Process one heartbeat message. Returns false for a malformed payload so the
 * worker can reject it without requeueing; never throws.
 */
export function handleHeartbeat(content: Buffer, logger: Logger, now: Date = new Date()): boolean {
  let raw: unknown;
  try {
    raw = JSON.parse(content.toString());
  } catch {
    logger.warn({ queue: HEARTBEAT_QUEUE }, 'heartbeat payload is not JSON');
    return false;
  }
  const parsed = heartbeatPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn(
      { queue: HEARTBEAT_QUEUE, issues: parsed.error.issues },
      'invalid heartbeat payload',
    );
    return false;
  }
  const lagMs = now.getTime() - Date.parse(parsed.data.sentAt);
  logger.info({ queue: HEARTBEAT_QUEUE, sentAt: parsed.data.sentAt, lagMs }, 'heartbeat');
  return true;
}
