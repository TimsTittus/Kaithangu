import { NotConfiguredError } from '@kaithangu/adapters/sms/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { systemContext } from '../context';
import { AppError } from '../errors';
import { signSession, verifySession } from '../session';
import {
  buildActor,
  createAuthService,
  LOGIN_OTP_MAX_ATTEMPTS,
  LOGIN_OTP_TTL_SECONDS,
  OTP_RATE_WINDOW_SECONDS,
  OTP_REQUESTS_PER_IP,
  OTP_REQUESTS_PER_PHONE,
  pickLocale,
  type SessionUser,
} from './auth';
import { MemoryOtpStore, MemoryRateLimiter, MemorySms, MemoryUserRepo } from './testing';

// Test-only secrets and fictional numbers.
const PEPPER = 'test-pepper-0123456789abcdef0123456789';
const SECRET = 'test-session-secret-0123456789abcdef';
const PHONE = '+919876543210';
const NATIONAL = '9876543210';
const IP = '203.0.113.7';

function setup() {
  const otpStore = new MemoryOtpStore();
  const rateLimiter = new MemoryRateLimiter();
  const sms = new MemorySms();
  const users = new MemoryUserRepo();
  const auth = createAuthService({
    otpStore,
    rateLimiter,
    sms,
    users,
    otpPepper: PEPPER,
    sessionSecret: SECRET,
    defaultStateCode: 'KL',
  });
  const ctx = systemContext('auth.test', { locale: 'ml' });
  return { otpStore, rateLimiter, sms, users, auth, ctx };
}

async function errorOf(promise: Promise<unknown>): Promise<AppError> {
  const error: unknown = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  if (!(error instanceof AppError)) throw new Error(`expected AppError, got ${String(error)}`);
  return error;
}

/** A 6-digit code that is not `code`. */
const wrong = (code: string) => (code === '000000' ? '111111' : '000000');

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-09-10T04:30:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('requestOtp', () => {
  it('normalises the phone, stores only a hash for 5 minutes and sends a 6-digit code by SMS', async () => {
    const { auth, ctx, sms, otpStore } = setup();
    await expect(auth.requestOtp(ctx, { phone: NATIONAL, ip: IP })).resolves.toEqual({
      phone: PHONE,
      expiresInSeconds: LOGIN_OTP_TTL_SECONDS,
    });
    expect(sms.sent).toHaveLength(1);
    expect(sms.sent[0]).toMatchObject({ to: PHONE, templateKey: 'login_otp', locale: 'ml' });
    const code = sms.lastCode(PHONE);
    expect(code).toMatch(/^\d{6}$/);
    const stored = otpStore.entries.get(PHONE);
    expect(stored?.value.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(code);
    expect(stored?.expiresAt).toBe(Date.now() + LOGIN_OTP_TTL_SECONDS * 1000);
  });

  it('rejects invalid phones before touching the rate limits', async () => {
    const { auth, ctx, rateLimiter } = setup();
    expect((await errorOf(auth.requestOtp(ctx, { phone: '12345', ip: IP }))).code).toBe(
      'INVALID_PHONE',
    );
    expect(rateLimiter.windows.size).toBe(0);
  });

  it('allows 3 requests per phone per 10 minutes, then RATE_LIMITED until the window resets', async () => {
    const { auth, ctx, sms } = setup();
    for (let i = 0; i < OTP_REQUESTS_PER_PHONE; i++) {
      await auth.requestOtp(ctx, { phone: PHONE, ip: `198.51.100.${i}` });
    }
    const error = await errorOf(auth.requestOtp(ctx, { phone: PHONE, ip: '198.51.100.99' }));
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.httpStatus).toBe(429);
    expect(error.details).toEqual({ retryAfterSeconds: OTP_RATE_WINDOW_SECONDS });
    expect(sms.sent).toHaveLength(OTP_REQUESTS_PER_PHONE);

    vi.advanceTimersByTime(OTP_RATE_WINDOW_SECONDS * 1000 - 1000);
    expect((await errorOf(auth.requestOtp(ctx, { phone: PHONE, ip: IP }))).code).toBe(
      'RATE_LIMITED',
    );
    vi.advanceTimersByTime(1000);
    await expect(auth.requestOtp(ctx, { phone: PHONE, ip: IP })).resolves.toBeDefined();
  });

  it('allows 20 requests per IP per 10 minutes across phones', async () => {
    const { auth, ctx, sms } = setup();
    const phone = (i: number) => `+9190000${String(i).padStart(5, '0')}`;
    for (let i = 0; i < OTP_REQUESTS_PER_IP; i++) {
      await auth.requestOtp(ctx, { phone: phone(i), ip: IP });
    }
    expect((await errorOf(auth.requestOtp(ctx, { phone: phone(99), ip: IP }))).code).toBe(
      'RATE_LIMITED',
    );
    expect(sms.sent).toHaveLength(OTP_REQUESTS_PER_IP);
    // Other IPs are unaffected.
    await expect(
      auth.requestOtp(ctx, { phone: phone(99), ip: '192.0.2.1' }),
    ).resolves.toBeDefined();
  });

  it('a new request replaces the previous code', async () => {
    const { auth, ctx, sms } = setup();
    await auth.requestOtp(ctx, { phone: PHONE, ip: IP });
    const first = sms.lastCode(PHONE);
    await auth.requestOtp(ctx, { phone: PHONE, ip: IP });
    const second = sms.lastCode(PHONE);
    if (first !== second) {
      expect((await errorOf(auth.verifyOtp(ctx, { phone: PHONE, code: first }))).code).toBe(
        'OTP_INVALID',
      );
    }
    await expect(auth.verifyOtp(ctx, { phone: PHONE, code: second })).resolves.toBeDefined();
  });

  it('maps an unconfigured SMS provider to NOT_CONFIGURED and discards the code', async () => {
    const { auth, ctx, sms, otpStore } = setup();
    sms.failWith = new NotConfiguredError('sms');
    const error = await errorOf(auth.requestOtp(ctx, { phone: PHONE, ip: IP }));
    expect(error.code).toBe('NOT_CONFIGURED');
    expect(error.httpStatus).toBe(503);
    expect(otpStore.entries.size).toBe(0);
  });

  it('rethrows other SMS failures after discarding the code', async () => {
    const { auth, ctx, sms, otpStore } = setup();
    sms.failWith = new Error('network down');
    await expect(auth.requestOtp(ctx, { phone: PHONE, ip: IP })).rejects.toThrow('network down');
    expect(otpStore.entries.size).toBe(0);
  });
});

