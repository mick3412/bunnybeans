import { test, expect } from '@playwright/test';

test.describe('POS 退款', () => {
  test('全額結帳 → 明細 → 小額退款成功', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('e2e-login-submit').click();
    await expect(page).toHaveURL(/\/pos$/);

    await page.locator('[data-product-name="商品 A"]').first().click();
    await page.getByTestId('e2e-checkout-open').click();
    await expect(page.getByTestId('e2e-checkout-modal')).toBeVisible();
    await page.getByTestId('e2e-checkout-submit').click();
    await expect(page.getByTestId('e2e-checkout-modal')).toBeHidden({ timeout: 15_000 });

    await page.getByTestId('e2e-nav-orders').click();
    await expect(page).toHaveURL(/\/pos\/orders/);
    await page.getByTestId('e2e-orders-first-detail').click();
    await expect(page).toHaveURL(/\/pos\/orders\//);

    await expect(page.getByTestId('e2e-detail-refund-amount')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('e2e-detail-refund-amount').fill('1');
    await page.getByTestId('e2e-detail-refund-submit').click();
    // 成功時會清空金額欄並更新明細
    await expect(page.getByTestId('e2e-detail-refund-amount')).toHaveValue('', { timeout: 12_000 });
  });
});
