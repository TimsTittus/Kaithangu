import { describe, expect, it } from 'vitest';
import { ACTIONS, assertCan, can, type Action, type ResourceScope, type ScopeRule } from './authz';
import { ROLES, type Role, type UserActor } from './context';
import { AppError } from './errors';

// The approved Phase 3 matrix, written out independently of POLICY.
const A = { lcs_admin: 'society', state_admin: 'state', national_admin: 'any' } as const;
const EXPECTED: Record<Action, Partial<Record<Role, ScopeRule>>> = {
  'booking.create': {
    customer: 'own_customer',
    lcs_admin: 'society',
    institution_admin: 'institution',
  },
  'booking.read': {
    customer: 'own_customer',
    worker: 'own_worker',
    ...A,
    institution_admin: 'institution',
  },
  'booking.cancel': { customer: 'own_customer', ...A, institution_admin: 'institution' },
  'booking.progress': { worker: 'own_worker' },
  'booking.assign_manual': { ...A },
  'booking.rate': { customer: 'own_customer', institution_admin: 'institution' },
  'dispute.raise': {
    customer: 'own_customer',
    worker: 'own_worker',
    institution_admin: 'institution',
  },
  'dispute.resolve': { ...A },
  'offer.respond': { worker: 'own_worker' },
  'worker.read': { worker: 'own_worker', ...A },
  'worker.update': { worker: 'own_worker', ...A },
  'worker.verify': { ...A },
  'worker.suspend': { ...A },
  'ledger.read': { worker: 'own_worker', ...A },
  'report.read': { ...A },
  'broadcast.send': { ...A },
  'society.read': { ...A },
  'society.manage': { state_admin: 'state', national_admin: 'any' },
  'state_config.manage': { state_admin: 'state', national_admin: 'any' },
  'institution.read': {
    state_admin: 'state',
    national_admin: 'any',
    institution_admin: 'institution',
  },
  'institution.manage': { institution_admin: 'institution' },
  'invoice.read': { ...A, institution_admin: 'institution' },
};

// Fictional test ids.
const USER = 'user-1';
const STATE = 'XA';
const SOCIETY = 'society-1';
const INSTITUTION = 'institution-1';

function actor(role: Role): UserActor {
  return { userId: USER, role, stateCode: STATE, societyId: SOCIETY, institutionId: INSTITUTION };
}

/** A resource that is inside every scope of the actor above. */
const IN_SCOPE: ResourceScope = {
  stateCode: STATE,
  societyId: SOCIETY,
  institutionId: INSTITUTION,
  customerId: USER,
  workerId: USER,
};

/** A resource outside every scope of the actor above. */
const OUT_OF_SCOPE: ResourceScope = {
  stateCode: 'XB',
  societyId: 'society-2',
  institutionId: 'institution-2',
  customerId: 'user-2',
  workerId: 'user-3',
};

/** The one resource field each rule depends on. */
const RULE_FIELD: Record<Exclude<ScopeRule, 'any'>, keyof ResourceScope> = {
  state: 'stateCode',
  society: 'societyId',
  institution: 'institutionId',
  own_customer: 'customerId',
  own_worker: 'workerId',
};

const ACTOR_FIELD: Record<Exclude<ScopeRule, 'any'>, keyof UserActor> = {
  state: 'stateCode',
  society: 'societyId',
  institution: 'institutionId',
  own_customer: 'userId',
  own_worker: 'userId',
};

const MATRIX = ACTIONS.flatMap((action) =>
  ROLES.map((role) => ({ action, role, rule: EXPECTED[action][role] ?? null })),
);

describe('authz matrix', () => {
  it('covers every role × action', () => {
    expect(MATRIX).toHaveLength(ACTIONS.length * ROLES.length);
    expect(Object.keys(EXPECTED).sort()).toEqual([...ACTIONS].sort());
  });

  it.each(MATRIX)('$role · $action → $rule', ({ action, role, rule }) => {
    const subject = actor(role);
    if (rule === null) {
      expect(can(subject, action, IN_SCOPE)).toBe(false);
      expect(can(subject, action, OUT_OF_SCOPE)).toBe(false);
      expect(() => assertCan(subject, action, IN_SCOPE)).toThrow(AppError);
      return;
    }
    expect(can(subject, action, IN_SCOPE)).toBe(true);
    expect(() => assertCan(subject, action, IN_SCOPE)).not.toThrow();
    if (rule === 'any') {
      expect(can(subject, action, OUT_OF_SCOPE)).toBe(true);
      expect(can(subject, action, {})).toBe(true);
      return;
    }
    const field = RULE_FIELD[rule];
    // Only the rule's own field matters: changing it alone denies ...
    expect(can(subject, action, { ...IN_SCOPE, [field]: OUT_OF_SCOPE[field] })).toBe(false);
    expect(can(subject, action, { ...IN_SCOPE, [field]: null })).toBe(false);
    expect(can(subject, action, { ...IN_SCOPE, [field]: undefined })).toBe(false);
    // ... and matching it alone allows.
    expect(can(subject, action, { ...OUT_OF_SCOPE, [field]: IN_SCOPE[field] })).toBe(true);
    expect(can(subject, action, OUT_OF_SCOPE)).toBe(false);
    // An actor without the scope id is denied (fail closed), even against an empty-string id.
    const unscoped = { ...subject, [ACTOR_FIELD[rule]]: undefined };
    expect(can(unscoped, action, IN_SCOPE)).toBe(false);
    const blank = { ...subject, [ACTOR_FIELD[rule]]: '' };
    expect(can(blank, action, { ...IN_SCOPE, [field]: '' })).toBe(false);
  });
});

describe('authz: system actor and errors', () => {
  it('lets the system actor do everything', () => {
    for (const action of ACTIONS) {
      expect(can({ system: true, reason: 'test' }, action, {})).toBe(true);
    }
  });

  it('throws FORBIDDEN with the action in details', () => {
    try {
      assertCan(actor('customer'), 'worker.verify', IN_SCOPE);
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe('FORBIDDEN');
      expect(appError.httpStatus).toBe(403);
      expect(appError.details).toEqual({ action: 'worker.verify' });
    }
  });
});
