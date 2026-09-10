import { randomInt } from 'node:crypto';
import { SESSION_COOKIE } from '@kaithangu/core';
import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { sessionToken, type AuthFixture, type FixtureUser } from '../src/test/fixtures';

export function fixture(): AuthFixture & { pincode: string } {
  const raw = process.env.E2E_FIXTURE;
  if (!raw) throw new Error('E2E_FIXTURE missing: global setup did not run');
  return JSON.parse(raw) as AuthFixture & { pincode: string };
}

/** A fictional 10-digit mobile number starting with 9 (not in the fixture). */
export function newNationalNumber(): string {
  return `98${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
}

export async function signInAs(context: BrowserContext, baseURL: string, user: FixtureUser) {
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: await sessionToken(user),
      url: baseURL,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

/** AGENTS.md 7: nothing may overflow the 360 px viewport (checked in Malayalam). */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}
