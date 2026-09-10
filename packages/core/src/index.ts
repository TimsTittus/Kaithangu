export { EnvValidationError, parseEnv } from './env';
export { buildLoggerOptions, type LoggerConfig } from './logging';
export { maskPhones } from './mask';

/** Clamp `value` into the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError('clamp: min must not exceed max');
  }
  return Math.min(max, Math.max(min, value));
}
