/**
 * Fictional tenants for integration and e2e tests (labelled "Test"):
 * two Kerala societies (A, B), one Tamil Nadu society, a user for every role
 * and a worker in each society. Locations are (0, 0) placeholders; these tests
 * never compute distances.
 */
import { randomInt } from 'node:crypto';
import { currentConsentVersion, signSession, SESSION_COOKIE, type Role } from '@kaithangu/core';
import { createDb, type Database } from '@kaithangu/db';
import {
  addresses,
  bookingEvents,
  bookings,
  consents,
  federations,
  idempotencyKeys,
  institutions,
  pincodes,
  societies,
  users,
  workers,
  workerSkills,
} from '@kaithangu/db/schema';
import { assertTestDatabaseUrl, runMigrations, seedReferenceData } from '@kaithangu/db/testing';
import { eq, inArray, like, or } from 'drizzle-orm';

const NOWHERE = { lng: 0, lat: 0 };

/** Fictional pincode for booking tests, in the fictional state "TESTLAND" at (0, 0). */
export const TEST_PINCODE = '999999';
const TEST_STATE_NAME = 'TESTLAND';

/** Make sure the test pincode row exists (the real pincode import is not run in tests). */
export async function ensureTestPincode(db: Database): Promise<string> {
  const [existing] = await db
    .select({ id: pincodes.id })
    .from(pincodes)
    .where(eq(pincodes.stateName, TEST_STATE_NAME))
    .limit(1);
  if (existing === undefined) {
    await db.insert(pincodes).values({
      pincode: TEST_PINCODE,
      officeName: 'Test Office (Demo)',
      district: 'TEST',
      stateName: TEST_STATE_NAME,
      location: NOWHERE,
    });
  }
  return TEST_PINCODE;
}

