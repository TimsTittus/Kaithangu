/**
 * Queue topology helpers shared by every consumer (AGENTS.md 6.4; see
 * queueTopology.ts's doc comment for why delays use per-message `expiration`
 * on a static dead-letter queue rather than a queue-level TTL or the
 * delayed-message plugin).
 */
import type { Channel } from 'amqplib';

/** A plain durable queue (RabbitMQ 4 rejects transient non-exclusive queues). */
export async function assertDurableQueue(channel: Channel, name: string): Promise<void> {
  await channel.assertQueue(name, { durable: true });
}

/** A delay queue whose messages dead-letter into `targetQueue` once their TTL expires. */
export async function assertDelayQueue(
  channel: Channel,
  name: string,
  targetQueue: string,
): Promise<void> {
  await channel.assertQueue(name, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': targetQueue,
    },
  });
}

/** Publish a JSON payload to a durable queue. */
export function publishJson(
  channel: Channel,
  queue: string,
  payload: unknown,
  options: { expirationMs?: number } = {},
): void {
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
    contentType: 'application/json',
    ...(options.expirationMs === undefined ? {} : { expiration: String(options.expirationMs) }),
  });
}

/**
 * Consume `queue`: parse+validate with `schema`, call `handle`, ack on
 * success. A malformed payload is nacked without requeue (dead on arrival);
 * `handle` returning false means "processed but do it again" (backoff
 * requeue is the handler's job, e.g. notify's retry queues) and is nacked
 * without requeue too, since the handler already re-published if it wanted a
 * retry.
 */
export function consumeQueue<T>(
  channel: Channel,
  queue: string,
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  handle: (payload: T) => Promise<void>,
  onError: (error: unknown, raw: Buffer) => void,
): Promise<string> {
  return channel
    .consume(queue, (message) => {
      if (!message) return; // consumer cancelled by the broker
      let raw: unknown;
      try {
        raw = JSON.parse(message.content.toString());
      } catch {
        channel.nack(message, false, false);
        return;
      }
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        channel.nack(message, false, false);
        return;
      }
      handle(parsed.data).then(
        () => channel.ack(message),
        (error: unknown) => {
          onError(error, message.content);
          channel.nack(message, false, false);
        },
      );
    })
    .then(({ consumerTag }) => consumerTag);
}
