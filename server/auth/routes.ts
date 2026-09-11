/**
 * Which roles may open which page areas (Phase 4 route protection). Shared by
 * proxy.ts (JWT role check only) and the area layouts (full session check).
 * Authorization of data still happens in the services.
 */
import { ROLES, type Role } from '@/lib/core';

export const LOCALE_COOKIE = 'NEXT_LOCALE';

export const ROLE_HOME: Readonly<Record<Role, string>> = {
  user: '/user',
  worker: '/worker',
  corporate: '/corporate',
};

export interface ProtectedArea {
  prefix: string;
  roles: readonly Role[];
}

export const PROTECTED_AREAS: readonly ProtectedArea[] = [
  { prefix: '/user', roles: ['user'] },
  { prefix: '/worker', roles: ['worker'] },
  { prefix: '/corporate', roles: ['corporate'] },
  { prefix: '/app', roles: ROLES },
];

/** The protected area a path belongs to (`/app` and `/app/...`, not `/apple`). */
export function areaFor(pathname: string): ProtectedArea | null {
  return (
    PROTECTED_AREAS.find(
      ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    ) ?? null
  );
}

export function canOpen(role: Role, pathname: string): boolean {
  const area = areaFor(pathname);
  return area === null || area.roles.includes(role);
}

/**
 * A same-origin path to continue to after sign-in, or `fallback`. Rejects
 * absolute and protocol-relative URLs (open redirects), backslashes and
 * control characters; with a role, also areas that role cannot open.
 */
export function safeNext(next: string | null | undefined, fallback: string, role?: Role): string {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) {
    return fallback;
  }
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  let url: URL;
  try {
    url = new URL(next, 'http://localhost');
  } catch {
    return fallback;
  }
  if (url.origin !== 'http://localhost') return fallback;
  if (role !== undefined && !canOpen(role, url.pathname)) return fallback;
  return `${url.pathname}${url.search}`;
}

/** /login?next=<path+search>, keeping the page the user was trying to open. */
export function loginPath(next: string): string {
  return `/login?${new URLSearchParams({ next }).toString()}`;
}
