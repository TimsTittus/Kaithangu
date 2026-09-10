/**
 * Redis implementations of the auth ports (core/services/auth.ts).
 * - OTPs: hash `otp:{phone}` with fields hash + attempts and a TTL.
 * - Rate limits: fixed-window counters `rl:*` (INCR, EXPIRE NX).
 */
import type { OtpRecord, OtpStore, RateLimiter } from '@kaithangu/core';
import type { Redis } from 'ioredis';

export const otpKey = (phone: string) => `otp:${phone}`;

// Count an attempt only if the code still exists, so a late attempt cannot
// recreate the key without a TTL. Returns nil when there is no live code.
const RECORD_ATTEMPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return false end
local attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
local hash = redis.call('HGET', KEYS[1], 'hash')
return {attempts, hash}
`;

type ExecResult = [Error | null, unknown][] | null;

function assertExec(result: ExecResult, what: string): unknown[] {
  if (result === null) throw new Error(`redis ${what}: transaction aborted`);
  return result.map(([error, value]) => {
    if (error) throw error;
    return value;
  });
}

export function createRedisOtpStore(redis: Redis): OtpStore {
  return {
    async save(phone, hash, ttlSeconds) {
      const key = otpKey(phone);
      const result = await redis
        .multi()
        .del(key)
        .hset(key, { hash, attempts: 0 })
        .expire(key, ttlSeconds)
        .exec();
      assertExec(result, 'otp save');
    },

    async recordAttempt(phone): Promise<OtpRecord | null> {
      const reply = (await redis.eval(RECORD_ATTEMPT, 1, otpKey(phone))) as
        [number, string | null] | null;
      if (reply === null || typeof reply[1] !== 'string') return null;
      return { attempts: Number(reply[0]), hash: reply[1] };
    },

    async consume(phone) {
      return (await redis.del(otpKey(phone))) === 1;
    },
  };
}

export function createRedisRateLimiter(redis: Redis): RateLimiter {
  return {
    async hit(key, windowSeconds) {
      const result = await redis.multi().incr(key).expire(key, windowSeconds, 'NX').ttl(key).exec();
      const [count, , ttl] = assertExec(result, 'rate limit');
      const remaining = Number(ttl);
      return {
        count: Number(count),
        resetInSeconds: remaining > 0 ? remaining : windowSeconds,
      };
    },
  };
}
