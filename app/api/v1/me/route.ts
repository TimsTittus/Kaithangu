import { AppError, currentConsentVersion, isSystemActor } from '@/lib/core';
import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/server/auth/context';
import { handle, jsonData } from '@/server/http';
import { getConsentService } from '@/server/services';

export const GET = handle(async (request, requestId) => {
  const session = await getSessionFromRequest(request as NextRequest, requestId);
  if (session === null || isSystemActor(session.ctx.actor)) {
    throw new AppError('UNAUTHENTICATED');
  }
  const { ctx, user } = session;
  const { actor } = session.ctx;
  return jsonData({
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    locale: ctx.locale,
    stateCode: actor.stateCode ?? null,
    societyId: actor.societyId ?? null,
    consent: {
      version: currentConsentVersion(),
      platformTerms: await getConsentService().hasAcceptedTerms(ctx),
    },
  });
});
