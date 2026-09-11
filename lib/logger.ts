import { buildLoggerOptions } from '@/lib/core';
import { pino } from 'pino';

export const logger = pino(buildLoggerOptions());
