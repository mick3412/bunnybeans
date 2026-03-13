import { test, expect } from '@playwright/test';

test.describe('POS 退貨入庫', () => {
  test('全額結帳 → 明細 → 退貨入庫 1 件', async ({ page }) => {
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
    // 必須進「本單」明細：列表依建立時間 desc，第一列即剛結帳的那一筆
    await page.getByTestId('e2e-orders-first-detail').click();
    await expect(page).toHaveURL(/\/pos\/orders\//);
    await expect(page.getByTestId('e2e-detail-return-qty')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('e2e-detail-return-qty').fill('1');

    const respPromise = page.waitForResponse(
      (r) =>
        r.url().includes('/pos/orders/') &&
        (r.url().includes('/returns/stock') || r.url().includes('/return-to-stock')) &&
        r.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await page.getByTestId('e2e-detail-return-submit').click();
    const resp = await respPromise;
    expect(resp.status(), `return-to-stock HTTP status (body may hint error)`).toBe(201);

    await expect(page.getByTestId('e2e-detail-return-success')).toBeVisible({ timeout: 5_000 });
  });
});
