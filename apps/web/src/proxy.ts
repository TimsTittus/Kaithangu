/**
 * Page route protection (Phase 4). Only checks the session JWT signature and
 * role; the pages re-check the session against the DB and services authorize
 * data. /dev/* exists only when DEV_INBOX=true.
 */
import { SESSION_COOKIE, verifySession } from '@kaithangu/core/session';
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

  if (pathname === '/dev' || pathname.startsWith('/dev/')) {
    return process.env.DEV_INBOX === 'true'
      ? NextResponse.next()
      : new NextResponse('Not Found', { status: 404 });
  }

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
  matcher: ['/app/:path*', '/w/:path*', '/admin/:path*', '/org/:path*', '/dev/:path*'],
};
