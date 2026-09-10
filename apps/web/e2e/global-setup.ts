import { Redis } from 'ioredis';
import {
  createAuthFixture,
  deleteAuthFixture,
  ensureTestPincode,
  openTestDb,
  prepareTestDatabase,
} from '../src/test/fixtures';

/**
 * Migrate + seed the test database, clear the test Redis DB (OTPs, rate
 * limits, dev inbox), create one consented user per role and the fictional
 * test pincode. The fixture is handed to the specs through process.env; the
 * returned function tears it down.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const url = await prepareTestDatabase();

  const redis = new Redis(process.env.REDIS_URL ?? '');
  await redis.flushdb();
  await redis.quit();

  const { db, client } = openTestDb(url);
  const fixture = await createAuthFixture(db, { consented: true });
  const pincode = await ensureTestPincode(db);
  await client.end({ timeout: 5 });
  process.env.E2E_FIXTURE = JSON.stringify({ ...fixture, pincode });

  return async () => {
    const teardown = openTestDb(url);
    await deleteAuthFixture(teardown.db, fixture);
    await teardown.client.end({ timeout: 5 });
  };
}
