export { createDb, type CreateDbOptions, type Database, type SqlClient } from './client';
export { createConsentRepo } from './queries/consents';
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
