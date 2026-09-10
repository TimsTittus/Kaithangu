import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRedisOtpStore, createRedisRateLimiter, otpKey } from './redis';

// Runs against REDIS_URL_TEST (a non-zero Redis DB; see src/test/env.ts).
const redis = new Redis(process.env.REDIS_URL ?? '', { lazyConnect: true });
const store = createRedisOtpStore(redis);
const limiter = createRedisRateLimiter(redis);
const PHONE = '+919999900001';

beforeAll(async () => {
  await redis.connect();
});

beforeEach(async () => {
  await redis.flushdb();
});

afterAll(async () => {
  await redis.flushdb();
  await redis.quit();
});

describe('redis otp store', () => {
  it('saves a hash with zero attempts and the TTL', async () => {
    await store.save(PHONE, 'a'.repeat(64), 300);
    expect(await redis.hgetall(otpKey(PHONE))).toEqual({ hash: 'a'.repeat(64), attempts: '0' });
    const ttl = await redis.ttl(otpKey(PHONE));
    expect(ttl).toBeGreaterThan(295);
    expect(ttl).toBeLessThanOrEqual(300);
  });

  it('counts attempts atomically and keeps the TTL', async () => {
    await store.save(PHONE, 'b'.repeat(64), 300);
    const results = await Promise.all(Array.from({ length: 10 }, () => store.recordAttempt(PHONE)));
    expect(results.map((r) => r?.attempts).sort((x, y) => (x ?? 0) - (y ?? 0))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(results.every((r) => r?.hash === 'b'.repeat(64))).toBe(true);
    expect(await redis.ttl(otpKey(PHONE))).toBeGreaterThan(0);
  });

  it('never recreates a missing or expired code', async () => {
    await expect(store.recordAttempt(PHONE)).resolves.toBeNull();
    expect(await redis.exists(otpKey(PHONE))).toBe(0);
    await store.save(PHONE, 'c'.repeat(64), 1);
    await redis.pexpire(otpKey(PHONE), 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(store.recordAttempt(PHONE)).resolves.toBeNull();
    expect(await redis.exists(otpKey(PHONE))).toBe(0);
  });

  it('consume is true only for the call that deletes the code', async () => {
    await store.save(PHONE, 'd'.repeat(64), 300);
    const results = await Promise.all([store.consume(PHONE), store.consume(PHONE)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('a new save resets attempts', async () => {
    await store.save(PHONE, 'e'.repeat(64), 300);
    await store.recordAttempt(PHONE);
    await store.save(PHONE, 'f'.repeat(64), 300);
    await expect(store.recordAttempt(PHONE)).resolves.toEqual({
      attempts: 1,
      hash: 'f'.repeat(64),
    });
  });
});

describe('redis rate limiter', () => {
  it('counts within a fixed window that later hits do not extend', async () => {
    const first = await limiter.hit('rl:test', 600);
    expect(first).toEqual({ count: 1, resetInSeconds: 600 });
    await redis.expire('rl:test', 100);
    const second = await limiter.hit('rl:test', 600);
    expect(second.count).toBe(2);
    expect(second.resetInSeconds).toBeLessThanOrEqual(100);
  });

  it('starts a new window after expiry', async () => {
    await limiter.hit('rl:test2', 600);
    await redis.del('rl:test2');
    await expect(limiter.hit('rl:test2', 600)).resolves.toEqual({ count: 1, resetInSeconds: 600 });
  });
});
