/**
 * Executes VoiceActions emitted by a flow turn.
 *
 * Wired for real: createBooking (finds-or-creates the caller as a customer
 * by phone, same upsertOnLogin as the web OTP flow, then calls the real
 * BookingService) and recordConsent (records platform_terms acceptance over
 * the 'voice' channel — the only consent purpose core actually has a
 * recorder for; call_recording/data_processing have no service method yet,
 * so the recording-deletion decision in ./routes.ts uses its own in-call
 * signal instead of a DB lookup).
 *
 * Not wired: acceptOffer/declineOffer/setAvailability/startJob/completeJob —
 * no dispatch/worker service exposes these methods yet (not just unwired;
 * genuinely not implemented anywhere in the codebase), so they're logged only.
 */
import type { FastifyBaseLogger } from 'fastify';
import {
  requestContext,
  type BookingService,
  type ConsentService,
  type UserActor,
  type UserRepo,
  type VoiceAction,
} from '@kaithangu/core';
import type { Locale } from '@kaithangu/i18n';

export interface ActionExecutorDeps {
  users: UserRepo;
  bookings: BookingService;
  consent: ConsentService;
  defaultStateCode: string;
}

export interface ActionExecutionResult {
  bookingId?: string;
}

async function actorForPhone(
  phone: string,
  locale: Locale,
  deps: ActionExecutorDeps,
): Promise<UserActor> {
  const { user } = await deps.users.upsertOnLogin({
    phone,
    locale,
    stateCode: deps.defaultStateCode,
    at: new Date(),
  });
  return {
    userId: user.id,
    role: user.role,
    societyId: user.societyId ?? undefined,
    stateCode: user.stateCode ?? undefined,
    institutionId: user.institutionId ?? undefined,
  };
}

export async function executeVoiceActions(
  actions: VoiceAction[],
  ctx: { phone: string; locale: Locale; idempotencyKey: string },
  deps: ActionExecutorDeps,
  log: FastifyBaseLogger,
): Promise<ActionExecutionResult> {
  const result: ActionExecutionResult = {};

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'recordConsent': {
          const actor = await actorForPhone(ctx.phone, ctx.locale, deps);
          const reqCtx = requestContext(actor, ctx.locale);
          await deps.consent.acceptTerms(reqCtx, 'voice');
          break;
        }

        case 'createBooking': {
          const actor = await actorForPhone(ctx.phone, ctx.locale, deps);
          const reqCtx = requestContext(actor, ctx.locale);
          const created = await deps.bookings.createBooking(reqCtx, action.payload, ctx.idempotencyKey);
          result.bookingId = created.id;
          break;
        }

        case 'acceptOffer':
        case 'declineOffer':
        case 'setAvailability':
        case 'startJob':
        case 'completeJob':
        case 'setLocale':
          log.warn({ action }, 'voice action not yet wired to a core service — logged only');
          break;

        default: {
          const exhaustive: never = action;
          log.warn({ action: exhaustive }, 'unrecognized voice action');
        }
      }
    } catch (error) {
      log.error({ err: error, action }, 'voice action execution failed');
    }
  }

  return result;
}
