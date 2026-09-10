import { Redis } from 'ioredis';
import {
  createAuthFixture,
  deleteAuthFixture,
  openTestDb,
  prepareTestDatabase,
} from '../src/test/fixtures';

/**
 * Migrate + seed the test database, clear the test Redis DB (OTPs, rate
 * limits, dev inbox) and create one consented user per role. The fixture is
 * handed to the specs through process.env; the returned function tears it down.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const url = await prepareTestDatabase();

  const redis = new Redis(process.env.REDIS_URL ?? '');
  await redis.flushdb();
  await redis.quit();

  const { db, client } = openTestDb(url);
  const fixture = await createAuthFixture(db, { consented: true });
  await client.end({ timeout: 5 });
  process.env.E2E_FIXTURE = JSON.stringify(fixture);

  return async () => {
    const teardown = openTestDb(url);
    await deleteAuthFixture(teardown.db, fixture);
    await teardown.client.end({ timeout: 5 });
  };
}
