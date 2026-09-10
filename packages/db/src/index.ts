export { createDb, type CreateDbOptions, type Database, type SqlClient } from './client';
export { bookingScopeCondition, createBookingRepo } from './queries/bookings';
export { createBookingPricingRepo } from './queries/bookingPricing';
export {
  createCallSessionRepo,
  type CallDirection,
  type CallPurpose,
  type CallSessionRepo,
  type CallSessionRow,
  type CreateCallSessionInput,
} from './queries/callSessions';
export { createConsentRepo } from './queries/consents';
export { createPlaceRepo } from './queries/places';
export { loadStateDefaultLocale } from './queries/stateConfig';
export { createUserRepo } from './queries/users';
export { createWorkerRepo, workerScopeCondition } from './queries/workers';
export {
  loadPricingInputs,
  type PricingInputs,
  type StateConfigRow,
  type StateTradeRateRow,
} from './queries/pricing';

/**
 * Mask the password in a Postgres connection URL so it can be logged safely.
 * Throws on strings that are not URLs rather than echoing them back.
 */
export function redactDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  if (url.password !== '') {
    url.password = '***';
  }
  return url.toString();
}
