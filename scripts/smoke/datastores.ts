/**
 * Smoke test for the three local datastores, exercising exactly the client
 * calls the apps rely on. Run: bun run smoke:datastores (needs docker compose up).
 */
import { connect } from 'amqplib';
import { Redis } from 'ioredis';
import postgres from 'postgres';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set (copy .env.example to .env)`);
  }
  return value;
}

async function smokePostgres(): Promise<void> {
  const sql = postgres(required('DATABASE_URL'), { max: 1, connect_timeout: 2 });
  try {
    const [row] = await sql<{ ok: number; postgis: string }[]>`
      SELECT 1 AS ok, postgis_lib_version() AS postgis`;
    const extensions = await sql<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'pgcrypto') ORDER BY extname`;
    console.log('postgres:', row, extensions.map((e) => e.extname).join(','));
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function smokeRedis(): Promise<void> {
  const redis = new Redis(required('REDIS_URL'), {
    lazyConnect: true,
    connectTimeout: 1000,
    maxRetriesPerRequest: 1,
  });
  try {
    await redis.connect();
    const pong = await redis.ping();
    // Same primitive the dispatch accept lock will use (SET NX with TTL).
    const first = await redis.set('smoke:lock', '1', 'PX', 5000, 'NX');
    const second = await redis.set('smoke:lock', '1', 'PX', 5000, 'NX');
    await redis.del('smoke:lock');
    console.log('redis:', { pong, firstLock: first, secondLock: second });
  } finally {
    redis.disconnect();
  }
}

async function smokeRabbit(): Promise<void> {
  const connection = await connect(required('RABBITMQ_URL'));
  // Without listeners, amqplib re-throws protocol errors and crashes the process.
  connection.on('error', (error) => console.error('rabbitmq connection error', error));
  try {
    const channel = await connection.createChannel();
    channel.on('error', (error) => console.error('rabbitmq channel error', error));
    // RabbitMQ 4.x rejects transient non-exclusive queues; a throwaway queue
    // must be exclusive (real work queues are durable).
    const { queue } = await channel.assertQueue('', { exclusive: true });
    const received = new Promise<string>((resolve) => {
      void channel.consume(queue, (message) => {
        if (message) {
          channel.ack(message);
          resolve(message.content.toString());
        }
      });
    });
    channel.sendToQueue(queue, Buffer.from('ping'));
    console.log('rabbitmq: received', await received);
    await channel.close();
  } finally {
    await connection.close();
  }
}

try {
  await smokePostgres();
  await smokeRedis();
  await smokeRabbit();
  console.log('smoke:datastores OK');
} catch (error) {
  console.error('smoke:datastores FAILED', error);
  process.exitCode = 1;
}
