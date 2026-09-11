/**
 * Job queue producer for the web app. Phase 5 only records the enqueue in the
 * log; the RabbitMQ producer and the "match" consumer (apps/jobs) arrive with
 * dispatch in Phase 6, behind the same core JobQueue port.
 */
import type { JobQueue } from '@/lib/core';

interface InfoLogger {
  info(object: Record<string, unknown>, message: string): void;
}

export function createLoggingJobQueue(logger: InfoLogger): JobQueue {
  return {
    enqueue(queue, payload) {
      logger.info({ queue, ...payload }, 'job enqueued');
      return Promise.resolve();
    },
  };
}
