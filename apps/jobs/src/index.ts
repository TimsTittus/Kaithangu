import { buildLoggerOptions, EnvValidationError } from '@kaithangu/core';
import { connect } from 'amqplib';
import { pino } from 'pino';
import { loadEnv } from './env';
import {
  createHeartbeatPayload,
  handleHeartbeat,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_QUEUE,
} from './heartbeat';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = pino(buildLoggerOptions({ pretty: env.NODE_ENV === 'development' }));

  const connection = await connect(env.RABBITMQ_URL);
  // amqplib re-throws unhandled 'error' events; log them and let 'close' decide.
  connection.on('error', (error: Error) =>
    logger.error({ err: error }, 'rabbitmq connection error'),
  );

  const channel = await connection.createChannel();
  channel.on('error', (error: Error) => logger.error({ err: error }, 'rabbitmq channel error'));
  await channel.assertQueue(HEARTBEAT_QUEUE, { durable: true });
  await channel.prefetch(1);

  const { consumerTag } = await channel.consume(HEARTBEAT_QUEUE, (message) => {
    if (!message) {
      return; // consumer cancelled by the broker
    }
    if (handleHeartbeat(message.content, logger)) {
      channel.ack(message);
    } else {
      channel.nack(message, false, false);
    }
  });

  const publish = () => {
    channel.sendToQueue(HEARTBEAT_QUEUE, createHeartbeatPayload(), {
      persistent: true,
      contentType: 'application/json',
    });
  };
  publish();
  const timer = setInterval(publish, HEARTBEAT_INTERVAL_MS);
  logger.info({ queue: HEARTBEAT_QUEUE, intervalMs: HEARTBEAT_INTERVAL_MS }, 'jobs worker started');

  let shuttingDown = false;
  connection.on('close', () => {
    if (!shuttingDown) {
      logger.fatal('rabbitmq connection closed unexpectedly; exiting');
      process.exit(1);
    }
  });

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, 'jobs worker shutting down');
    clearInterval(timer);
    try {
      await channel.cancel(consumerTag);
      await channel.close();
      await connection.close();
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
