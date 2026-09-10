export {
  ACTIONS,
  assertCan,
  can,
  POLICY,
  type Action,
  type ResourceScope,
  type ScopeRule,
} from './authz';
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
