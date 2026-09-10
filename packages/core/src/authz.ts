/**
 * Authorization policy (AGENTS.md 2, 4.2). Scope hierarchy national ⊃ state ⊃
 * society; workers see their own records, customers their own bookings,
 * institution admins their own institution. The system actor may do anything.
 * Checks fail closed: a missing scope id on the actor or the resource denies.
 */
import type { Actor, Role } from './context';
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

const ADMINS: Grants = { lcs_admin: 'society', state_admin: 'state', national_admin: 'any' };

export const POLICY: Readonly<Record<Action, Grants>> = {
  'booking.create': {
    customer: 'own_customer',
    lcs_admin: 'society',
    institution_admin: 'institution',
  },
  'booking.read': {
    customer: 'own_customer',
    worker: 'own_worker',
    ...ADMINS,
    institution_admin: 'institution',
  },
  'booking.cancel': { customer: 'own_customer', ...ADMINS, institution_admin: 'institution' },
  'booking.progress': { worker: 'own_worker' },
  'booking.assign_manual': ADMINS,
  'booking.rate': { customer: 'own_customer', institution_admin: 'institution' },
  'dispute.raise': {
    customer: 'own_customer',
    worker: 'own_worker',
    institution_admin: 'institution',
  },
  'dispute.resolve': ADMINS,
  'offer.respond': { worker: 'own_worker' },
  'worker.read': { worker: 'own_worker', ...ADMINS },
  'worker.update': { worker: 'own_worker', ...ADMINS },
  'worker.verify': ADMINS,
  'worker.suspend': ADMINS,
  'ledger.read': { worker: 'own_worker', ...ADMINS },
  'report.read': ADMINS,
  'broadcast.send': ADMINS,
  'society.read': ADMINS,
  'society.manage': { state_admin: 'state', national_admin: 'any' },
  'state_config.manage': { state_admin: 'state', national_admin: 'any' },
  'institution.read': {
    state_admin: 'state',
    national_admin: 'any',
    institution_admin: 'institution',
  },
  'institution.manage': { institution_admin: 'institution' },
  'invoice.read': { ...ADMINS, institution_admin: 'institution' },
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
