/**
 * getContext(): the RequestContext of the signed-in user for server
 * components, server functions and route handlers, or null. It verifies the
 * kt_session JWT, then loads the user to check session_version (logout-all)
 * and role, and to fill the actor's society / state / institution scope.
 * requireRole(ctx, roles) narrows it (re-exported from core).
 */
import {
  pickLocale,
  SESSION_COOKIE,
  systemContext,
  type RequestContext,
  type SessionUser,
} from '@kaithangu/core';
import type { Locale } from '@kaithangu/i18n';
import { cookies, headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { cache } from 'react';
import { requestIdFrom } from '@/server/http';
import { getAuthService, getDefaultLocale } from '@/server/services';
import { LOCALE_COOKIE } from './routes';

export { requireRole } from '@kaithangu/core';

export interface Session {
  ctx: RequestContext;
  user: SessionUser;
}

interface CookieSource {
  get(name: string): { value: string } | undefined;
}

async function resolveSession(
  cookieSource: CookieSource,
  requestId: string,
): Promise<Session | null> {
  return getAuthService().authenticate({
    token: cookieSource.get(SESSION_COOKIE)?.value,
    requestId,
    cookieLocale: cookieSource.get(LOCALE_COOKIE)?.value,
    defaultLocale: await getDefaultLocale(),
  });
}

/** The session for the current request (deduplicated per render). */
export const getSession = cache(async (): Promise<Session | null> => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveSession(cookieStore, requestIdFrom(headerStore));
});

export async function getContext(): Promise<RequestContext | null> {
  return (await getSession())?.ctx ?? null;
}

/** Route-handler variant: reads cookies from the request itself. */
export async function getSessionFromRequest(
  request: NextRequest,
  requestId: string,
): Promise<Session | null> {
  return resolveSession(request.cookies, requestId);
}

export async function getContextFromRequest(
  request: NextRequest,
  requestId: string,
): Promise<RequestContext | null> {
  return (await getSessionFromRequest(request, requestId))?.ctx ?? null;
}

/** Locale for the request: profile → NEXT_LOCALE cookie → 'en' default. */
export async function getRequestLocale(): Promise<Locale> {
  const session = await getSession();
  if (session) return session.ctx.locale;
  const cookieStore = await cookies();
  return pickLocale(null, cookieStore.get(LOCALE_COOKIE)?.value, 'en');
}

/** Same resolution for a route handler without a signed-in user. */
export async function anonymousLocale(request: NextRequest): Promise<Locale> {
  return Promise.resolve(pickLocale(null, request.cookies.get(LOCALE_COOKIE)?.value, 'en'));
}

/** Context for sign-in, where there is no user yet: the system acts for the caller. */
export function signInContext(requestId: string, locale: Locale): RequestContext {
  return systemContext('auth.sign_in', { requestId, locale });
}
