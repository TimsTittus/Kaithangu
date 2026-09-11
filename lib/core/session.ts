/**
 * Session tokens (Phase 4): HS256 JWTs signed with SESSION_SECRET, carrying
 * { sub, role, sv } where sv is the identity table's session_version. The token only proves
 * who signed in; services re-check sv against the DB (logout-all bumps it) and
 * enforce authorization themselves. Kept free of Node-only APIs so the web
 * proxy can import it through `@/lib/core/session`.
 */
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { ROLES, type Role } from './context';

export const SESSION_COOKIE = 'kt_session';
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const MIN_SESSION_SECRET_LENGTH = 32;

const ALGORITHM = 'HS256';

export interface SessionClaims {
  sub: string;
  role: Role;
  sv: number;
}

const claimsSchema = z.object({
  sub: z.uuid(),
  role: z.enum(ROLES),
  sv: z.number().int().nonnegative(),
});

function secretKey(secret: string): Uint8Array {
  if (secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new RangeError(`session secret must be at least ${MIN_SESSION_SECRET_LENGTH} characters`);
  }
  return new TextEncoder().encode(secret);
}

const seconds = (date: Date): number => Math.floor(date.getTime() / 1000);

export async function signSession(
  claims: SessionClaims,
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  const { sub, role, sv } = claimsSchema.parse(claims);
  const issuedAt = seconds(now);
  return new SignJWT({ role, sv })
    .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
    .setSubject(sub)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_TTL_SECONDS)
    .sign(secretKey(secret));
}

/**
 * The claims of a valid, unexpired token signed with `secret`, else null.
 * Tampered, expired, wrongly signed, `alg: none` and malformed tokens are all
 * rejected the same way.
 */
export async function verifySession(
  token: string,
  secret: string,
  now: Date = new Date(),
): Promise<SessionClaims | null> {
  const key = secretKey(secret);
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: [ALGORITHM],
      currentDate: now,
      requiredClaims: ['sub', 'exp', 'iat'],
    });
    const parsed = claimsSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: '/';
  maxAge: number;
}

/** Cookie attributes for kt_session; `secure` in production only. */
export function sessionCookieOptions(production: boolean): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: production,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
