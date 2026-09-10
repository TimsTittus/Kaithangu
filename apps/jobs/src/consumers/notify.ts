/**
 * `notify` consumer (AGENTS.md 6.4 "retries with backoff for notify only").
 * On delivery failure this republishes to the shared notify-retry delay
 * queue with the next attempt's backoff instead of letting the broker
 * redeliver the original message — a dispatch *decision* (which candidate,
 * accept/decline/timeout) is never retried, only the act of sending a
 * message that dispatch already decided to send.
 */
import { NOTIFY_MAX_ATTEMPTS, NOTIFY_RETRY_DELAYS_MS, NOTIFY_RETRY_QUEUE } from '@kaithangu/core';
import type { NotifyDeliveryService } from '@kaithangu/core';
import { SUPPORTED_LOCALES } from '@kaithangu/i18n';
import type { Channel } from 'amqplib';
import type { Logger } from 'pino';
import { z } from 'zod';
import { publishJson } from '../queue';

export const notifyJobSchema = z.object({
  userId: z.string(),
  channel: z.enum(['app', 'sms', 'ivr']),
  kind: z.string(),
  bookingId: z.uuid().nullable(),
  titleKey: z.string(),
  params: z.record(z.string(), z.union([z.string(), z.number()])),
  locale: z.enum(SUPPORTED_LOCALES),
  phone: z.string().nullable(),
  /** 1 on the first attempt; bumped on each retry publish. */
  attempt: z.number().int().min(1).default(1),
});
export type NotifyJobPayload = z.infer<typeof notifyJobSchema>;

export function createNotifyHandler(
  delivery: Pick<NotifyDeliveryService, 'deliver'>,
  channel: Channel,
  logger: Pick<Logger, 'error' | 'warn'>,
) {
  return async (payload: NotifyJobPayload): Promise<void> => {
    const { attempt, ...input } = payload;
    try {
      await delivery.deliver(input);
    } catch (error) {
      if (attempt < NOTIFY_MAX_ATTEMPTS) {
        const delayMs =
          NOTIFY_RETRY_DELAYS_MS[attempt - 1] ?? NOTIFY_RETRY_DELAYS_MS.at(-1) ?? 5_000;
        publishJson(
          channel,
          NOTIFY_RETRY_QUEUE,
          { ...payload, attempt: attempt + 1 },
          { expirationMs: delayMs },
        );
        logger.warn(
          { err: error, attempt, kind: payload.kind },
          'notify failed, retrying with backoff',
        );
      } else {
        logger.error(
          { err: error, attempt, kind: payload.kind },
          'notify failed permanently, dropping',
        );
      }
    }
  };
}
