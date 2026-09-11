/**
 * Composition root: core services wired to Postgres, Redis and the adapters
 * selected by env. Handlers call these and stay thin (AGENTS.md 4.1).
 */
import { createSmsAdapter } from '@/lib/adapters/sms';
import { createSpeechAdapter } from '@/lib/adapters/speech';
import {
  createAuthService,
  createBookingService,
  createConsentService,
  createCorporateService,
  createSpeechService,
  createWorkerOnboardingService,
  createWorkerService,
  type AuthService,
  type BookingService,
  type ConsentService,
  type CorporateService,
  type SpeechService,
  type WorkerOnboardingService,
  type WorkerService,
} from '@/lib/core';
import {
  createBookingPricingRepo,
  createBookingRepo,
  createConsentRepo,
  createCorporateRepo,
  createPlaceRepo,
  createUserRepo,
  createWorkerEligibilityRepo,
  createWorkerOnboardingRepo,
  createWorkerRepo,
  loadStateDefaultLocale,
  db,
} from '@/db';
import { isSupportedLocale, type Locale } from '@/lib/i18n';
import { getEnv } from '@/env';
import { logger } from '@/lib/logger';
import { createLoggingJobQueue } from '@/server/jobs';

const services = globalThis as typeof globalThis & {
  kaithanguAuth?: AuthService;
  kaithanguConsent?: ConsentService;
  kaithanguCorporate?: CorporateService;
  kaithanguWorkers?: WorkerService;
  kaithanguBookings?: BookingService;
  kaithanguSpeech?: SpeechService;
  kaithanguWorkerOnboarding?: WorkerOnboardingService;
};

export function getAuthService(): AuthService {
  if (!services.kaithanguAuth) {
    const env = getEnv();
    services.kaithanguAuth = createAuthService({
      sms: createSmsAdapter(),
      users: createUserRepo(db),
      sessionSecret: env.SESSION_SECRET,
      defaultStateCode: env.DEFAULT_STATE,
    });
  }
  return services.kaithanguAuth;
}

export function getConsentService(): ConsentService {
  services.kaithanguConsent ??= createConsentService({ consents: createConsentRepo(db) });
  return services.kaithanguConsent;
}

export function getCorporateService(): CorporateService {
  services.kaithanguCorporate ??= createCorporateService({
    corporate: createCorporateRepo(db),
    workers: createWorkerRepo(db),
  });
  return services.kaithanguCorporate;
}

export function getWorkerService(): WorkerService {
  services.kaithanguWorkers ??= createWorkerService({ workers: createWorkerRepo(db) });
  return services.kaithanguWorkers;
}

export function getBookingService(): BookingService {
  if (!services.kaithanguBookings) {
    const env = getEnv();
    services.kaithanguBookings = createBookingService({
      bookings: createBookingRepo(db),
      workers: createWorkerEligibilityRepo(db),
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

export function getWorkerOnboardingService(): WorkerOnboardingService {
  if (!services.kaithanguWorkerOnboarding) {
    const env = getEnv();
    services.kaithanguWorkerOnboarding = createWorkerOnboardingService({
      sms: createSmsAdapter(),
      users: createUserRepo(db),
      onboarding: createWorkerOnboardingRepo(db),
      places: createPlaceRepo(db),
      consents: createConsentRepo(db),
      defaultStateCode: env.DEFAULT_STATE,
    });
  }
  return services.kaithanguWorkerOnboarding;
}

const DEFAULT_LOCALE_TTL_MS = 5 * 60 * 1000;
let defaultLocale: { value: Locale; loadedAt: number } | undefined;

/** state_config.default_locale of DEFAULT_STATE (cached for 5 minutes). */
export async function getDefaultLocale(): Promise<Locale> {
  if (defaultLocale && Date.now() - defaultLocale.loadedAt < DEFAULT_LOCALE_TTL_MS) {
    return defaultLocale.value;
  }
  const state = getEnv().DEFAULT_STATE;
  const raw = await loadStateDefaultLocale(db, state);
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