describe('verifyOtp', () => {
  it('creates a customer in the default state with the pre-login locale and issues a session', async () => {
    const { auth, ctx, sms, users } = setup();
    await auth.requestOtp(ctx, { phone: PHONE, ip: IP });
    const result = await auth.verifyOtp(ctx, {
      phone: NATIONAL,
      code: sms.lastCode(PHONE),
      locale: 'ml',
    });
    expect(result.created).toBe(true);
    expect(result.user).toMatchObject({
      phone: PHONE,
      role: 'customer',
      locale: 'ml',
      stateCode: 'KL',
    });
    expect(users.lastLogin.get(result.user.id)).toEqual(new Date());
    await expect(verifySession(result.token, SECRET)).resolves.toEqual({
      sub: result.user.id,
      role: 'customer',
      sv: 0,
    });
  });

  it('signs in an existing user with their own role and updates last login', async () => {
    const { auth, ctx, sms, users } = setup();
    const admin = users.add({ phone: PHONE, role: 'lcs_admin', sessionVersion: 4 });
    await auth.requestOtp(ctx, { phone: PHONE, ip: IP });
    vi.advanceTimersByTime(30_000);
    const result = await auth.verifyOtp(ctx, { phone: PHONE, code: sms.lastCode(PHONE) });
    expect(result.created).toBe(false);
    expect(result.user.id).toBe(admin.id);
    expect(users.lastLogin.get(admin.id)).toEqual(new Date());
    await expect(verifySession(result.token, SECRET)).resolves.toMatchObject({
      role: 'lcs_admin',
      sv: 4,
    });
  });

  it('codes are single use', async () => {
    const { auth, ctx, sms } = setup();
    await auth.requestOtp(ctx, { phone: PHONE, ip: IP });
    const code = sms.lastCode(PHONE);
    await auth.verifyOtp(ctx, { phone: PHONE, code });
    expect((await errorOf(auth.verifyOtp(ctx, { phone: PHONE, code }))).code).toBe('OTP_EXPIRED');
  });

  it('allows 5 attempts: 4 wrong codes report attempts left, the 5th deletes the code', async () => {
    const { auth, ctx, sms, otpStore } = setup();
    await auth.requestOtp(ctx, { phone: PHONE, ip: IP });
    const code = sms.lastCode(PHONE);
    for (let attempt = 1; attempt < LOGIN_OTP_MAX_ATTEMPTS; attempt++) {
      const error = await errorOf(auth.verifyOtp(ctx, { phone: PHONE, code: wrong(code) }));
      expect(error.code).toBe('OTP_INVALID');
      expect(error.details).toEqual({ attemptsLeft: LOGIN_OTP_MAX_ATTEMPTS - attempt });
    }
    const fifth = await errorOf(auth.verifyOtp(ctx, { phone: PHONE, code: wrong(code) }));
    expect(fifth.code).toBe('OTP_ATTEMPTS_EXCEEDED');
    expect(otpStore.entries.has(PHONE)).toBe(false);
    // The correct code no longer works either.
    expect((await errorOf(auth.verifyOtp(ctx, { phone: PHONE, code }))).code).toBe('OTP_EXPIRED');
  });

  it('the correct code on the 5th attempt still signs in', async () => {
    const { auth, ctx, sms } = setup();
    await auth.requestOtp(ctx, { phone: PHONE, ip: IP });
    const code = sms.lastCode(PHONE);
    for (let attempt = 1; attempt < LOGIN_OTP_MAX_ATTEMPTS; attempt++) {
      await errorOf(auth.verifyOtp(ctx, { phone: PHONE, code: wrong(code) }));
    }
    await expect(auth.verifyOtp(ctx, { phone: PHONE, code })).resolves.toMatchObject({
      created: true,
    });
  });

  it('parallel guesses cannot exceed the attempt limit', async () => {
    const { auth, ctx, sms } = setup();
    await auth.requestOtp(ctx, { phone: PHONE, ip: IP });
    const code = sms.lastCode(PHONE);
    const guesses = Array.from({ length: 20 }, (_, i) => String(i).padStart(6, '9'));
    const results = await Promise.all(
      guesses
        .filter((guess) => guess !== code)
        .map((guess) => errorOf(auth.verifyOtp(ctx, { phone: PHONE, code: guess }))),
    );
    const invalid = results.filter((e) => e.code === 'OTP_INVALID').length;
    expect(invalid).toBeLessThan(LOGIN_OTP_MAX_ATTEMPTS);
    expect((await errorOf(auth.verifyOtp(ctx, { phone: PHONE, code }))).code).toBe('OTP_EXPIRED');
  });

  it('a record already past the limit is deleted without comparing', async () => {
    const { auth, ctx, otpStore } = setup();
    await otpStore.save(PHONE, 'f'.repeat(64), LOGIN_OTP_TTL_SECONDS);
    const entry = otpStore.entries.get(PHONE);
    if (entry) entry.value.attempts = LOGIN_OTP_MAX_ATTEMPTS;
    expect((await errorOf(auth.verifyOtp(ctx, { phone: PHONE, code: '123456' }))).code).toBe(
      'OTP_ATTEMPTS_EXCEEDED',
    );
    expect(otpStore.entries.has(PHONE)).toBe(false);
  });

  it('expires the code after 300 seconds', async () => {
    const { auth, ctx, sms } = setup();
    await auth.requestOtp(ctx, { phone: PHONE, ip: IP });
    const code = sms.lastCode(PHONE);
    vi.advanceTimersByTime(LOGIN_OTP_TTL_SECONDS * 1000);
    const error = await errorOf(auth.verifyOtp(ctx, { phone: PHONE, code }));
    expect(error.code).toBe('OTP_EXPIRED');
    expect(error.messageKey).toBe('error.OTP_EXPIRED');
  });

  it('accepts the code just before it expires', async () => {
    const { auth, ctx, sms } = setup();
    await auth.requestOtp(ctx, { phone: PHONE, ip: IP });
    vi.advanceTimersByTime(LOGIN_OTP_TTL_SECONDS * 1000 - 1);
    await expect(
      auth.verifyOtp(ctx, { phone: PHONE, code: sms.lastCode(PHONE) }),
    ).resolves.toBeDefined();
  });

  it('reports OTP_EXPIRED when no code was requested', async () => {
    const { auth, ctx } = setup();
    expect((await errorOf(auth.verifyOtp(ctx, { phone: PHONE, code: '123456' }))).code).toBe(
      'OTP_EXPIRED',
    );
  });
});

