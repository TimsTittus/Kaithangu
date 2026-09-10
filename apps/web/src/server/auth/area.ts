/**
 * Full session check for the protected area layouts. The proxy has already
 * checked the JWT signature and role; this also checks session_version and the
 * role against the DB, and that the current terms were accepted.
 */
import type { Role } from '@kaithangu/core';
import { redirect } from 'next/navigation';
import { getConsentService } from '@/server/services';
import { getSession, type Session } from './context';
import { loginPath } from './routes';

export async function requireAreaSession(
  roles: readonly Role[],
  areaPath: string,
): Promise<Session> {
  const session = await getSession();
  if (session === null) redirect(loginPath(areaPath));
  if (!roles.includes(session.user.role)) redirect('/forbidden');
  if (!(await getConsentService().hasAcceptedTerms(session.ctx))) {
    redirect(`/consent?${new URLSearchParams({ next: areaPath })}`);
  }
  return session;
}
