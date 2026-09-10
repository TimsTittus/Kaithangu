'use server';

import { isSystemActor } from '@kaithangu/core';
import { redirect } from 'next/navigation';
import { getContext } from '@/server/auth/context';
import { loginPath, ROLE_HOME, safeNext } from '@/server/auth/routes';
import { getConsentService } from '@/server/services';

/** Record acceptance of the current platform terms, then continue. */
export async function acceptConsent(formData: FormData): Promise<void> {
  const rawNext = formData.get('next');
  const next = typeof rawNext === 'string' ? rawNext : null;
  const ctx = await getContext();
  if (ctx === null || isSystemActor(ctx.actor)) {
    redirect(loginPath(`/consent?${new URLSearchParams({ next: next ?? '' })}`));
  }
  await getConsentService().acceptTerms(ctx, 'web');
  const role = ctx.actor.role;
  redirect(safeNext(next, ROLE_HOME[role], role));
}
