import { createLlmAdapter, type LlmAdapter } from '@kaithangu/adapters/llm';
import { createSpeechAdapter } from '@kaithangu/adapters/speech';
import type { SpeechAdapter } from '@kaithangu/adapters/speech/types';
import { createTelephonyAdapter, type TelephonyAdapter } from '@kaithangu/adapters/telephony';
import {
  deriveJobOtp,
  extractProblem,
  createBookingService,
  createConsentService,
  quote,
  type BookingService,
  type ConsentService,
  type FlowDeps,
  type UserRepo,
} from '@kaithangu/core';
import {
  createDb,
  createBookingPricingRepo,
  createBookingRepo,
  createCallSessionRepo,
  createConsentRepo,
  createPlaceRepo,
  createUserRepo,
  loadPricingInputs,
  type CallSessionRepo,
  type Database,
} from '@kaithangu/db';
import type { ActionExecutorDeps } from './twilio/actions';
import type { VoiceEnv } from './env';
import { createTtsCache, type TtsCache } from './twilio/tts';

/** Records job enqueues in the console; the real RabbitMQ producer lives behind the same JobQueue port (see apps/web/src/server/jobs.ts). */
function createLoggingJobQueue() {
  return {
    enqueue(queue: string, payload: unknown) {
      console.log(JSON.stringify({ queue, payload }), 'job enqueued');
      return Promise.resolve();
    },
  };
}

export interface VoiceDeps {
  db: Database;
  telephony: TelephonyAdapter;
  speech: SpeechAdapter;
  llm: LlmAdapter;
  ttsCache: TtsCache;
  callSessions: CallSessionRepo;
  flowDeps: FlowDeps;
  actions: ActionExecutorDeps;
}

export function buildVoiceDeps(env: VoiceEnv): VoiceDeps {
  const { db } = createDb(env.DATABASE_URL);
  const speech = createSpeechAdapter({ env: process.env });
  const llm = createLlmAdapter({ env: process.env });
  const telephony = createTelephonyAdapter({ env: process.env });
  const places = createPlaceRepo(db);
  const users: UserRepo = createUserRepo(db);
  const consentService: ConsentService = createConsentService({ consents: createConsentRepo(db) });
  const bookingService: BookingService = createBookingService({
    bookings: createBookingRepo(db),
    pricing: createBookingPricingRepo(db),
    places,
    consent: consentService,
    jobs: createLoggingJobQueue(),
    defaultStateCode: env.DEFAULT_STATE,
    codeSecret: env.OTP_PEPPER,
  });

  const flowDeps: FlowDeps = {
    extract: ({ transcript, locale }) => extractProblem({ transcript, locale }, llm),
    places: {
      async lookupPincode(pincode) {
        const location = await places.pincodeLocation(pincode);
        if (!location) return null;
        // A real office name lookup (vs. just a location) isn't exposed by
        // PlaceRepo yet; the pincode itself stands in until that's added.
        return { officeName: pincode, stateCode: env.DEFAULT_STATE, location };
      },
    },
    pricing: {
      async quote({ stateCode, tradeCode, estimatedMinutes, urgency }) {
        const inputs = await loadPricingInputs(db, stateCode, tradeCode);
        if (!inputs) return null;
        return quote({
          rates: inputs.rates,
          stateConfig: inputs.stateConfig,
          estimatedMinutes,
          urgency,
          isInstitution: false,
        });
      },
    },
    codes: {
      verifyJobOtp: (bookingId, kind, otp) => deriveJobOtp(env.OTP_PEPPER, bookingId, kind) === otp,
      deriveJobOtp: (bookingId, kind) => deriveJobOtp(env.OTP_PEPPER, bookingId, kind),
    },
    earnings: {
      // TODO: wire to a real worker-earnings query once one exists.
      today: () => Promise.resolve({ totalPaise: 0, jobCount: 0 }),
    },
    clock: { now: () => new Date() },
  };

  return {
    db,
    telephony,
    speech,
    llm,
    ttsCache: createTtsCache(speech, env.STORAGE_DIR),
    callSessions: createCallSessionRepo(db),
    flowDeps,
    actions: { users, bookings: bookingService, consent: consentService, defaultStateCode: env.DEFAULT_STATE },
  };
}
