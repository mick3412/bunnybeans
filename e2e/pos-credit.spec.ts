import { test, expect } from '@playwright/test';

/** 與 backend/prisma/seed.ts 首次建立之 C001 客戶 id 一致 */
const E2E_CUSTOMER_ID = 'e2e00001-0000-4000-8000-00000000c001';

test.describe('POS 掛帳與補款', () => {
  test('掛帳建單 → 明細未收 → 補款後未收減少', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('e2e-login-submit').click();
    await expect(page).toHaveURL(/\/pos$/);

    await page.locator('[data-product-name="商品 A"]').first().click();
    await page.getByTestId('e2e-checkout-open').click();
    await page.getByTestId('e2e-checkout-member').fill(E2E_CUSTOMER_ID);
    await page.getByTestId('e2e-checkout-received').fill('0');
    await page.getByTestId('e2e-checkout-submit').click();
    await expect(page.getByTestId('e2e-checkout-modal')).toBeHidden({ timeout: 15_000 });

    await page.getByTestId('e2e-nav-orders').click();
    await page.getByTestId('e2e-orders-first-detail').click();
    await expect(page).toHaveURL(/\/pos\/orders\//);

    const remaining = page.getByTestId('e2e-detail-remaining');
    await expect(remaining).toBeVisible({ timeout: 10_000 });
    const before = await remaining.textContent();
    const beforeNum = Number((before ?? '').replace(/[^\d]/g, ''));
    expect(beforeNum).toBeGreaterThan(0);

    const payPart = Math.min(50, Math.max(1, Math.floor(beforeNum / 2)));
    await page.getByTestId('e2e-detail-pay-amount').fill(String(payPart));
    await page.getByTestId('e2e-detail-append-payment').click();

    await expect
      .poll(async () => {
        const t = await page.getByTestId('e2e-detail-remaining').textContent();
        return Number((t ?? '').replace(/[^\d]/g, ''));
      })
      .toBeLessThan(beforeNum);
  });
});
