/**
 * Composition root for apps/jobs, mirroring apps/web/src/server/services.ts:
 * core services wired to Postgres, Redis and the adapters selected by env.
 */
import { createSmsAdapter } from '@kaithangu/adapters/sms';
import { createTelephonyAdapter } from '@kaithangu/adapters/telephony';
import {
  createDispatchService,
  createNotifyDeliveryService,
  NOTIFY_QUEUE,
  OFFER_TIMEOUT_DELAY_QUEUE,
  type DispatchService,
  type NotifyDeliveryService,
  type Notifier,
  type OfferScheduler,
} from '@kaithangu/core';
import { createDb, createDispatchRepo, createNotificationRepo, type Database } from '@kaithangu/db';
import type { Channel } from 'amqplib';
import { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { JobsEnv } from './env';
import { publishJson } from './queue';

export interface Services {
  db: Database;
  closeDb: () => Promise<void>;
  redis: Redis;
  dispatch: DispatchService;
  notifyDelivery: NotifyDeliveryService;
}

function createOfferScheduler(channel: Channel): OfferScheduler {
  return {
    scheduleOfferTimeout(offerId, delaySeconds) {
      publishJson(
        channel,
        OFFER_TIMEOUT_DELAY_QUEUE,
        { offerId },
        { expirationMs: delaySeconds * 1000 },
      );
      return Promise.resolve();
    },
  };
}

function createNotifier(channel: Channel): Notifier {
  return {
    notify(input) {
      publishJson(channel, NOTIFY_QUEUE, { ...input, attempt: 1 });
      return Promise.resolve();
    },
  };
}

export function createServices(env: JobsEnv, channel: Channel, logger: Logger): Services {
  const { db, client } = createDb(env.DATABASE_URL);
  const closeDb = () => client.end({ timeout: 5 });
  const redis = new Redis(env.REDIS_URL, { connectTimeout: 1000, maxRetriesPerRequest: 1 });
  redis.on('error', (error: Error) => logger.warn({ err: error }, 'redis connection error'));

  const dispatch = createDispatchService({
    repo: createDispatchRepo(db),
    scheduler: createOfferScheduler(channel),
    notifier: createNotifier(channel),
    codeSecret: env.OTP_PEPPER,
    offerTimeoutSeconds: env.OFFER_TIMEOUT_SECONDS,
  });

  const notifyDelivery = createNotifyDeliveryService({
    notifications: createNotificationRepo(db),
    sms: createSmsAdapter({ env: process.env, redis, logger }),
    telephony: createTelephonyAdapter({ env: process.env, redis, logger }),
  });

  return { db, closeDb, redis, dispatch, notifyDelivery };
}
