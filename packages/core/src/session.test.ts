import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  sessionCookieOptions,
  signSession,
  verifySession,
  type SessionClaims,
} from './session';

// Test-only secrets.
const SECRET = 'test-session-secret-0123456789abcdef';
const OTHER_SECRET = 'another-test-secret-0123456789abcdef';
const NOW = new Date('2026-09-10T00:00:00Z');

const claims: SessionClaims = { sub: randomUUID(), role: 'lcs_admin', sv: 3 };

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('session tokens', () => {
  it('round-trips { sub, role, sv }', async () => {
    const token = await signSession(claims, SECRET, NOW);
    await expect(verifySession(token, SECRET, NOW)).resolves.toEqual(claims);
  });

  it('expires after 30 days', async () => {
    const token = await signSession(claims, SECRET, NOW);
    const justBefore = new Date(NOW.getTime() + (SESSION_TTL_SECONDS - 1) * 1000);
    const after = new Date(NOW.getTime() + (SESSION_TTL_SECONDS + 1) * 1000);
    await expect(verifySession(token, SECRET, justBefore)).resolves.toEqual(claims);
    await expect(verifySession(token, SECRET, after)).resolves.toBeNull();
  });

  it('rejects a token signed with another secret', async () => {
    const token = await signSession(claims, OTHER_SECRET, NOW);
    await expect(verifySession(token, SECRET, NOW)).resolves.toBeNull();
  });

  it('rejects a tampered payload (role escalation) with the original signature', async () => {
    const token = await signSession(claims, SECRET, NOW);
    const [header, payload, signature] = token.split('.') as [string, string, string];
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Record<
      string,
      unknown
    >;
    const forged = `${header}.${b64({ ...decoded, role: 'national_admin' })}.${signature}`;
    await expect(verifySession(forged, SECRET, NOW)).resolves.toBeNull();
    const bumped = `${header}.${b64({ ...decoded, sv: 99 })}.${signature}`;
    await expect(verifySession(bumped, SECRET, NOW)).resolves.toBeNull();
  });

  it('rejects a tampered signature', async () => {
    const token = await signSession(claims, SECRET, NOW);
    const [header, payload, signature] = token.split('.') as [string, string, string];
    const tamperedSig = `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
    await expect(
      verifySession(`${header}.${payload}.${tamperedSig}`, SECRET, NOW),
    ).resolves.toBeNull();
  });

  it('rejects alg "none" and malformed tokens', async () => {
    const payload = { ...claims, iat: NOW.getTime() / 1000, exp: NOW.getTime() / 1000 + 60 };
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.`;
    await expect(verifySession(unsigned, SECRET, NOW)).resolves.toBeNull();
    for (const junk of ['', 'abc', 'a.b.c', `${b64({ alg: 'HS256' })}..`]) {
      await expect(verifySession(junk, SECRET, NOW)).resolves.toBeNull();
    }
  });

  it('rejects correctly signed tokens with invalid claims', async () => {
    const key = new TextEncoder().encode(SECRET);
    const sign = (body: Record<string, unknown>, sub: string) =>
      new SignJWT(body)
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(sub)
        .setIssuedAt(NOW)
        .setExpirationTime(new Date(NOW.getTime() + 60_000))
        .sign(key);
    await expect(
      verifySession(await sign({ role: 'root', sv: 0 }, claims.sub), SECRET, NOW),
    ).resolves.toBeNull();
    await expect(
      verifySession(await sign({ role: 'customer', sv: -1 }, claims.sub), SECRET, NOW),
    ).resolves.toBeNull();
    await expect(
      verifySession(await sign({ role: 'customer', sv: 0 }, 'not-a-uuid'), SECRET, NOW),
    ).resolves.toBeNull();
    // No expiry claim.
    const noExp = await new SignJWT({ role: 'customer', sv: 0 })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.sub)
      .setIssuedAt(NOW)
      .sign(key);
    await expect(verifySession(noExp, SECRET, NOW)).resolves.toBeNull();
  });

  it('requires a secret of at least 32 characters', async () => {
    await expect(signSession(claims, 'short', NOW)).rejects.toThrow(RangeError);
    await expect(verifySession('x', 'short', NOW)).rejects.toThrow(RangeError);
  });

  it('refuses to sign invalid claims', async () => {
    await expect(signSession({ ...claims, sub: 'nope' }, SECRET, NOW)).rejects.toThrow();
  });
});

describe('sessionCookieOptions', () => {
  it('is httpOnly, lax, path /, 30 days, secure only in production', () => {
    expect(SESSION_COOKIE).toBe('kt_session');
    expect(sessionCookieOptions(true)).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });
    expect(sessionCookieOptions(false).secure).toBe(false);
  });
});
