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

/** Clamp `value` into the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) {
    throw new RangeError('clamp: min must not exceed max');
  }
  return Math.min(max, Math.max(min, value));
}