describe('authenticate and logoutAll', () => {
  async function signedIn() {
    const env = setup();
    await env.auth.requestOtp(env.ctx, { phone: PHONE, ip: IP });
    const result = await env.auth.verifyOtp(env.ctx, {
      phone: PHONE,
      code: env.sms.lastCode(PHONE),
    });
    return { ...env, ...result };
  }

  it('builds the request context from a valid token', async () => {
    const { auth, token, user } = await signedIn();
    const result = await auth.authenticate({
      token,
      requestId: 'req-1',
      cookieLocale: 'ta',
      defaultLocale: 'ml',
    });
    expect(result?.ctx).toEqual({
      actor: { userId: user.id, role: 'customer', stateCode: 'KL' },
      requestId: 'req-1',
      locale: 'ta',
    });
  });

  it('returns null for missing, tampered or foreign tokens', async () => {
    const { auth, token } = await signedIn();
    const base = { requestId: 'r', defaultLocale: 'en' as const };
    await expect(auth.authenticate({ ...base, token: undefined })).resolves.toBeNull();
    await expect(auth.authenticate({ ...base, token: '' })).resolves.toBeNull();
    await expect(auth.authenticate({ ...base, token: `${token}x` })).resolves.toBeNull();
    const foreign = await signSession(
      { sub: crypto.randomUUID(), role: 'customer', sv: 0 },
      SECRET,
    );
    await expect(auth.authenticate({ ...base, token: foreign })).resolves.toBeNull();
  });

  it('rejects a token whose role no longer matches the user', async () => {
    const { auth, users, user } = await signedIn();
    const forged = await signSession({ sub: user.id, role: 'national_admin', sv: 0 }, SECRET);
    await expect(
      auth.authenticate({ token: forged, requestId: 'r', defaultLocale: 'en' }),
    ).resolves.toBeNull();
    expect(users.users.get(user.id)?.role).toBe('customer');
  });

  it('logoutAll bumps session_version, invalidating every earlier token', async () => {
    const { auth, token } = await signedIn();
    const session = await auth.authenticate({ token, requestId: 'r', defaultLocale: 'en' });
    if (session === null) throw new Error('expected a session');
    await auth.logoutAll(session.ctx);
    await expect(
      auth.authenticate({ token, requestId: 'r', defaultLocale: 'en' }),
    ).resolves.toBeNull();
  });

  it('logoutAll requires a signed-in user that still exists', async () => {
    const { auth, ctx } = setup();
    expect((await errorOf(auth.logoutAll(null))).code).toBe('UNAUTHENTICATED');
    expect((await errorOf(auth.logoutAll(ctx))).code).toBe('FORBIDDEN');
    const ghost = { ...ctx, actor: { userId: crypto.randomUUID(), role: 'customer' as const } };
    expect((await errorOf(auth.logoutAll(ghost))).code).toBe('UNAUTHENTICATED');
  });
});

