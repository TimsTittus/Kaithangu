/**
 * Authorization policy (AGENTS.md 2, 4.2). Users see their own bookings,
 * workers their own records, corporates their society. The system actor may do
 * anything. Checks fail closed: a missing scope id on the actor or the resource
 * denies.
 */
import type { Actor, RequestContext, Role, UserActor } from './context';
import { isSystemActor } from './context';
import { AppError } from './errors';

export const ACTIONS = [
  'booking.create',
  'booking.read',
  'booking.cancel',
  'booking.progress',
  'booking.assign_manual',
  'booking.rate',
  'dispute.raise',
  'dispute.resolve',
  'offer.respond',
  'worker.read',
  'worker.update',
  'worker.verify',
  'worker.suspend',
  'ledger.read',
  'report.read',
  'broadcast.send',
  'society.read',
  'society.manage',
  'state_config.manage',
  'institution.read',
  'institution.manage',
  'invoice.read',
] as const;

export type Action = (typeof ACTIONS)[number];

/**
 * Scope ids of the record being acted on. For a booking: its state, society,
 * institution, customer and assigned worker. For a worker record: workerId is
 * the worker's user id.
 */
export interface ResourceScope {
  stateCode?: string | null;
  societyId?: string | null;
  institutionId?: string | null;
  customerId?: string | null;
  workerId?: string | null;
}

/** How a role's permission is scoped. */
export type ScopeRule = 'any' | 'state' | 'society' | 'institution' | 'own_customer' | 'own_worker';

type Grants = Readonly<Partial<Record<Role, ScopeRule>>>;

const CORPORATE: Grants = { corporate: 'society' };

export const POLICY: Readonly<Record<Action, Grants>> = {
  'booking.create': { user: 'own_customer' },
  'booking.read': { user: 'own_customer', worker: 'own_worker', ...CORPORATE },
  'booking.cancel': { user: 'own_customer', ...CORPORATE },
  'booking.progress': { worker: 'own_worker' },
  'booking.assign_manual': CORPORATE,
  'booking.rate': { user: 'own_customer' },
  'dispute.raise': { user: 'own_customer', worker: 'own_worker' },
  'dispute.resolve': CORPORATE,
  'offer.respond': { worker: 'own_worker' },
  'worker.read': { worker: 'own_worker', ...CORPORATE },
  'worker.update': { worker: 'own_worker', ...CORPORATE },
  'worker.verify': CORPORATE,
  'worker.suspend': CORPORATE,
  'ledger.read': { worker: 'own_worker', ...CORPORATE },
  'report.read': CORPORATE,
  'broadcast.send': CORPORATE,
  'society.read': CORPORATE,
  'society.manage': CORPORATE,
  'state_config.manage': {},
  'institution.read': {},
  'institution.manage': {},
  'invoice.read': CORPORATE,
};

function same(actorValue: string | undefined, resourceValue: string | null | undefined): boolean {
  return (
    actorValue !== undefined &&
    actorValue !== '' &&
    resourceValue !== undefined &&
    resourceValue === actorValue
  );
}

export function can(actor: Actor, action: Action, resource: ResourceScope): boolean {
  if (isSystemActor(actor)) return true;
  const rule = POLICY[action][actor.role];
  switch (rule) {
    case undefined:
      return false;
    case 'any':
      return true;
    case 'state':
      return same(actor.stateCode, resource.stateCode);
    case 'society':
      return same(actor.societyId, resource.societyId);
    case 'institution':
      return same(actor.institutionId, resource.institutionId);
    case 'own_customer':
      return same(actor.userId, resource.customerId);
    case 'own_worker':
      return same(actor.userId, resource.workerId);
  }
}

/** Throw AppError('FORBIDDEN') unless `can` allows the action. */
export function assertCan(actor: Actor, action: Action, resource: ResourceScope): void {
  if (!can(actor, action, resource)) {
    throw new AppError('FORBIDDEN', undefined, undefined, { action });
  }
}

/**
 * The rows an actor may see for an action, as a filter that repositories turn
 * into SQL (the tenancy half of AGENTS.md 4.2). Mirrors `can`: every row that
 * passes the filter passes `can`, and a missing scope id fails closed.
 */
export type ScopeFilter =
  | { kind: 'all' }
  | { kind: 'state'; stateCode: string }
  | { kind: 'society'; societyId: string }
  | { kind: 'institution'; institutionId: string }
  | { kind: 'own_customer'; userId: string }
  | { kind: 'own_worker'; userId: string };

function required(value: string | undefined, action: Action): string {
  if (value === undefined || value === '') {
    throw new AppError('FORBIDDEN', undefined, undefined, { action });
  }
  return value;
}

/** Throws AppError('FORBIDDEN') when the actor has no grant for the action. */
export function scopeFilter(actor: Actor, action: Action): ScopeFilter {
  if (isSystemActor(actor)) return { kind: 'all' };
  const rule = POLICY[action][actor.role];
  switch (rule) {
    case undefined:
      throw new AppError('FORBIDDEN', undefined, undefined, { action });
    case 'any':
      return { kind: 'all' };
    case 'state':
      return { kind: 'state', stateCode: required(actor.stateCode, action) };
    case 'society':
      return { kind: 'society', societyId: required(actor.societyId, action) };
    case 'institution':
      return { kind: 'institution', institutionId: required(actor.institutionId, action) };
    case 'own_customer':
      return { kind: 'own_customer', userId: required(actor.userId, action) };
    case 'own_worker':
      return { kind: 'own_worker', userId: required(actor.userId, action) };
  }
}

export type UserContext<R extends Role = Role> = RequestContext & {
  actor: UserActor & { role: R };
};

/**
 * Narrow a (possibly missing) context to a signed-in user with one of `roles`.
 * No context → UNAUTHENTICATED; the system actor or another role → FORBIDDEN.
 */
export function requireRole<R extends Role>(
  ctx: RequestContext | null,
  roles: readonly R[],
): UserContext<R> {
  if (ctx === null) throw new AppError('UNAUTHENTICATED');
  const { actor } = ctx;
  if (isSystemActor(actor) || !(roles as readonly Role[]).includes(actor.role)) {
    throw new AppError('FORBIDDEN', undefined, undefined, { roles: [...roles] });
  }
  return ctx as UserContext<R>;
}
