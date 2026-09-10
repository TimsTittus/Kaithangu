import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import en from '@kaithangu/i18n/catalogs/en.json' with { type: 'json' };
import ml from '@kaithangu/i18n/catalogs/ml.json' with { type: 'json' };
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { expectNoHorizontalOverflow, fixture, signInAs } from './helpers';

/**
 * Phase 5 customer booking (AGENTS.md 7): on a Pixel 5 profile at 360×640,
 * network throttled to slow 3G through CDP. Malayalam runs save a screenshot
 * of every step to docs/screens/ and check nothing overflows horizontally.
 */
const SCREENS = fileURLToPath(new URL('../../../docs/screens/', import.meta.url));
const BASE = 'http://localhost:3100';
const CATALOGS = { en, ml } as const;
type Locale = keyof typeof CATALOGS;

// Chrome DevTools "Slow 3G": 2 s latency, ~400 kbit/s each way.
const SLOW_3G = {
  offline: false,
  latency: 2000,
  downloadThroughput: (500 * 1024 * 0.8) / 8,
  uploadThroughput: (500 * 1024 * 0.8) / 8,
};

test.describe.configure({ timeout: 300_000 });
test.use({ actionTimeout: 60_000, navigationTimeout: 120_000 });

async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', SLOW_3G);
}

async function signIn(context: BrowserContext, locale: Locale) {
  await signInAs(context, BASE, fixture().users.customer);
  await context.addCookies([{ name: 'NEXT_LOCALE', value: locale, url: BASE }]);
}

async function step(page: Page, locale: Locale, name: string) {
  await expectNoHorizontalOverflow(page);
  if (locale === 'ml') {
    mkdirSync(SCREENS, { recursive: true });
    await page.screenshot({ path: `${SCREENS}${name}.png`, fullPage: true });
  }
}

for (const locale of ['ml', 'en'] as const) {
  const t = CATALOGS[locale];

  test(`${locale}: book a plumber from home to the tracking page on slow 3G`, async ({
    page,
    context,
  }) => {
    await signIn(context, locale);
    await throttle(page);
    const started = Date.now();

    await page.goto('/app');
    await expect(page.getByTestId('home-title')).toHaveText(t.home.customer_title);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await step(page, locale, '01-home');

    await page.getByTestId('trade-plumber').click();
    await expect(page.getByTestId('step-title')).toHaveText(t.booking.problem_title);
    // An empty problem is refused before moving on.
    await page.getByTestId('next').click();
    await expect(page.getByTestId('wizard-error')).toHaveText(t.booking.problem_required);
    await page.getByTestId('chip-leak').click();
    await expect(page.getByTestId('problem-input')).toHaveValue(t.trades.chips.plumber.leak);
    await step(page, locale, '02-problem');
    await page.getByTestId('next').click();

    await expect(page.getByTestId('step-title')).toHaveText(t.booking.location_title);
    await page.getByTestId('pincode-input').fill(fixture().pincode);
    await page.getByTestId('landmark-input').fill('Test House (Demo), Test Street');
    await step(page, locale, '03-location');
    await page.getByTestId('next').click();

    await expect(page.getByTestId('step-title')).toHaveText(t.booking.when_title);
    await page.getByTestId('when-slot').click();
    await expect(page.getByTestId('slot-option').first()).toBeVisible();
    await step(page, locale, '04-when-slot');
    await page.getByTestId('when-now').click();
    await expect(page.getByTestId('when-now')).toHaveAttribute('aria-checked', 'true');
    await step(page, locale, '04-when');
    await page.getByTestId('next').click();

    await expect(page.getByTestId('step-title')).toHaveText(t.booking.quote_title);
    await expect(page.getByTestId('quote-total')).toBeVisible();
    await expect(page.getByTestId('quote-line-pricing.welfare')).toBeVisible();
    await expect(page.getByText(t.booking.quote_welfare_note)).toBeVisible();
    await step(page, locale, '05-quote');
    await page.getByTestId('confirm').click();

    await expect(page).toHaveURL(/\/app\/bookings\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId('booking-status')).toHaveAttribute('data-status', 'requested');
    await expect(page.getByTestId('booking-status')).toHaveText(t.status.requested);
    await expect(page.getByTestId('timeline')).toBeVisible();
    // AGENTS.md goal: a booking in under 90 seconds, even on slow 3G.
    expect(Date.now() - started).toBeLessThan(90_000);
    await step(page, locale, '06-tracking');

    await page.goto('/app/bookings');
    await expect(page.getByTestId('booking-item').first()).toBeVisible();
    await step(page, locale, '07-bookings');
  });

  test(`${locale}: cancel a booking from the tracking page`, async ({ page, context }) => {
    await signIn(context, locale);
    const created = await page.request.post('/api/v1/bookings', {
      headers: { 'idempotency-key': `e2e-cancel-${locale}-${Date.now()}` },
      data: {
        tradeCode: 'electrician',
        pincode: fixture().pincode,
        problemText: 'Switch not working (e2e)',
        addressText: 'Test House (Demo)',
      },
    });
    expect(created.status()).toBe(201);
    const { data } = (await created.json()) as { data: { id: string } };

    await throttle(page);
    await page.goto(`/app/bookings/${data.id}`);
    await expect(page.getByTestId('booking-status')).toHaveAttribute('data-status', 'requested');
    await page.getByTestId('cancel').click();
    await expect(page.getByText(t.booking.cancel_confirm)).toBeVisible();
    await step(page, locale, '08-cancel-confirm');
    await page.getByTestId('cancel-yes').click();
    await expect(page.getByTestId('booking-status')).toHaveAttribute('data-status', 'cancelled');
    await expect(page.getByTestId('booking-status')).toHaveText(t.status.cancelled);
    await expect(page.getByTestId('cancel')).toHaveCount(0);
    await step(page, locale, '09-cancelled');

    // Cancelling again is refused by the state machine.
    const again = await page.request.post(`/api/v1/bookings/${data.id}/cancel`, { data: {} });
    expect(again.status()).toBe(409);
  });

  test(`${locale}: the offline banner appears when the connection drops`, async ({
    page,
    context,
  }) => {
    await signIn(context, locale);
    await page.goto('/app');
    await expect(page.getByTestId('offline-banner')).toHaveCount(0);
    await context.setOffline(true);
    await expect(page.getByTestId('offline-banner')).toHaveText(t.common.offline);
    await step(page, locale, '10-offline');
    await context.setOffline(false);
    await expect(page.getByTestId('offline-banner')).toHaveCount(0);
  });
}
