import { buildActor, pickLocale, ROLES, SESSION_COOKIE, sessionCookieOptions } from '@/lib/core';
import { isSupportedLocale } from '@/lib/i18n';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getEnv } from '@/env';
import { anonymousLocale, signInContext } from '@/server/auth/context';
import { LOCALE_COOKIE, ROLE_HOME, safeNext } from '@/server/auth/routes';
import { handle, jsonData, readJson } from '@/server/http';
import { getAuthService, getConsentService } from '@/server/services';

const bodySchema = z.object({
  phone: z.string().min(1).max(32),
  code: z.string().regex(/^\d{6}$/),
  next: z.string().max(2048).optional(),
  role: z.enum(ROLES).optional(),
});

export const POST = handle(async (request, requestId) => {
  const body = await readJson(request, bodySchema);
  const nextRequest = request as NextRequest;
  const locale = await anonymousLocale(nextRequest);
  const cookieLocale = nextRequest.cookies.get(LOCALE_COOKIE)?.value;

  const { user, created, token } = await getAuthService().verifyOtp(
    signInContext(requestId, locale),
    {
      phone: body.phone,
      code: body.code,
      locale: cookieLocale !== undefined && isSupportedLocale(cookieLocale) ? cookieLocale : null,
      role: body.role,
    },
  );

  const needsConsent = !(await getConsentService().hasAcceptedTerms({
    actor: buildActor(user),
    requestId,
    locale: pickLocale(user.locale, cookieLocale, locale),
  }));
  const home = ROLE_HOME[user.role];
  const destination = body.role !== undefined ? home : safeNext(body.next, home, user.role);
  const redirectTo = needsConsent
    ? `/consent?${new URLSearchParams({ next: destination }).toString()}`
    : destination;

  const response = jsonData({
    user: { id: user.id, role: user.role },
    created,
    needsConsent,
    redirectTo,
  });
  response.cookies.set(
    SESSION_COOKIE,
    token,
    sessionCookieOptions(getEnv().NODE_ENV === 'production'),
  );
  return response;
});
