export { createDb, type CreateDbOptions, type Database, type SqlClient } from './client';
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
