import { describe, expect, it } from 'vitest';
import { isSystemActor, ROLES, systemContext } from './context';

describe('systemContext', () => {
  it('builds a system actor with a fresh request id and English by default', () => {
    const ctx = systemContext('scheduled view refresh');
    expect(ctx.actor).toEqual({ system: true, reason: 'scheduled view refresh' });
    expect(ctx.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(ctx.locale).toBe('en');
    expect(systemContext('x').requestId).not.toBe(ctx.requestId);
  });

  it('accepts a request id and locale', () => {
    const ctx = systemContext('webhook', { requestId: 'req-1', locale: 'ml' });
    expect(ctx.requestId).toBe('req-1');
    expect(ctx.locale).toBe('ml');
  });

  it('requires a reason', () => {
    expect(() => systemContext('  ')).toThrow(RangeError);
  });
});

describe('isSystemActor', () => {
  it('tells system actors from users', () => {
    expect(isSystemActor({ system: true, reason: 'job' })).toBe(true);
    expect(isSystemActor({ userId: 'u1', role: 'customer' })).toBe(false);
  });

  it('lists the six roles of AGENTS.md 2', () => {
    expect(ROLES).toEqual([
      'customer',
      'worker',
      'lcs_admin',
      'state_admin',
      'national_admin',
      'institution_admin',
    ]);
  });
});
