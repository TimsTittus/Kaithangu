/**
 * RabbitMQ queue names shared between apps/web (producer) and apps/jobs
 * (consumer + producer of its own delay/retry messages), AGENTS.md 6.4.
 * Plain string/number constants only — no amqplib import here (AGENTS.md 4.1:
 * core has no adapter/framework dependency). Each app's own amqp setup code
 * asserts the actual queues using these names so both sides agree without
 * duplicating literals.
 *
 * Delays use per-message `expiration` (set by the publisher) + a queue whose
 * dead-letter target is the real processing queue, not a queue-level
 * `x-message-ttl` — that keeps the queue's declare arguments static (so two
 * apps asserting the same queue never disagree because of an env value) and
 * avoids needing the delayed-message plugin, which the base RabbitMQ image
 * doesn't ship. `offer-timeout-delay` carries one fixed delay
 * (OFFER_TIMEOUT_SECONDS) so head-of-line ordering is exact; `notify-retry`
 * carries a short backoff that can differ by attempt, which only risks a
 * message being delivered a little late (never lost or reordered past a
 * still-live message), an acceptable trade for not needing N attempt-numbered
 * queues. Scheduled bookings are handled by a periodic DB poll instead of a
 * delay queue (see apps/jobs/src/scheduledMatch.ts) because their delay is
 * per-booking and arbitrary, which per-message TTL cannot order safely.
 */

export const MATCH_QUEUE = 'match';
export const OFFER_TIMEOUT_QUEUE = 'offer-timeout';
export const OFFER_TIMEOUT_DELAY_QUEUE = 'offer-timeout-delay';
export const NOTIFY_QUEUE = 'notify';
export const NOTIFY_RETRY_QUEUE = 'notify-retry';
export const SCHEDULED_MATCH_QUEUE = 'scheduled-match';

/** notify-retry backoff in ms, one entry per retry attempt (not counting the first try). */
export const NOTIFY_RETRY_DELAYS_MS: readonly number[] = [5_000, 15_000];
export const NOTIFY_MAX_ATTEMPTS = NOTIFY_RETRY_DELAYS_MS.length + 1;

/** How far ahead of a scheduled booking matching should start (AGENTS.md 6.4). */
export const SCHEDULED_MATCH_LEAD_MINUTES = 60;
/** How often the scheduled-match scanner ticks. */
export const SCHEDULED_MATCH_POLL_MS = 60_000;
