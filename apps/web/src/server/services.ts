/**
 * Composition root: core services wired to Postgres, Redis and the adapters
 * selected by env. Handlers call these and stay thin (AGENTS.md 4.1).
 */
import { createSmsAdapter } from '@kaithangu/adapters/sms';
import { createSpeechAdapter } from '@kaithangu/adapters/speech';
import {
  createAuthService,
  createBookingService,
  createConsentService,
  createSpeechService,
  createWorkerService,
  type AuthService,
  type BookingService,
  type ConsentService,
  type SpeechService,
  type WorkerService,
} from '@kaithangu/core';
import {
  createBookingPricingRepo,
  createBookingRepo,
  createConsentRepo,
  createPlaceRepo,
  createUserRepo,
  createWorkerRepo,
  loadStateDefaultLocale,
} from '@kaithangu/db';
import { isSupportedLocale, type Locale } from '@kaithangu/i18n';
import { getEnv } from '@/env';
import { getDb, getRedis } from '@/lib/datastores';
import { logger } from '@/lib/logger';
import { createLoggingJobQueue } from '@/server/jobs';
import { createRedisOtpStore, createRedisRateLimiter } from '@/server/stores/redis';

const services = globalThis as typeof globalThis & {
  kaithanguAuth?: AuthService;
  kaithanguConsent?: ConsentService;
  kaithanguWorkers?: WorkerService;
  kaithanguBookings?: BookingService;
  kaithanguSpeech?: SpeechService;
};

export function getAuthService(): AuthService {
  if (!services.kaithanguAuth) {
    const env = getEnv();
    const redis = getRedis();
    services.kaithanguAuth = createAuthService({
      otpStore: createRedisOtpStore(redis),
      rateLimiter: createRedisRateLimiter(redis),
      sms: createSmsAdapter({ env: process.env, redis, logger }),
      users: createUserRepo(getDb()),
      otpPepper: env.OTP_PEPPER,
      sessionSecret: env.SESSION_SECRET,
      defaultStateCode: env.DEFAULT_STATE,
    });
  }
  return services.kaithanguAuth;
}

export function getConsentService(): ConsentService {
  services.kaithanguConsent ??= createConsentService({ consents: createConsentRepo(getDb()) });
  return services.kaithanguConsent;
}

export function getWorkerService(): WorkerService {
  services.kaithanguWorkers ??= createWorkerService({ workers: createWorkerRepo(getDb()) });
  return services.kaithanguWorkers;
}

export function getBookingService(): BookingService {
  if (!services.kaithanguBookings) {
    const env = getEnv();
    const db = getDb();
    services.kaithanguBookings = createBookingService({
      bookings: createBookingRepo(db),
      pricing: createBookingPricingRepo(db),
      places: createPlaceRepo(db),
      consent: getConsentService(),
      jobs: createLoggingJobQueue(logger),
      defaultStateCode: env.DEFAULT_STATE,
      // Derived job OTPs / worker check codes use the OTP pepper, with a
      // per-purpose prefix inside the HMAC message (core/booking/codes.ts).
      codeSecret: env.OTP_PEPPER,
    });
  }
  return services.kaithanguBookings;
}

export function getSpeechService(): SpeechService {
  services.kaithanguSpeech ??= createSpeechService({
    speech: createSpeechAdapter({ env: process.env }),
  });
  return services.kaithanguSpeech;
}

const DEFAULT_LOCALE_TTL_MS = 5 * 60 * 1000;
let defaultLocale: { value: Locale; loadedAt: number } | undefined;

/** state_config.default_locale of DEFAULT_STATE (cached for 5 minutes). */
export async function getDefaultLocale(): Promise<Locale> {
  if (defaultLocale && Date.now() - defaultLocale.loadedAt < DEFAULT_LOCALE_TTL_MS) {
    return defaultLocale.value;
  }
  const state = getEnv().DEFAULT_STATE;
  const raw = await loadStateDefaultLocale(getDb(), state);
  let value: Locale = 'en';
  if (raw !== null && isSupportedLocale(raw)) {
    value = raw;
  } else {
    logger.warn(
      { state, defaultLocale: raw },
      'no supported default locale for DEFAULT_STATE; using en',
    );
  }
  defaultLocale = { value, loadedAt: Date.now() };
  return value;
}
