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
  OPEN_JOB_STATUSES,
  NEAREST_PINCODE_MAX_METERS,
  PINCODE_PATTERN,
  PROBLEM_TEXT_MAX_LENGTH,
  advanceBookingInputSchema,
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
  type BookingClaim,
  type MatchJob,
  type OpenJobFilter,
  type OpenJobRecord,
  type OpenJobView,
  type PincodeGeocode,
  type PlaceRepo,
  type WorkerEligibility,
  type WorkerEligibilityRepo,
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
  pickLocale,
  type AuthDeps,
  type AuthService,
  type SessionUser,
  type UpsertLoginInput,
  type UserRepo,
  type VerifyOtpResult,
} from './services/auth';
export {
  CONSENT_PURPOSES,
  createConsentService,
  currentConsentVersion,
  type ConsentPurpose,
  type ConsentRecordInput,
  type ConsentRepo,
  type ConsentService,
} from './services/consent';
export {
  createCorporateService,
  type CorporateBookingSummary,
  type CorporateDashboardData,
  type CorporateDeps,
  type CorporateProfileData,
  type CorporateRepo,
  type CorporateService,
} from './services/corporate';
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
  AI_WEBHOOK_TOOLS,
  SERVICE_RADIUS_KM,
  VOICE_CONSENT_VERSION,
  WORKER_AVAILABILITY_DAYS,
  WORKER_AVAILABILITY_HOURS,
  WORKER_CERTIFICATION_STATUSES,
  WORKER_ONBOARDING_STEPS,
  WORKER_REGISTRATION_STATUSES,
  createWorkerOnboardingService,
  isAiWebhookTool,
  parseAvailabilityDays,
  parseAvailabilityHours,
  parsePreferredLocale,
  parseServiceRadius,
  parseSkillLevel,
  parseUpiId,
  type AiWebhookTool,
  type ServiceRadiusKm,
  type WorkerAvailabilityDays,
  type WorkerAvailabilityHours,
  type WorkerCertificationStatus,
  type WorkerOnboardingDeps,
  type WorkerOnboardingPatch,
  type WorkerOnboardingRecord,
  type WorkerOnboardingRepo,
  type WorkerOnboardingService,
  type WorkerOnboardingStep,
  type WorkerRegistrationStatus,
  type WorkerServiceAreaRecord,
  type WorkerSkillLevel,
  type WorkerSkillRecord,
} from './services/workerOnboarding';
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
export {
  destinationPoint,
  EARTH_MEAN_RADIUS_M,
  haversineDistanceM,
  haversineKm,
  randomPointWithin,
  type LngLat,
} from './geo';
export { canonicalJson } from './canonicalJson';
export { buildLoggerOptions, type LoggerConfig } from './logging';
export { maskPhones } from './mask';
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

/** Clamp `value` into the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError('clamp: min must not exceed max');
  }
  return Math.min(max, Math.max(min, value));
}
