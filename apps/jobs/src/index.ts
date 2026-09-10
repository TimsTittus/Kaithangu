import {
  buildLoggerOptions,
  EnvValidationError,
  MATCH_QUEUE,
  NOTIFY_QUEUE,
  NOTIFY_RETRY_QUEUE,
  OFFER_TIMEOUT_DELAY_QUEUE,
  OFFER_TIMEOUT_QUEUE,
} from '@kaithangu/core';
import { connect } from 'amqplib';
import { pino } from 'pino';
import { createMatchHandler, matchJobSchema } from './consumers/match';
import { createNotifyHandler, notifyJobSchema } from './consumers/notify';
import { createOfferTimeoutHandler, offerTimeoutJobSchema } from './consumers/offerTimeout';
import { loadEnv } from './env';
import {
  createHeartbeatPayload,
  handleHeartbeat,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_QUEUE,
} from './heartbeat';
import { assertDelayQueue, assertDurableQueue, consumeQueue } from './queue';
import {
  createScheduledMatchHandler,
  createScheduledMatchTick,
  scheduledMatchTickSchema,
  SCHEDULED_MATCH_TICK_QUEUE,
} from './scheduledMatch';
import { createServices } from './services';

const SCHEDULED_MATCH_TICK_MS = 60_000;

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = pino(buildLoggerOptions({ pretty: env.NODE_ENV === 'development' }));

  const connection = await connect(env.RABBITMQ_URL);
  connection.on('error', (error: Error) =>
    logger.error({ err: error }, 'rabbitmq connection error'),
  );

  const channel = await connection.createChannel();
  channel.on('error', (error: Error) => logger.error({ err: error }, 'rabbitmq channel error'));
  await channel.prefetch(4);

  // Durable processing queues.
  await assertDurableQueue(channel, HEARTBEAT_QUEUE);
  await assertDurableQueue(channel, MATCH_QUEUE);
  await assertDurableQueue(channel, OFFER_TIMEOUT_QUEUE);
  await assertDurableQueue(channel, NOTIFY_QUEUE);
  await assertDurableQueue(channel, SCHEDULED_MATCH_TICK_QUEUE);
  // Delay queues: dead-letter into the processing queue above once expired.
  await assertDelayQueue(channel, OFFER_TIMEOUT_DELAY_QUEUE, OFFER_TIMEOUT_QUEUE);
  await assertDelayQueue(channel, NOTIFY_RETRY_QUEUE, NOTIFY_QUEUE);

  const services = createServices(env, channel, logger);

  const consumerTags: string[] = [];
  consumerTags.push(
    await channel
      .consume(HEARTBEAT_QUEUE, (message) => {
        if (!message) return;
        if (handleHeartbeat(message.content, logger)) channel.ack(message);
        else channel.nack(message, false, false);
      })
      .then(({ consumerTag }) => consumerTag),
  );
  consumerTags.push(
    await consumeQueue(
      channel,
      MATCH_QUEUE,
      matchJobSchema,
      createMatchHandler(services.dispatch),
      (error) => logger.error({ err: error }, 'match job failed'),
    ),
  );
  consumerTags.push(
    await consumeQueue(
      channel,
      OFFER_TIMEOUT_QUEUE,
      offerTimeoutJobSchema,
      createOfferTimeoutHandler(services.dispatch),
      (error) => logger.error({ err: error }, 'offer-timeout job failed'),
    ),
  );
  consumerTags.push(
    await consumeQueue(
      channel,
      NOTIFY_QUEUE,
      notifyJobSchema,
      createNotifyHandler(services.notifyDelivery, channel, logger),
      (error) => logger.error({ err: error }, 'notify job failed'),
    ),
  );
  consumerTags.push(
    await consumeQueue(
      channel,
      SCHEDULED_MATCH_TICK_QUEUE,
      scheduledMatchTickSchema,
      createScheduledMatchHandler(services.db, channel, logger),
      (error) => logger.error({ err: error }, 'scheduled-match tick failed'),
    ),
  );

  const publishHeartbeat = () => {
    channel.sendToQueue(HEARTBEAT_QUEUE, createHeartbeatPayload(), {
      persistent: true,
      contentType: 'application/json',
    });
  };
  const publishScheduledMatchTick = () => {
    channel.sendToQueue(SCHEDULED_MATCH_TICK_QUEUE, createScheduledMatchTick(), {
      persistent: true,
      contentType: 'application/json',
    });
  };
  publishHeartbeat();
  publishScheduledMatchTick();
  const heartbeatTimer = setInterval(publishHeartbeat, HEARTBEAT_INTERVAL_MS);
  const scheduledMatchTimer = setInterval(publishScheduledMatchTick, SCHEDULED_MATCH_TICK_MS);
  logger.info('jobs worker started');

  let shuttingDown = false;
  connection.on('close', () => {
    if (!shuttingDown) {
      logger.fatal('rabbitmq connection closed unexpectedly; exiting');
      process.exit(1);
    }
  });

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'jobs worker shutting down');
    clearInterval(heartbeatTimer);
    clearInterval(scheduledMatchTimer);
    try {
      await Promise.all(consumerTags.map((tag) => channel.cancel(tag)));
      await channel.close();
      await connection.close();
      await services.redis.quit();
      await services.closeDb();
      logger.info('jobs worker stopped');
    } catch (error) {
      logger.error({ err: error }, 'error during shutdown');
      process.exitCode = 1;
    }
  };
  process.once('SIGTERM', (signal) => void shutdown(signal));
  process.once('SIGINT', (signal) => void shutdown(signal));
}

main().catch((error: unknown) => {
  if (error instanceof EnvValidationError) {
    console.error(error.message);
  } else {
    console.error('jobs worker failed to start', error);
  }
  process.exit(1);
});
