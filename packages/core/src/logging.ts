import type { LoggerOptions } from 'pino';
import { maskPhones } from './mask';

export interface LoggerConfig {
  level?: string;
  /** Pretty-print via pino-pretty (development only; it is a dev dependency). */
  pretty?: boolean;
}

/**
 * Shared pino options. Phone numbers are masked in the final serialized line,
 * so messages, format arguments, objects and serializer output (e.g. request
 * URLs) are all covered without walking objects that may be circular.
 */
export function buildLoggerOptions({
  level = 'info',
  pretty = false,
}: LoggerConfig = {}): LoggerOptions {
  return {
    level,
    hooks: {
      streamWrite: maskPhones,
    },
    ...(pretty ? { transport: { target: 'pino-pretty' } } : {}),
  };
}
