/**
 * Request context (AGENTS.md 4.2). Every service function takes `ctx` first.
 * The actor is either a signed-in user with a role and scope ids, or the system
 * itself (jobs, webhooks) with a reason recorded for audit.
 */
import { randomUUID } from 'node:crypto';
import type { Locale } from '@/lib/i18n';

/** AGENTS.md 2. */
export const ROLES = [
  'customer',
  'worker',
  'lcs_admin',
  'state_admin',
  'national_admin',
  'institution_admin',
] as const;

export type Role = (typeof ROLES)[number];

export interface UserActor {
  userId: string;
  role: Role;
  societyId?: string;
  stateCode?: string;
  institutionId?: string;
}

export interface SystemActor {
  system: true;
  reason: string;
}

export type Actor = UserActor | SystemActor;

export interface RequestContext {
  actor: Actor;
  requestId: string;
  locale: Locale;
}

export function isSystemActor(actor: Actor): actor is SystemActor {
  return 'system' in actor;
}

export interface SystemContextOptions {
  requestId?: string;
  locale?: Locale;
}

/** Context for work the system does on its own behalf (jobs, webhooks, scripts). */
export function systemContext(reason: string, options: SystemContextOptions = {}): RequestContext {
  if (reason.trim() === '') {
    throw new RangeError('systemContext: reason is required');
  }
  return {
    actor: { system: true, reason },
    requestId: options.requestId ?? randomUUID(),
    locale: options.locale ?? 'en',
  };
}

/** Context for a signed-in actor acting outside the web session flow (e.g. a voice call). */
export function requestContext(
  actor: UserActor,
  locale: Locale,
  options: SystemContextOptions = {},
): RequestContext {
  return {
    actor,
    requestId: options.requestId ?? randomUUID(),
    locale: options.locale ?? locale,
  };
}
