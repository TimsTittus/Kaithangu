/**
 * Phone OTP sign-in and sessions (Phase 4).
 * - requestOtp: normalise the phone and ask Twilio Verify to text a 6-digit code.
 * - verifyOtp: check that code with Twilio, then upsert the user and issue a
 *   session token.
 * - authenticate: turn a session cookie into a RequestContext, rejecting tokens
 *   whose session_version no longer matches the DB (logout-all).
 * SMS and the user table are ports so this module stays pure.
 */
import { isSupportedLocale, type Locale } from '@/lib/i18n';
import { isNotConfiguredError, type SmsAdapter } from '@/lib/adapters/sms/types';
import type { RequestContext, Role, UserActor } from '../context';
import { AppError } from '../errors';
import { normalizeIndianPhone } from '../phone';
import { signSession, verifySession } from '../session';
import { requireRole } from '../authz';

export const LOGIN_OTP_DIGITS = 6;
export const LOGIN_OTP_TTL_SECONDS = 600;
export const LOGIN_OTP_MAX_ATTEMPTS = 5;

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
  sms: SmsAdapter;
  users: UserRepo;
  sessionSecret: string;
  defaultStateCode: string;
  now?: () => Date;
}

export interface RequestOtpInput {
  phone: string;
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

  return {
    async requestOtp(
      ctx: RequestContext,
      input: RequestOtpInput,
    ): Promise<{ phone: string; expiresInSeconds: number }> {
      const phone = normalizeIndianPhone(input.phone);
      try {
        await deps.sms.send({
          to: phone,
          templateKey: 'login_otp',
          params: {},
          locale: ctx.locale,
        });
      } catch (error) {
        if (isNotConfiguredError(error)) {
          throw new AppError('NOT_CONFIGURED', undefined, undefined, { adapter: 'sms' });
        }
        throw error;
      }
      return { phone, expiresInSeconds: LOGIN_OTP_TTL_SECONDS };
    },

    async verifyOtp(_ctx: RequestContext, input: VerifyOtpInput): Promise<VerifyOtpResult> {
      const phone = normalizeIndianPhone(input.phone);
      let check;
      try {
        check = await deps.sms.checkLoginOtp(phone, input.code);
      } catch (error) {
        if (isNotConfiguredError(error)) {
          throw new AppError('NOT_CONFIGURED', undefined, undefined, { adapter: 'sms' });
        }
        throw error;
      }
      if (check === 'expired') throw new AppError('OTP_EXPIRED');
      if (check === 'attempts_exceeded') throw new AppError('OTP_ATTEMPTS_EXCEEDED');
      if (check !== 'approved') throw new AppError('OTP_INVALID');

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
