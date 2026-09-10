export {
  ACTIONS,
  assertCan,
  can,
  POLICY,
  requireRole,
  scopeFilter,
  type Action,
  type ResourceScope,
  type ScopeFilter,
  type ScopeRule,
  type UserContext,
} from './authz';
export {
  ADDRESS_TEXT_MAX_LENGTH,
  cancelBookingInputSchema,
  createBookingInputSchema,
  createBookingService,
  IDEMPOTENCY_KEY_PATTERN,
  MAX_BOOKING_LIST,
  MAX_SAVED_ADDRESSES,
  NEAREST_PINCODE_MAX_METERS,
  PINCODE_PATTERN,
  PROBLEM_TEXT_MAX_LENGTH,
  quoteInputSchema,
  type BookingDeps,
  type BookingDraft,
  type BookingEventRecord,
  type BookingOptions,
  type BookingPricingInputs,
  type BookingPricingRepo,
  type BookingRecord,
  type BookingRepo,
  type BookingService,
  type BookingSummaryRecord,
  type BookingSummaryView,
  type BookingTransition,
  type BookingView,
  type BookingWorkerRecord,
  type BookingWorkerView,
  type CreateBookingOutcome,
  type CreatedBooking,
  type IdempotentBooking,
  type JobQueue,
  type MatchJob,
  type PlaceRepo,
  type QuoteView,
  type SavedAddress,
} from './services/bookings';
export {
  baseMimeType,
  createSpeechService,
  isSttMimeType,
  MAX_STT_BYTES,
  MAX_TRANSCRIPT_LENGTH,
  STT_MIME_TYPES,
  type SpeechService,
  type TranscribeRequest,
} from './services/speech';
export {
  deriveJobOtp,
  WORKER_CHECK_CODE_DIGITS,
  workerCheckCode,
  type JobOtpKind,
  type WorkerCheckInput,
} from './booking/codes';
export {
  bookableSlots,
  isBookableSlot,
  SLOT_DAYS,
  SLOT_LENGTH_HOURS,
  SLOT_MIN_LEAD_MINUTES,
  SLOT_START_HOURS,
} from './booking/slots';
export {
  buildActor,
  createAuthService,
  LOGIN_OTP_DIGITS,
  LOGIN_OTP_MAX_ATTEMPTS,
  LOGIN_OTP_TTL_SECONDS,
  OTP_RATE_WINDOW_SECONDS,
  OTP_REQUESTS_PER_IP,
  OTP_REQUESTS_PER_PHONE,
  pickLocale,
  type AuthDeps,
  type AuthService,
  type OtpRecord,
  type OtpStore,
  type RateLimiter,
  type RateLimitHit,
  type SessionUser,
  type UpsertLoginInput,
  type UserRepo,
  type VerifyOtpResult,
} from './services/auth';
export {
  CONSENT_PURPOSES,
  createConsentService,
  currentConsentVersion,
  type ConsentChannel,
  type ConsentPurpose,
  type ConsentRecordInput,
  type ConsentRepo,
  type ConsentService,
} from './services/consent';
export {
  createWorkerService,
  MAX_WORKER_PAGE_SIZE,
  WORKER_STATUSES,
  workerListFiltersSchema,
  type WorkerListFilters,
  type WorkerRepo,
  type WorkerService,
  type WorkerSkillSummary,
  type WorkerStatus,
  type WorkerSummary,
} from './services/workers';
export {
  MIN_SESSION_SECRET_LENGTH,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  sessionCookieOptions,
  signSession,
  verifySession,
  type SessionClaims,
} from './session';
export { parseInput } from './validation';
export {
  allowedNext,
  assertTransition,
  BOOKING_STATUSES,
  canTransition,
  isBookingStatus,
  type BookingStatus,
} from './booking/stateMachine';
export {
  isSystemActor,
  requestContext,
  ROLES,
  systemContext,
  type Actor,
  type RequestContext,
  type Role,
  type SystemActor,
  type SystemContextOptions,
  type UserActor,
} from './context';
export { EnvValidationError, parseEnv } from './env';
export {
  AppError,
  DEFAULT_HTTP_STATUS,
  ERROR_CODES,
  errorMessageKey,
  isAppError,
  type ErrorCode,
} from './errors';
export { gini, median, zeroJobShare } from './fairness';
export {
  destinationPoint,
  EARTH_MEAN_RADIUS_M,
  haversineDistanceM,
  haversineKm,
  randomPointWithin,
  type LngLat,
} from './geo';
export {
  buildEntriesForCash,
  buildEntriesForUpi,
  canonicalJson,
  computeHash,
  GENESIS_HASH,
  ledgerAccounts,
  sealEntries,
  verifyChain,
  type ChainVerification,
  type LedgerBooking,
  type LedgerDirection,
  type LedgerEntry,
  type LedgerEntryDraft,
  type LedgerKind,
  type SealOptions,
  type UnsealedLedgerEntry,
} from './ledger';
export { buildLoggerOptions, type LoggerConfig } from './logging';
export { maskPhones } from './mask';
export {
  EMERGENCY_WEIGHTS,
  fairnessBoost,
  NORMAL_WEIGHTS,
  rankCandidates,
  SCORE_FACTORS,
  scoreCandidate,
  weightsFor,
  type CandidateScore,
  type MatchCandidate,
  type MatchContext,
  type MatchMode,
  type RankedCandidate,
  type ScoreBreakdown,
  type ScoreExplanation,
  type ScoreFactor,
  type ScoreWeights,
} from './matching/score';
export {
  addPaise,
  formatINR,
  mulPct,
  paise,
  paiseFromBigInt,
  percentToBasisPoints,
  subPaise,
  ZERO_PAISE,
  type Paise,
  type PercentInput,
} from './money';
export { generateOtp, hashOtp, JOB_OTP_DIGITS, OTP_MAX_ATTEMPTS, verifyOtp } from './otp';
export { maskPhone, normalizeIndianPhone } from './phone';
export {
  PRICING_LINE_KEYS,
  quote,
  type PricingLineKey,
  type PricingStateConfig,
  type Quote,
  type QuoteInput,
  type TradeRates,
  type Urgency,
} from './pricing';
export { isCertifiedRequired, isTradeCode, TRADE_CODES, type TradeCode } from './trades';
export { extractProblem, type ExtractInput } from './voice/extract';
export {
  voiceActionSchema,
  voiceEventSchema,
  type ActiveJob,
  type ExtractResult,
  type Flow,
  type FlowContext,
  type FlowDeps,
  type JobOffer,
  type PincodeInfo,
  type VoiceAction,
  type VoiceEvent,
  type VoiceExpect,
  type VoiceInputMode,
  type VoicePrompt,
  type VoiceTurn,
} from './voice/types';
export { customerBookingFlow, type CustomerBookingState } from './voice/flows/customer_booking';
export { statusUpdateFlow, type StatusUpdateState } from './voice/flows/status_update';
export { workerOfferFlow, type WorkerOfferState } from './voice/flows/worker_offer';
export {
  workerAvailabilityFlow,
  type WorkerAvailabilityState,
} from './voice/flows/worker_availability';
export { workerJobFlow, type WorkerJobState } from './voice/flows/worker_job';

/** Clamp `value` into the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError('clamp: min must not exceed max');
  }
  return Math.min(max, Math.max(min, value));
}
