import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers';

test('guest landing page is in English by default and allows switching language via dropdown', async ({
  page,
}) => {
  await page.goto('/');

  // 1. By default it is in English
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('header')).toBeVisible();
  await expect(page.getByText('Government of India').first()).toBeVisible();
  await expect(page.getByText('Ministry of Cooperation').first()).toBeVisible();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Dignity for Workers. Absolute Trust for Citizens.',
    }),
  ).toBeVisible();

  // Dropdown button displays "English"
  const dropdownBtn = page.getByTestId('language-dropdown-btn');
  await expect(dropdownBtn).toBeVisible();
  await expect(dropdownBtn).toContainText('English');

  // Mobile viewport check: no horizontal overflow at 360px
  await expectNoHorizontalOverflow(page);

  // 2. Open dropdown and switch to Malayalam (മലയാളം)
  await dropdownBtn.click();
  const selectMl = page.getByTestId('select-language-ml');
  await expect(selectMl).toBeVisible();
  await selectMl.click();

  // Page switches to Malayalam
  await expect(page.getByText('ഭാരത സർക്കാർ').first()).toBeVisible();
  await expect(page.getByText('സഹകരണ മന്ത്രാലയം').first()).toBeVisible();
  await expect(page.getByTestId('language-dropdown-btn')).toContainText('മലയാളം');
  await expectNoHorizontalOverflow(page);

  // 3. Switch to Hindi (हिन्दी)
  await page.getByTestId('language-dropdown-btn').click();
  const selectHi = page.getByTestId('select-language-hi');
  await expect(selectHi).toBeVisible();
  await selectHi.click();

  // Page switches to Hindi
  await expect(page.getByText('भारत सरकार').first()).toBeVisible();
  await expect(page.getByText('सहकारिता मंत्रालय').first()).toBeVisible();
  await expect(page.getByTestId('language-dropdown-btn')).toContainText('हिन्दी');
  await expectNoHorizontalOverflow(page);

  // 4. Switch to Tamil (தமிழ்)
  await page.getByTestId('language-dropdown-btn').click();
  const selectTa = page.getByTestId('select-language-ta');
  await expect(selectTa).toBeVisible();
  await selectTa.click();

  // Page switches to Tamil
  await expect(page.getByText('இந்திய அரசு').first()).toBeVisible();
  await expect(page.getByText('கூட்டுறவு அமைச்சகம்').first()).toBeVisible();
  await expect(page.getByTestId('language-dropdown-btn')).toContainText('தமிழ்');
  await expectNoHorizontalOverflow(page);

  // 5. Click CTA button to navigate to /language?next=%2Flogin
  const enterBtn = page
    .getByRole('link', { name: /கூட்டுறவு தளத்தில் நுழையவும்|Get Started|Enter/i })
    .first();
  await expect(enterBtn).toBeVisible();
  await enterBtn.click();
  await expect(page).toHaveURL(/\/language\?next=%2Flogin/);
});
