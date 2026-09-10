/**
 * Voice v1 (Phase 7): the dialog engine is a pure state machine, independent
 * of any transport. Twilio webhooks (record-per-turn), the simulator, and
 * realtime media streams (Phase 8) all just translate their own I/O into
 * VoiceEvents and turn a VoiceTurn back into their own output. A Flow never
 * touches a transport, a database connection, or the clock directly — those
 * come in through `deps` so flows stay testable with the simulator's mocks.
 */
import { z } from 'zod';
import { SUPPORTED_LOCALES, type Locale } from '@kaithangu/i18n';
import type { LngLat } from '../geo';
import type { Quote, Urgency } from '../pricing';
import { TRADE_CODES, type TradeCode } from '../trades';

export const voiceEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start') }),
  z.object({
    type: z.literal('speech'),
    transcript: z.string(),
    confidence: z.number().min(0).max(1).optional(),
    detectedLocale: z.enum(SUPPORTED_LOCALES).optional(),
  }),
  z.object({ type: z.literal('dtmf'), digits: z.string().regex(/^[0-9*#]+$/) }),
  z.object({ type: z.literal('timeout') }),
  z.object({ type: z.literal('hangup') }),
]);
export type VoiceEvent = z.infer<typeof voiceEventSchema>;

export interface VoicePrompt {
  /** i18n key in the `voice` namespace, e.g. `voice.consent.intro`. */
  key: string;
  params?: Record<string, string | number>;
}

export type VoiceInputMode = 'speech' | 'dtmf' | 'speech_or_dtmf';

export interface VoiceExpect {
  mode: VoiceInputMode;
  /** Required when mode includes 'dtmf': exact digit count to collect. */
  dtmfDigits?: number;
  maxSeconds: number;
}

export const voiceActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('createBooking'), payload: z.record(z.string(), z.unknown()) }),
  z.object({ type: z.literal('acceptOffer'), offerId: z.uuid() }),
  z.object({ type: z.literal('declineOffer'), offerId: z.uuid() }),
  z.object({ type: z.literal('setAvailability'), available: z.boolean() }),
  z.object({ type: z.literal('startJob'), otp: z.string() }),
  z.object({ type: z.literal('completeJob'), otp: z.string() }),
  z.object({ type: z.literal('recordConsent'), purpose: z.string() }),
  z.object({ type: z.literal('setLocale'), locale: z.enum(SUPPORTED_LOCALES) }),
]);
export type VoiceAction = z.infer<typeof voiceActionSchema>;

export interface VoiceTurn {
  prompts: VoicePrompt[];
  /** null means the call ends after this turn's prompts (no further input awaited). */
  expect: VoiceExpect | null;
  actions: VoiceAction[];
  end: boolean;
}

export interface ExtractResult {
  tradeCode: TradeCode | null;
  confidence: number;
  urgency: 'normal' | 'emergency' | null;
  timePreference: 'now' | 'today' | 'tomorrow' | null;
  problemSummaryEn: string;
  safetyRisk: boolean;
  outOfScope: boolean;
}

export interface PincodeInfo {
  officeName: string;
  stateCode: string;
  location: LngLat;
}

/**
 * Data a flow needs to decide what to say next, but which only the transport
 * can produce (an LLM call, a DB lookup, the clock). These are read-only:
 * anything that mutates state (createBooking, acceptOffer, recordConsent, …)
 * is instead emitted as a VoiceAction in the turn and executed by the
 * transport through core services, with its result fed back as an event —
 * flows themselves never call a mutating service directly.
 */
export interface FlowDeps {
  extract(input: { transcript: string; locale: Locale }): Promise<ExtractResult>;
  places: {
    /** null when the pincode is unknown. */
    lookupPincode(pincode: string): Promise<PincodeInfo | null>;
  };
  pricing: {
    /** null when no rates/config are configured for this state+trade yet. */
    quote(input: {
      stateCode: string;
      tradeCode: TradeCode;
      estimatedMinutes: number;
      urgency: Urgency;
    }): Promise<Quote | null>;
  };
  codes: {
    /** Pure HMAC check (booking/codes.ts deriveJobOtp) — no DB round trip. */
    verifyJobOtp(bookingId: string, kind: 'start' | 'complete', otp: string): boolean;
    /** Re-derives the same OTP the worker's app shows, to read it out to the customer. */
    deriveJobOtp(bookingId: string, kind: 'start' | 'complete'): string;
  };
  earnings: {
    today(workerId: string): Promise<{ totalPaise: number; jobCount: number }>;
  };
  clock: { now(): Date };
}

/** A job assigned to a worker, known before a worker_job or status_update call starts. */
export interface ActiveJob {
  bookingId: string;
  workerId: string;
  workerName: string;
  tradeCode: TradeCode;
  societyName: string;
  customerName: string | null;
  arrivalEstimateMinutes: number | null;
}

/** An offer awaiting the worker's accept/decline, known before an outbound offer call starts. */
export interface JobOffer {
  offerId: string;
  tradeCode: TradeCode;
  locality: string;
  distanceKm: number;
  wagePaise: number;
}

export interface FlowContext {
  callerPhone: string;
  /** Known caller's stored locale, if any (skips the language menu). */
  knownLocale?: Locale;
  /** Set by the transport for worker-side flows once it has resolved the caller/callee. */
  workerId?: string;
  activeJob?: ActiveJob;
  offer?: JobOffer;
}

export interface Flow<State> {
  id: string;
  initial(ctx: FlowContext): State;
  step(state: State, event: VoiceEvent, deps: FlowDeps): Promise<{ state: State; turn: VoiceTurn }>;
}

/** Re-exported so flow files can validate trade codes without importing trades.ts directly. */
export { TRADE_CODES, type TradeCode };
