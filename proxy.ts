/**
 * Page route protection. Only checks the session JWT signature and role;
 * the pages re-check the session against the DB and services authorize data.
 */
import { SESSION_COOKIE, verifySession } from '@/lib/core/session';
import { NextResponse, type NextRequest } from 'next/server';
import { areaFor, loginPath } from '@/server/auth/routes';

const MIN_SECRET_LENGTH = 32;

async function sessionRole(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret || secret.length < MIN_SECRET_LENGTH) return null;
  return (await verifySession(token, secret))?.role ?? null;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const area = areaFor(pathname);
  if (area === null) return NextResponse.next();

  const role = await sessionRole(request);
  if (role === null) {
    return NextResponse.redirect(new URL(loginPath(`${pathname}${search}`), request.url));
  }
  if (!area.roles.includes(role)) {
    return NextResponse.redirect(new URL('/forbidden', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/user/:path*', '/worker/:path*', '/corporate/:path*'],
};
