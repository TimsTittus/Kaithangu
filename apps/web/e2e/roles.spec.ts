import { expect, test } from '@playwright/test';
import type { FixtureUserKey } from '../src/test/fixtures';
import { fixture, signInAs } from './helpers';

// Every demo role lands on its own home and is sent to /forbidden elsewhere.
const HOMES: Record<FixtureUserKey, string> = {
  customer: '/app',
  worker: '/w',
  lcsA: '/admin',
  lcsB: '/admin',
  stateKL: '/admin',
  stateTN: '/admin',
  national: '/admin',
  institution: '/org',
};
const AREAS = ['/app', '/w', '/admin', '/org'];

test('signed-out visitors are sent to /login with the page to return to', async ({ page }) => {
  for (const area of AREAS) {
    await page.goto(`${area}?x=1`);
    await expect(page).toHaveURL(new RegExp(`/(login|language)\\?next=`));
  }
});

for (const [key, home] of Object.entries(HOMES) as [FixtureUserKey, string][]) {
  test(`${key} opens ${home} and is forbidden elsewhere`, async ({ page, context, baseURL }) => {
    await signInAs(context, baseURL ?? '', fixture().users[key]);

    await page.goto('/');
    await expect(page).toHaveURL(new RegExp(`${home}$`));
    await expect(page.getByTestId('home-title')).toBeVisible();

    // Already signed in: /login continues to the role's home.
    await page.goto('/login');
    await expect(page).toHaveURL(new RegExp(`${home}$`));

    for (const area of AREAS.filter((path) => path !== home)) {
      await page.goto(area);
      await expect(page, `${key} → ${area}`).toHaveURL(/\/forbidden$/);
      await expect(page.getByTestId('forbidden-title')).toBeVisible();
    }
  });
}

test('/dev/inbox is served when DEV_INBOX=true', async ({ page }) => {
  const response = await page.goto('/dev/inbox');
  expect(response?.status()).toBe(200);
});
