/**
 * Phone OTP sign-in and sessions (Phase 4).
 * - requestOtp: normalise the phone, rate-limit (per IP and per phone), store a
 *   hashed 6-digit code for 5 minutes and send it by SMS.
 * - verifyOtp: at most 5 attempts per code (the code is deleted on the 5th
 *   wrong one), then upsert the user and issue a session token.
 * - authenticate: turn a session cookie into a RequestContext, rejecting tokens
 *   whose session_version no longer matches the DB (logout-all).
 * Storage, SMS and the user table are ports so this module stays pure.
 */
import { isSupportedLocale, type Locale } from '@kaithangu/i18n';
import { isNotConfiguredError, type SmsAdapter } from '@kaithangu/adapters/sms/types';
import type { RequestContext, Role, UserActor } from '../context';
import { AppError } from '../errors';
import { generateOtp, hashOtp, verifyOtp as matchesOtpHash } from '../otp';
import { normalizeIndianPhone } from '../phone';
import { signSession, verifySession } from '../session';
import { requireRole } from '../authz';

export const LOGIN_OTP_DIGITS = 6;
export const LOGIN_OTP_TTL_SECONDS = 300;
export const LOGIN_OTP_MAX_ATTEMPTS = 5;
export const OTP_RATE_WINDOW_SECONDS = 600;
export const OTP_REQUESTS_PER_PHONE = 3;
export const OTP_REQUESTS_PER_IP = 20;

export interface OtpRecord {
  hash: string;
  /** Attempts made so far, including the one just recorded. */
  attempts: number;
}

/** Redis key otp:{phone} in production. */
export interface OtpStore {
  /** Store a fresh code hash with zero attempts, replacing any previous code. */
  save(phone: string, hash: string, ttlSeconds: number): Promise<void>;
  /** Atomically count one attempt against the live code; null when there is none. */
  recordAttempt(phone: string): Promise<OtpRecord | null>;
  /** Delete the code; true only for the call that actually removed it. */
  consume(phone: string): Promise<boolean>;
}

export interface RateLimitHit {
  /** Requests in the current window, including this one. */
  count: number;
  /** Seconds until the window resets. */
  resetInSeconds: number;
}

/** Fixed-window counter. */
export interface RateLimiter {
  hit(key: string, windowSeconds: number): Promise<RateLimitHit>;
}

/** A user row plus the scope ids needed to build the actor. */
export interface SessionUser {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  locale: string | null;
  sessionVersion: number;
  /** users.state_code (customers, state admins). */
  stateCode: string | null;
  /** Worker: workers.society_id; LCS admin: users.society_id. */
  societyId: string | null;
  societyStateCode: string | null;
  institutionId: string | null;
  institutionStateCode: string | null;
}

export interface UpsertLoginInput {
  phone: string;
  locale: Locale | null;
  stateCode: string;
  at: Date;
}

export interface UserRepo {
  /** Insert a customer or update last_login_at of an existing user. */
  upsertOnLogin(input: UpsertLoginInput): Promise<{ user: SessionUser; created: boolean }>;
  findSessionUser(userId: string): Promise<SessionUser | null>;
  /** Increment session_version; returns the new value, or null if no such user. */
  bumpSessionVersion(userId: string): Promise<number | null>;
  /** Set the profile locale for a user. */
  setLocale(userId: string, locale: Locale): Promise<void>;
}

export interface AuthDeps {
  otpStore: OtpStore;
  rateLimiter: RateLimiter;
  sms: SmsAdapter;
  users: UserRepo;
  otpPepper: string;
  sessionSecret: string;
  defaultStateCode: string;
  now?: () => Date;
}

export interface RequestOtpInput {
  phone: string;
  /** Client IP as seen by the handler. */
  ip: string;
}

export interface VerifyOtpInput {
  phone: string;
  code: string;
  /** Locale chosen before sign-in (NEXT_LOCALE cookie); stored for new users. */
  locale?: Locale | null;
}

export interface VerifyOtpResult {
  user: SessionUser;
  created: boolean;
  token: string;
}

export interface AuthenticateInput {
  token: string | undefined;
  requestId: string;
  cookieLocale?: string | undefined;
  defaultLocale: Locale;
}

/** Scope ids for the actor, taken from the fields that apply to the role. */
export function buildActor(user: SessionUser): UserActor {
  const actor: UserActor = { userId: user.id, role: user.role };
  const set = (key: 'stateCode' | 'societyId' | 'institutionId', value: string | null) => {
    if (value !== null && value !== '') actor[key] = value;
  };
  switch (user.role) {
    case 'customer':
    case 'state_admin':
      set('stateCode', user.stateCode);
      break;
    case 'worker':
    case 'lcs_admin':
      set('societyId', user.societyId);
      set('stateCode', user.societyStateCode);
      break;
    case 'institution_admin':
      set('institutionId', user.institutionId);
      set('stateCode', user.institutionStateCode);
      break;
    case 'national_admin':
      break;
  }
  return actor;
}

