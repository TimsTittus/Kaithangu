/**
 * Phone OTP sign-in through the real route handlers, Redis (test DB) and
 * Postgres (test database), with the mock SMS adapter writing to dev:inbox.
 */
import { readDevInbox } from '@kaithangu/adapters/sms';
import { LOGIN_OTP_MAX_ATTEMPTS, SESSION_COOKIE } from '@kaithangu/core';
import { users } from '@kaithangu/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { POST as logoutRoute } from '@/app/api/v1/auth/logout/route';
import { POST as requestRoute } from '@/app/api/v1/auth/otp/request/route';
import { POST as verifyRoute } from '@/app/api/v1/auth/otp/verify/route';
import { GET as meRoute } from '@/app/api/v1/me/route';
import { closeDatastores, getRedis } from '@/lib/datastores';
import { otpKey } from '@/server/stores/redis';
import { deleteUsersByPhone, fakePhone, openTestDb, prepareTestDatabase } from '@/test/fixtures';

let testDb: ReturnType<typeof openTestDb>;
const phones: string[] = [];
let ipCounter = 0;

beforeAll(async () => {
  testDb = openTestDb(await prepareTestDatabase());
});

beforeEach(async () => {
  await getRedis().flushdb();
});

afterAll(async () => {
  await deleteUsersByPhone(testDb.db, phones);
  await testDb?.client.end({ timeout: 5 });
  await getRedis().flushdb();
  await closeDatastores();
});

function newPhone(): string {
  const phone = fakePhone();
  phones.push(phone);
  return phone;
}

interface Sent {
  response: Response;
  body: {
    data?: Record<string, unknown>;
    error?: { code: string; messageKey: string; requestId: string };
  };
}

