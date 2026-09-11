import type { OtpRecord, OtpStore } from '@/lib/core';
import type { Redis } from '@upstash/redis';

export const otpKey = (phone: string) => `otp:${phone}`;

const RECORD_ATTEMPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return false end
local attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
local hash = redis.call('HGET', KEYS[1], 'hash')
return {attempts, hash}
`;

export function createRedisOtpStore(redis: Redis): OtpStore {
  return {
    async save(phone, hash, ttlSeconds) {
      const key = otpKey(phone);
      const pipeline = redis.pipeline();
      pipeline.del(key);
      pipeline.hset(key, { hash, attempts: 0 });
      pipeline.expire(key, ttlSeconds);
      await pipeline.exec();
    },

    async recordAttempt(phone): Promise<OtpRecord | null> {
      const reply = await redis.eval(RECORD_ATTEMPT, [otpKey(phone)], []);
      if (!Array.isArray(reply) || typeof reply[1] !== 'string') return null;
      return { attempts: Number(reply[0]), hash: reply[1] };
    },

    async consume(phone) {
      return (await redis.del(otpKey(phone))) === 1;
    },
  };
}
