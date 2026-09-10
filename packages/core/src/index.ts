export { EnvValidationError, parseEnv } from './env';
export {
  destinationPoint,
  EARTH_MEAN_RADIUS_M,
  haversineDistanceM,
  randomPointWithin,
  type LngLat,
} from './geo';
export { buildLoggerOptions, type LoggerConfig } from './logging';
export { maskPhones } from './mask';
export { isCertifiedRequired, isTradeCode, TRADE_CODES, type TradeCode } from './trades';

/** Clamp `value` into the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError('clamp: min must not exceed max');
  }
  return Math.min(max, Math.max(min, value));
}
