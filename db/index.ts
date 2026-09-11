import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL as string;

function connect(url: string, max = 10) {
  return postgres(url, {
    max,
    prepare: false,
    ssl: 'require',
    onnotice: () => {},
  });
}

export function createDb(databaseUrl: string, options: { max?: number } = {}) {
  const sql = connect(databaseUrl, options.max ?? 10);
  return { db: drizzle(sql, { schema }), client: sql };
}

export const client = connect(connectionString);
export const db = drizzle(client, { schema });
export type Database = typeof db;

export function redactDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  if (url.password !== '') url.password = '***';
  return url.toString();
}

export { createBookingRepo, bookingScopeCondition } from './queries/bookings';
export { createBookingPricingRepo } from './queries/bookingPricing';
export { createConsentRepo } from './queries/consents';
export {
  createCorporateRepo,
  type CorporateBookingSummary,
  type CorporateDashboardData,
  type CorporateProfileData,
  type CorporateRepo,
} from './queries/corporate';
export { createPlaceRepo } from './queries/places';
export { loadStateDefaultLocale } from './queries/stateConfig';
export { createUserRepo } from './queries/users';
export { createWorkerRepo, workerScopeCondition } from './queries/workers';
export { createWorkerEligibilityRepo } from './queries/workerEligibility';
export {
  loadPricingInputs,
  type PricingInputs,
  type StateConfigRow,
  type StateTradeRateRow,
} from './queries/pricing';