async function post(
  handler: (request: NextRequest) => Promise<Response>,
  path: string,
  body: unknown,
  {
    cookie,
    ip,
    contentType = 'application/json',
  }: { cookie?: string; ip?: string; contentType?: string } = {},
): Promise<Sent> {
  ipCounter += 1;
  const headers: Record<string, string> = {
    'content-type': contentType,
    'x-forwarded-for': ip ?? `198.51.100.${ipCounter % 250}`,
  };
  if (cookie) headers.cookie = cookie;
  const response = await handler(
    new NextRequest(`http://localhost${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    }),
  );
  return { response, body: (await response.clone().json()) as Sent['body'] };
}

const requestOtp = (phone: string, options?: Parameters<typeof post>[3]) =>
  post((r) => requestRoute(r), '/api/v1/auth/otp/request', { phone }, options);

const verifyOtp = (body: Record<string, unknown>, options?: Parameters<typeof post>[3]) =>
  post((r) => verifyRoute(r), '/api/v1/auth/otp/verify', body, options);

/** The code in the newest dev-inbox SMS to `phone`. */
async function codeFor(phone: string): Promise<{ code: string; text: string }> {
  const message = (await readDevInbox(getRedis())).find((m) => m.to === phone);
  const code = message ? /\b(\d{6})\b/.exec(message.text)?.[1] : undefined;
  if (!message || !code) throw new Error(`no OTP SMS for ${phone}`);
  return { code, text: message.text };
}

function sessionCookieFrom(response: Response): string {
  const header = response.headers.get('set-cookie') ?? '';
  const match = new RegExp(`${SESSION_COOKIE}=([^;]*)`).exec(header);
  if (!match?.[1]) throw new Error(`no session cookie in: ${header}`);
  return `${SESSION_COOKIE}=${match[1]}`;
}

describe('OTP request', () => {
  it('stores only a hash with a 300 s TTL and sends the SMS in the chosen language', async () => {
    const phone = newPhone();
    const national = phone.slice(3);
    const { response, body } = await requestOtp(national, { cookie: 'NEXT_LOCALE=ml' });
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ expiresInSeconds: 300 });

    const { code, text } = await codeFor(phone);
    expect(text).toContain('കൈത്താങ്ങ്');
    const stored = await getRedis().hgetall(otpKey(phone));
    expect(stored.attempts).toBe('0');
    expect(stored.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(code);
    const ttl = await getRedis().ttl(otpKey(phone));
    expect(ttl).toBeGreaterThan(290);
    expect(ttl).toBeLessThanOrEqual(300);
  });

  it('rate limits the 4th request for a phone within 10 minutes (429 + Retry-After)', async () => {
    const phone = newPhone();
    for (let i = 0; i < 3; i++) expect((await requestOtp(phone)).response.status).toBe(200);
    const { response, body } = await requestOtp(phone);
    expect(response.status).toBe(429);
    expect(body.error).toMatchObject({ code: 'RATE_LIMITED', messageKey: 'error.RATE_LIMITED' });
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(500);
  });

  it('rate limits the 21st request from one IP', async () => {
    for (let i = 0; i < 20; i++) {
      expect((await requestOtp(newPhone(), { ip: '203.0.113.50' })).response.status).toBe(200);
    }
    expect((await requestOtp(newPhone(), { ip: '203.0.113.50' })).response.status).toBe(429);
  });

  it('rejects invalid phones and non-JSON bodies', async () => {
    const invalid = await requestOtp('12345');
    expect(invalid.response.status).toBe(400);
    expect(invalid.body.error?.code).toBe('INVALID_PHONE');
    const textPlain = await requestOtp(newPhone(), { contentType: 'text/plain' });
    expect(textPlain.response.status).toBe(415);
  });
});

describe('OTP verify and session', () => {
  it('creates a customer, sets the session cookie and asks for consent first', async () => {
    const phone = newPhone();
    await requestOtp(phone, { cookie: 'NEXT_LOCALE=ml' });
    const { code } = await codeFor(phone);

    const { response, body } = await verifyOtp(
      { phone, code, next: '/app' },
      { cookie: 'NEXT_LOCALE=ml' },
    );
    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      user: { role: 'customer' },
      created: true,
      needsConsent: true,
      redirectTo: '/consent?next=%2Fapp',
    });
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/kt_session=[^;]+/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(setCookie).toMatch(/Path=\//);
    expect(setCookie).toMatch(/Max-Age=2592000/);
    expect(setCookie).not.toMatch(/Secure/i); // NODE_ENV is not production in tests

    const [row] = await testDb.db.select().from(users).where(eq(users.phone, phone));
    expect(row).toMatchObject({
      role: 'customer',
      stateCode: 'KL',
      locale: 'ml',
      sessionVersion: 0,
    });
    expect(row?.lastLoginAt).toBeInstanceOf(Date);
    expect(await getRedis().exists(otpKey(phone))).toBe(0);

    const me = await meRoute(
      new NextRequest('http://localhost/api/v1/me', {
        headers: { cookie: sessionCookieFrom(response) },
      }),
    );
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({
      data: {
        phone,
        role: 'customer',
        locale: 'ml',
        stateCode: 'KL',
        consent: { platformTerms: false },
      },
    });
  });

  it('a second sign-in updates last_login_at and keeps the user', async () => {
    const phone = newPhone();
    await requestOtp(phone);
    await verifyOtp({ phone, code: (await codeFor(phone)).code });
    const [first] = await testDb.db.select().from(users).where(eq(users.phone, phone));
    await new Promise((resolve) => setTimeout(resolve, 10));
    await requestOtp(phone);
    const { body } = await verifyOtp({ phone, code: (await codeFor(phone)).code });
    expect(body.data).toMatchObject({ created: false, user: { id: first?.id } });
    const [second] = await testDb.db.select().from(users).where(eq(users.phone, phone));
    expect(second?.lastLoginAt?.getTime()).toBeGreaterThan(first?.lastLoginAt?.getTime() ?? 0);
  });

  it('deletes the code after 5 wrong attempts', async () => {
    const phone = newPhone();
    await requestOtp(phone);
    const { code } = await codeFor(phone);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 1; i < LOGIN_OTP_MAX_ATTEMPTS; i++) {
      const { response, body } = await verifyOtp({ phone, code: wrong });
      expect(response.status).toBe(400);
      expect(body.error?.code).toBe('OTP_INVALID');
    }
    const last = await verifyOtp({ phone, code: wrong });
    expect(last.response.status).toBe(429);
    expect(last.body.error?.code).toBe('OTP_ATTEMPTS_EXCEEDED');
    expect(await getRedis().exists(otpKey(phone))).toBe(0);
    expect((await verifyOtp({ phone, code })).body.error?.code).toBe('OTP_EXPIRED');
  });

  it('rejects a malformed code without using an attempt', async () => {
    const phone = newPhone();
    await requestOtp(phone);
    const { response } = await verifyOtp({ phone, code: '12ab' });
    expect(response.status).toBe(400);
    expect(await getRedis().hget(otpKey(phone), 'attempts')).toBe('0');
  });

  it('never redirects off-site or into another role area after sign-in', async () => {
    const phone = newPhone();
    await requestOtp(phone);
    const { body } = await verifyOtp({
      phone,
      code: (await codeFor(phone)).code,
      next: '//evil.example',
    });
    expect(body.data?.redirectTo).toBe('/consent?next=%2Fapp');
    await requestOtp(phone);
    const admin = await verifyOtp({ phone, code: (await codeFor(phone)).code, next: '/admin' });
    expect(admin.body.data?.redirectTo).toBe('/consent?next=%2Fapp');
  });

  it('logout clears the cookie; logout-all revokes existing tokens', async () => {
    const phone = newPhone();
    await requestOtp(phone);
    const signedIn = await verifyOtp({ phone, code: (await codeFor(phone)).code });
    const cookie = sessionCookieFrom(signedIn.response);

    const plain = await post((r) => logoutRoute(r), '/api/v1/auth/logout', {}, { cookie });
    expect(plain.response.status).toBe(200);
    expect(plain.response.headers.get('set-cookie')).toMatch(/kt_session=;.*Max-Age=0/i);
    // A plain logout only drops this browser's cookie; the token itself stays valid.
    const meAfterPlain = await meRoute(
      new NextRequest('http://localhost/api/v1/me', { headers: { cookie } }),
    );
    expect(meAfterPlain.status).toBe(200);

    const all = await post((r) => logoutRoute(r), '/api/v1/auth/logout', { all: true }, { cookie });
    expect(all.response.status).toBe(200);
    const meAfterAll = await meRoute(
      new NextRequest('http://localhost/api/v1/me', { headers: { cookie } }),
    );
    expect(meAfterAll.status).toBe(401);
    const [row] = await testDb.db.select().from(users).where(eq(users.phone, phone));
    expect(row?.sessionVersion).toBe(1);

    const unauthenticated = await post((r) => logoutRoute(r), '/api/v1/auth/logout', { all: true });
    expect(unauthenticated.response.status).toBe(401);
  });
});
