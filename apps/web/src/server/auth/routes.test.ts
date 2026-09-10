import { describe, expect, it } from 'vitest';
import { areaFor, canOpen, loginPath, ROLE_HOME, safeNext } from './routes';

describe('areaFor / canOpen', () => {
  it('matches area prefixes exactly or as a path segment', () => {
    expect(areaFor('/app')?.prefix).toBe('/app');
    expect(areaFor('/app/bookings/1')?.prefix).toBe('/app');
    expect(areaFor('/apple')).toBeNull();
    expect(areaFor('/w')?.roles).toEqual(['worker']);
    expect(areaFor('/wx')).toBeNull();
    expect(areaFor('/admin/workers')?.roles).toEqual([
      'lcs_admin',
      'state_admin',
      'national_admin',
    ]);
    expect(areaFor('/org')?.roles).toEqual(['institution_admin']);
    expect(areaFor('/login')).toBeNull();
  });

  it('lets each role open its own home only', () => {
    for (const [role, home] of Object.entries(ROLE_HOME) as [keyof typeof ROLE_HOME, string][]) {
      expect(canOpen(role, home), role).toBe(true);
      for (const other of ['/app', '/w', '/admin', '/org'].filter((path) => path !== home)) {
        expect(canOpen(role, other), `${role} ${other}`).toBe(false);
      }
      expect(canOpen(role, '/consent')).toBe(true);
    }
  });
});

describe('safeNext', () => {
  it('keeps same-origin paths with their query', () => {
    expect(safeNext('/app', '/x')).toBe('/app');
    expect(safeNext('/app/bookings?tab=open', '/x')).toBe('/app/bookings?tab=open');
    expect(safeNext('/dev-tools/some-page', '/x')).toBe('/dev-tools/some-page');
  });

  it('rejects open redirects and malformed values', () => {
    for (const bad of [
      null,
      undefined,
      '',
      'app',
      'https://evil.example/app',
      '//evil.example/app',
      '/\\evil.example',
      '/app\nSet-Cookie: x',
      'javascript:alert(1)',
    ]) {
      expect(safeNext(bad, '/fallback'), String(bad)).toBe('/fallback');
    }
  });

  it('with a role, rejects areas that role cannot open', () => {
    expect(safeNext('/admin', '/app', 'customer')).toBe('/app');
    expect(safeNext('/app?x=1', '/w', 'customer')).toBe('/app?x=1');
    expect(safeNext('/consent', '/w', 'worker')).toBe('/consent');
  });
});

describe('loginPath', () => {
  it('encodes the page to return to', () => {
    expect(loginPath('/app?tab=1')).toBe('/login?next=%2Fapp%3Ftab%3D1');
  });
});
