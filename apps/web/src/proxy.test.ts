import { randomUUID } from 'node:crypto';
import { SESSION_COOKIE, signSession, type Role } from '@kaithangu/core';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';
import { proxy } from './proxy';

const originalDevInbox = process.env.DEV_INBOX;

afterEach(() => {
  process.env.DEV_INBOX = originalDevInbox;
});

async function request(path: string, role?: Role, secret = process.env.SESSION_SECRET ?? '') {
  const headers: Record<string, string> = {};
  if (role) {
    const token = await signSession({ sub: randomUUID(), role, sv: 0 }, secret);
    headers.cookie = `${SESSION_COOKIE}=${token}`;
  }
  return proxy(new NextRequest(`http://localhost${path}`, { headers }));
}

const passedThrough = (response: Response) => response.headers.get('x-middleware-next') === '1';

describe('proxy route protection', () => {
  it('redirects unauthenticated users to /login?next=… keeping the query', async () => {
    const response = await request('/app/bookings?tab=open');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/login?next=%2Fapp%2Fbookings%3Ftab%3Dopen',
    );
  });

  it.each([
    ['/app', 'customer'],
    ['/w', 'worker'],
    ['/admin', 'lcs_admin'],
    ['/admin/workers', 'state_admin'],
    ['/admin', 'national_admin'],
    ['/org', 'institution_admin'],
  ] as const)('lets %s through for %s', async (path, role) => {
    expect(passedThrough(await request(path, role))).toBe(true);
  });

  it.each([
    ['/app', 'worker'],
    ['/w', 'customer'],
    ['/admin', 'customer'],
    ['/admin', 'worker'],
    ['/admin', 'institution_admin'],
    ['/org', 'lcs_admin'],
  ] as const)('sends %s for %s to /forbidden', async (path, role) => {
    const response = await request(path, role);
    expect(response.headers.get('location')).toBe('http://localhost/forbidden');
  });

  it('treats a token signed with another secret as signed out', async () => {
    const response = await request('/app', 'customer', 'some-other-secret-0123456789abcdef');
    expect(response.headers.get('location')).toMatch(/\/login\?next=%2Fapp$/);
  });

  it('ignores public pages', async () => {
    for (const path of ['/login', '/language', '/consent', '/forbidden', '/apple']) {
      expect(passedThrough(await request(path)), path).toBe(true);
    }
  });
});

describe('proxy /dev/*', () => {
  it('returns 404 unless DEV_INBOX=true', async () => {
    for (const value of [undefined, '', 'false', './.dev-inbox', 'TRUE']) {
      if (value === undefined) delete process.env.DEV_INBOX;
      else process.env.DEV_INBOX = value;
      expect((await request('/dev/inbox')).status, String(value)).toBe(404);
    }
  });

  it('serves the dev inbox when DEV_INBOX=true', async () => {
    process.env.DEV_INBOX = 'true';
    expect(passedThrough(await request('/dev/inbox'))).toBe(true);
  });
});
