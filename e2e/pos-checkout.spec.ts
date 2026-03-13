import { test, expect } from '@playwright/test';

test.describe('POS 全額結帳', () => {
  test('登入 → 收銀 → 加商品 → 結帳 → 訂單列表有單號', async ({ page }) => {
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

    const orderNo = page.getByTestId('e2e-orders-first-order-number');
    await expect(orderNo).toBeVisible({ timeout: 10_000 });
    await expect(orderNo).toHaveText(/./);
  });
});