/** A random fictional Indian mobile number (+9199…). */
export function fakePhone(): string {
  return `+9199${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
}

export interface FixtureUser {
  id: string;
  phone: string;
  role: Role;
}

export const FIXTURE_USER_KEYS = [
  'customer',
  'worker',
  'lcsA',
  'lcsB',
  'stateKL',
  'stateTN',
  'national',
  'institution',
] as const;
export type FixtureUserKey = (typeof FIXTURE_USER_KEYS)[number];

export interface AuthFixture {
  federationIds: string[];
  societyIds: { a: string; b: string; tn: string };
  institutionId: string;
  users: Record<FixtureUserKey, FixtureUser>;
  /** Worker user ids by society (workers.a is users.worker). */
  workerIds: { a: string; b: string; tn: string };
}

/** Migrate and seed reference data into DATABASE_URL_TEST; returns its URL. */
export async function prepareTestDatabase(): Promise<string> {
  const url = assertTestDatabaseUrl(process.env.DATABASE_URL_TEST);
  await runMigrations(url);
  await seedReferenceData(url);
  return url;
}

export function openTestDb(url: string) {
  return createDb(url, { max: 2 });
}

export async function createAuthFixture(
  db: Database,
  { consented }: { consented: boolean },
): Promise<AuthFixture> {
  const [kl, tn] = await db
    .insert(federations)
    .values([
      { name: 'Test Federation KL', level: 'state', stateCode: 'KL' },
      { name: 'Test Federation TN', level: 'state', stateCode: 'TN' },
    ])
    .returning({ id: federations.id });
  if (!kl || !tn) throw new Error('fixture: federations not created');

  const society = (name: string, federationId: string, stateCode: string) => ({
    name,
    federationId,
    stateCode,
    district: 'TEST',
    location: NOWHERE,
    isDemo: true,
  });
  const [a, b, c] = await db
    .insert(societies)
    .values([
      society('Test Society A (Demo)', kl.id, 'KL'),
      society('Test Society B (Demo)', kl.id, 'KL'),
      society('Test Society TN (Demo)', tn.id, 'TN'),
    ])
    .returning({ id: societies.id });
  if (!a || !b || !c) throw new Error('fixture: societies not created');

  const [institution] = await db
    .insert(institutions)
    .values({
      name: 'Test Institution (Demo)',
      type: 'school',
      stateCode: 'KL',
      addressText: 'Test address',
      location: NOWHERE,
    })
    .returning({ id: institutions.id });
  if (!institution) throw new Error('fixture: institution not created');

  const specs: Record<
    FixtureUserKey | 'workerB' | 'workerTN',
    Omit<typeof users.$inferInsert, 'phone'>
  > = {
    customer: { role: 'customer', stateCode: 'KL' },
    worker: { role: 'worker', stateCode: 'KL' },
    workerB: { role: 'worker', stateCode: 'KL' },
    workerTN: { role: 'worker', stateCode: 'TN' },
    lcsA: { role: 'lcs_admin', societyId: a.id },
    lcsB: { role: 'lcs_admin', societyId: b.id },
    stateKL: { role: 'state_admin', stateCode: 'KL' },
    stateTN: { role: 'state_admin', stateCode: 'TN' },
    national: { role: 'national_admin' },
    institution: { role: 'institution_admin', institutionId: institution.id },
  };
  const keys = Object.keys(specs) as (keyof typeof specs)[];
  const inserted = await db
    .insert(users)
    .values(keys.map((key) => ({ ...specs[key], phone: fakePhone(), name: `Test ${key}` })))
    .returning({ id: users.id, phone: users.phone, role: users.role });
  const byKey = Object.fromEntries(keys.map((key, i) => [key, inserted[i]])) as Record<
    keyof typeof specs,
    FixtureUser
  >;

  await db.insert(workers).values([
    { userId: byKey.worker.id, societyId: a.id, status: 'verified', homeLocation: NOWHERE },
    { userId: byKey.workerB.id, societyId: b.id, status: 'verified', homeLocation: NOWHERE },
    { userId: byKey.workerTN.id, societyId: c.id, status: 'pending', homeLocation: NOWHERE },
  ]);
  await db.insert(workerSkills).values([
    { workerId: byKey.worker.id, tradeCode: 'plumber', level: 2, source: 'admin' },
    { workerId: byKey.workerB.id, tradeCode: 'electrician', level: 3, source: 'admin' },
  ]);

  const fixtureUsers = Object.fromEntries(
    FIXTURE_USER_KEYS.map((key) => [key, byKey[key]]),
  ) as Record<FixtureUserKey, FixtureUser>;
  if (consented) {
    await db.insert(consents).values(
      Object.values(fixtureUsers).map((user) => ({
        userId: user.id,
        purpose: 'platform_terms' as const,
        version: currentConsentVersion(),
        channel: 'web' as const,
      })),
    );
  }

  return {
    federationIds: [kl.id, tn.id],
    societyIds: { a: a.id, b: b.id, tn: c.id },
    institutionId: institution.id,
    users: fixtureUsers,
    workerIds: { a: byKey.worker.id, b: byKey.workerB.id, tn: byKey.workerTN.id },
  };
}

/** Delete users (and their bookings, addresses, consents, worker rows) by id. */
export async function deleteUsers(db: Database, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const owned = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(or(inArray(bookings.customerId, userIds), inArray(bookings.workerId, userIds)));
  const bookingIds = owned.map((row) => row.id);
  if (bookingIds.length > 0) {
    await db.delete(bookingEvents).where(inArray(bookingEvents.bookingId, bookingIds));
    await db.delete(bookings).where(inArray(bookings.id, bookingIds));
  }
  await db.delete(addresses).where(inArray(addresses.userId, userIds));
  for (const userId of userIds) {
    await db.delete(idempotencyKeys).where(like(idempotencyKeys.key, `booking.create:${userId}:%`));
  }
  await db.delete(consents).where(inArray(consents.userId, userIds));
  await db.delete(workerSkills).where(inArray(workerSkills.workerId, userIds));
  await db.delete(workers).where(inArray(workers.userId, userIds));
  await db.delete(users).where(inArray(users.id, userIds));
}

export async function deleteUsersByPhone(db: Database, phones: string[]): Promise<void> {
  if (phones.length === 0) return;
  const rows = await db.select({ id: users.id }).from(users).where(inArray(users.phone, phones));
  await deleteUsers(
    db,
    rows.map((row) => row.id),
  );
}

export async function deleteAuthFixture(db: Database, fixture: AuthFixture): Promise<void> {
  await deleteUsers(db, [
    ...new Set([
      ...Object.values(fixture.users).map((u) => u.id),
      ...Object.values(fixture.workerIds),
    ]),
  ]);
  await db.delete(institutions).where(inArray(institutions.id, [fixture.institutionId]));
  await db.delete(societies).where(inArray(societies.id, Object.values(fixture.societyIds)));
  await db.delete(federations).where(inArray(federations.id, fixture.federationIds));
}

/** A kt_session token for a fixture user, signed with SESSION_SECRET. */
export async function sessionToken(user: FixtureUser, sv = 0): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set');
  return signSession({ sub: user.id, role: user.role, sv }, secret);
}

export async function sessionCookie(user: FixtureUser, sv = 0): Promise<string> {
  return `${SESSION_COOKIE}=${await sessionToken(user, sv)}`;
}