describe('buildActor', () => {
  const base: SessionUser = {
    id: 'u1',
    phone: PHONE,
    name: null,
    role: 'customer',
    locale: null,
    sessionVersion: 0,
    stateCode: 'KL',
    societyId: 's1',
    societyStateCode: 'TN',
    institutionId: 'i1',
    institutionStateCode: 'KA',
  };

  it('takes only the scope ids that apply to each role', () => {
    expect(buildActor({ ...base, role: 'customer' })).toEqual({
      userId: 'u1',
      role: 'customer',
      stateCode: 'KL',
    });
    expect(buildActor({ ...base, role: 'state_admin' })).toEqual({
      userId: 'u1',
      role: 'state_admin',
      stateCode: 'KL',
    });
    for (const role of ['worker', 'lcs_admin'] as const) {
      expect(buildActor({ ...base, role })).toEqual({
        userId: 'u1',
        role,
        societyId: 's1',
        stateCode: 'TN',
      });
    }
    expect(buildActor({ ...base, role: 'institution_admin' })).toEqual({
      userId: 'u1',
      role: 'institution_admin',
      institutionId: 'i1',
      stateCode: 'KA',
    });
    expect(buildActor({ ...base, role: 'national_admin' })).toEqual({
      userId: 'u1',
      role: 'national_admin',
    });
  });

  it('omits missing or empty scope ids so authz fails closed', () => {
    expect(
      buildActor({ ...base, role: 'lcs_admin', societyId: null, societyStateCode: '' }),
    ).toEqual({ userId: 'u1', role: 'lcs_admin' });
  });
});

describe('pickLocale', () => {
  it('prefers the profile, then the cookie, then the state default, ignoring unsupported values', () => {
    expect(pickLocale('hi', 'ta', 'ml')).toBe('hi');
    expect(pickLocale(null, 'ta', 'ml')).toBe('ta');
    expect(pickLocale('fr', 'xx', 'ml')).toBe('ml');
    expect(pickLocale(undefined, undefined, 'en')).toBe('en');
  });
});

describe('setLocale', () => {
  it('updates the locale of the signed-in user', async () => {
    const { auth, users } = setup();
    const user = users.add({ phone: PHONE, role: 'customer', locale: 'en' });
    const userCtx = { actor: buildActor(user), requestId: 'r1', locale: 'en' as const };
    await auth.setLocale(userCtx, 'ml');
    expect(users.users.get(user.id)?.locale).toBe('ml');
  });

  it('rejects unauthenticated caller', async () => {
    const { auth } = setup();
    await expect(auth.setLocale(null, 'ml')).rejects.toThrow(AppError);
  });
});