/** Profile locale, else the cookie, else the state default. */
export function pickLocale(
  profile: string | null | undefined,
  cookie: string | null | undefined,
  fallback: Locale,
): Locale {
  if (profile && isSupportedLocale(profile)) return profile;
  if (cookie && isSupportedLocale(cookie)) return cookie;
  return fallback;
}

export function createAuthService(deps: AuthDeps) {
  const now = deps.now ?? (() => new Date());

  async function enforceLimit(key: string, limit: number): Promise<void> {
    const { count, resetInSeconds } = await deps.rateLimiter.hit(key, OTP_RATE_WINDOW_SECONDS);
    if (count > limit) {
      throw new AppError('RATE_LIMITED', undefined, undefined, {
        retryAfterSeconds: Math.max(1, resetInSeconds),
      });
    }
  }

  return {
    async requestOtp(
      ctx: RequestContext,
      input: RequestOtpInput,
    ): Promise<{ phone: string; expiresInSeconds: number }> {
      const phone = normalizeIndianPhone(input.phone);
      await enforceLimit(`rl:otp:ip:${input.ip}`, OTP_REQUESTS_PER_IP);
      await enforceLimit(`rl:otp:phone:${phone}`, OTP_REQUESTS_PER_PHONE);

      const code = generateOtp(LOGIN_OTP_DIGITS);
      await deps.otpStore.save(phone, hashOtp(code, deps.otpPepper), LOGIN_OTP_TTL_SECONDS);
      try {
        await deps.sms.send({
          to: phone,
          templateKey: 'login_otp',
          params: { code },
          locale: ctx.locale,
        });
      } catch (error) {
        // An undelivered code must not stay usable.
        await deps.otpStore.consume(phone);
        if (isNotConfiguredError(error)) {
          throw new AppError('NOT_CONFIGURED', undefined, undefined, { adapter: 'sms' });
        }
        throw error;
      }
      return { phone, expiresInSeconds: LOGIN_OTP_TTL_SECONDS };
    },

    async verifyOtp(_ctx: RequestContext, input: VerifyOtpInput): Promise<VerifyOtpResult> {
      const phone = normalizeIndianPhone(input.phone);
      // The attempt is counted before comparing, so parallel guesses cannot
      // exceed the limit.
      const record = await deps.otpStore.recordAttempt(phone);
      if (record === null) throw new AppError('OTP_EXPIRED');
      if (record.attempts > LOGIN_OTP_MAX_ATTEMPTS) {
        await deps.otpStore.consume(phone);
        throw new AppError('OTP_ATTEMPTS_EXCEEDED');
      }
      if (!matchesOtpHash(input.code, record.hash, deps.otpPepper)) {
        if (record.attempts >= LOGIN_OTP_MAX_ATTEMPTS) {
          await deps.otpStore.consume(phone);
          throw new AppError('OTP_ATTEMPTS_EXCEEDED');
        }
        throw new AppError('OTP_INVALID', undefined, undefined, {
          attemptsLeft: LOGIN_OTP_MAX_ATTEMPTS - record.attempts,
        });
      }
      // Single use: only the request that deletes the code signs in.
      if (!(await deps.otpStore.consume(phone))) throw new AppError('OTP_EXPIRED');

      const at = now();
      const { user, created } = await deps.users.upsertOnLogin({
        phone,
        locale: input.locale ?? null,
        stateCode: deps.defaultStateCode,
        at,
      });
      const token = await signSession(
        { sub: user.id, role: user.role, sv: user.sessionVersion },
        deps.sessionSecret,
        at,
      );
      return { user, created, token };
    },

    /** The context for a session token, or null when it is missing or no longer valid. */
    async authenticate(
      input: AuthenticateInput,
    ): Promise<{ ctx: RequestContext; user: SessionUser } | null> {
      if (input.token === undefined || input.token === '') return null;
      const claims = await verifySession(input.token, deps.sessionSecret, now());
      if (claims === null) return null;
      const user = await deps.users.findSessionUser(claims.sub);
      if (user === null || user.sessionVersion !== claims.sv || user.role !== claims.role) {
        return null;
      }
      return {
        user,
        ctx: {
          actor: buildActor(user),
          requestId: input.requestId,
          locale: pickLocale(user.locale, input.cookieLocale, input.defaultLocale),
        },
      };
    },

    /** Revoke every session of the signed-in user. */
    async logoutAll(ctx: RequestContext | null): Promise<void> {
      const { actor } = requireRole(ctx, [
        'customer',
        'worker',
        'lcs_admin',
        'state_admin',
        'national_admin',
        'institution_admin',
      ]);
      if ((await deps.users.bumpSessionVersion(actor.userId)) === null) {
        throw new AppError('UNAUTHENTICATED');
      }
    },

    /** Set the profile locale for the signed-in user. */
    async setLocale(ctx: RequestContext | null, locale: Locale): Promise<void> {
      const { actor } = requireRole(ctx, [
        'customer',
        'worker',
        'lcs_admin',
        'state_admin',
        'national_admin',
        'institution_admin',
      ]);
      await deps.users.setLocale(actor.userId, locale);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
