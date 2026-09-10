import { buildLoggerOptions } from '@kaithangu/core';
import { pino } from 'pino';

export const logger = pino(buildLoggerOptions());
