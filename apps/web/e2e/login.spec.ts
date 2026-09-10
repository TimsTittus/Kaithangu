import ml from '@kaithangu/i18n/catalogs/ml.json' with { type: 'json' };
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, newNationalNumber } from './helpers';

test('first sign-in in Malayalam: language → phone → OTP from /dev/inbox → consent → /app', async ({
  page,
  context,
}) => {
  const national = newNationalNumber();

  // A protected page sends a new visitor to sign in, and sign-in asks for a language first.
  await page.goto('/app');
  await expect(page).toHaveURL(/\/language\?next=/);
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('language-ml').click();

  await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ml');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(ml.auth.login_title);
  await expectNoHorizontalOverflow(page);

  await page.getByTestId('phone-input').fill(national);
  await page.getByTestId('send-code').click();
  await expect(page).toHaveURL(/\/login\/verify\?/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(ml.auth.verify_title);
  await expectNoHorizontalOverflow(page);

  // Read the code the mock SMS adapter delivered.
  const inbox = await context.newPage();
  await inbox.goto('/dev/inbox');
  const message = inbox
    .locator(`[data-testid="dev-inbox-message"][data-to="+91${national}"]`)
    .first();
  await expect(message).toBeVisible();
  const text = (await message.getByTestId('dev-inbox-text').textContent()) ?? '';
  expect(text).toContain('കൈത്താങ്ങ്');
  const code = /\b(\d{6})\b/.exec(text)?.[1];
  expect(code).toMatch(/^\d{6}$/);
  await inbox.close();

  // Autofill-style entry: the whole code lands in the first box and is spread out.
  await page.getByTestId('otp-digit-1').fill(code ?? '');

  await expect(page).toHaveURL(/\/consent\?next=%2Fapp$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(ml.consent.title);
  await expectNoHorizontalOverflow(page);
  await page.getByTestId('consent-accept').click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByTestId('home-title')).toHaveText(ml.home.customer_title);
  await expectNoHorizontalOverflow(page);

  // The session and consent persist: reopening /app goes straight home.
  await page.goto('/app');
  await expect(page.getByTestId('home-title')).toHaveText(ml.home.customer_title);

  // Sign out returns to the sign-in page and protects /app again.
  await page.getByTestId('logout').click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
});

test('a wrong code shows a Malayalam error and keeps the user on the verify page', async ({
  page,
  context,
}) => {
  await context.addCookies([{ name: 'NEXT_LOCALE', value: 'ml', url: 'http://localhost:3100' }]);
  const national = newNationalNumber();
  await page.goto('/login');
  await page.getByTestId('phone-input').fill(national);
  await page.getByTestId('send-code').click();
  await expect(page).toHaveURL(/\/login\/verify\?/);

  const inbox = await context.newPage();
  await inbox.goto('/dev/inbox');
  const text =
    (await inbox
      .locator(`[data-testid="dev-inbox-message"][data-to="+91${national}"]`)
      .first()
      .getByTestId('dev-inbox-text')
      .textContent()) ?? '';
  await inbox.close();
  const code = /\b(\d{6})\b/.exec(text)?.[1] ?? '';
  const wrong = code === '000000' ? '111111' : '000000';

  await page.getByTestId('otp-digit-1').fill(wrong);
  await expect(page.getByTestId('otp-error')).toHaveText(ml.error.OTP_INVALID);
  await expect(page).toHaveURL(/\/login\/verify\?/);
  await expect(page.getByTestId('otp-digit-1')).toHaveValue('');
});
