import { Redis } from 'ioredis';
import postgres from 'postgres';
import { getEnv } from '@/env';
import { logger } from '@/lib/logger';

// Kept on globalThis so dev-mode hot reloads reuse connections instead of
// opening a new pool on every edit.
const globalClients = globalThis as typeof globalThis & {
  kaithanguSql?: postgres.Sql;
  kaithanguRedis?: Redis;
};

export function getSql(): postgres.Sql {
  globalClients.kaithanguSql ??= postgres(getEnv().DATABASE_URL, {
    max: 10,
    connect_timeout: 1,
    idle_timeout: 30,
  });
  return globalClients.kaithanguSql;
}

export function getRedis(): Redis {
  if (!globalClients.kaithanguRedis) {
    const redis = new Redis(getEnv().REDIS_URL, {
      connectTimeout: 1000,
      // Fail a command after one reconnect attempt rather than queueing forever.
      maxRetriesPerRequest: 1,
    });
    // Without a listener ioredis prints every reconnect failure to stderr.
    // Reconnection continues in the background with the default backoff.
    let lastLogged = 0;
    redis.on('error', (error: Error) => {
      const now = Date.now();
      if (now - lastLogged > 30_000) {
        lastLogged = now;
        logger.warn({ err: error }, 'redis connection error');
      }
    });
    globalClients.kaithanguRedis = redis;
  }
  return globalClients.kaithanguRedis;
}
