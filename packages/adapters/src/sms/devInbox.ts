/**
 * Developer inbox: in mock mode, outgoing SMS are kept in the Redis list
 * `dev:inbox` (newest first, capped) so they can be read at /dev/inbox.
 */
import { z } from 'zod';

export const DEV_INBOX_KEY = 'dev:inbox';
export const DEV_INBOX_CAP = 500;

export const devInboxEntrySchema = z.object({
  to: z.string(),
  text: z.string(),
  /** ISO 8601 timestamp (UTC). */
  at: z.string(),
});

export type DevInboxEntry = z.infer<typeof devInboxEntrySchema>;

/** The Redis list commands the inbox needs (satisfied by an ioredis client). */
export interface DevInboxRedis {
  lpush(key: string, value: string): Promise<number>;
  ltrim(key: string, start: number, stop: number): Promise<unknown>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
}

export async function pushDevInbox(redis: DevInboxRedis, entry: DevInboxEntry): Promise<void> {
  await redis.lpush(DEV_INBOX_KEY, JSON.stringify(entry));
  await redis.ltrim(DEV_INBOX_KEY, 0, DEV_INBOX_CAP - 1);
}

/** Newest first. Entries that do not parse are skipped. */
export async function readDevInbox(
  redis: DevInboxRedis,
  limit: number = DEV_INBOX_CAP,
): Promise<DevInboxEntry[]> {
  const raw = await redis.lrange(DEV_INBOX_KEY, 0, Math.max(0, limit - 1));
  return raw.flatMap((item) => {
    try {
      const parsed = devInboxEntrySchema.safeParse(JSON.parse(item));
      return parsed.success ? [parsed.data] : [];
    } catch {
      return [];
    }
  });
}
