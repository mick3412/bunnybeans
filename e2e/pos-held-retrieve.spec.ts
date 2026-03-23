import { test, expect } from '@playwright/test';

test.describe('POS 掛單／取單', () => {
  test('暫無掛單時取單 Modal 顯示空態', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('e2e-login-submit').click();
    await expect(page).toHaveURL(/\/pos$/);
    await expect(page.locator('[data-testid^="pos-product-"]').first()).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('e2e-pos-retrieve-btn').click();
    await expect(page.getByTestId('e2e-pos-retrieve-held-modal')).toBeVisible({ timeout: 5_000 });
    // 新 session 無掛單應顯示空態
    await expect(page.getByTestId('e2e-pos-retrieve-empty')).toBeVisible();
    await expect(page.getByTestId('e2e-pos-retrieve-empty')).toHaveText('暫無掛單');
  });

  test('加品項 → 掛單 → 購物車清空 → 取單 → 選掛單 → 購物車回填', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('e2e-login-submit').click();
    await expect(page).toHaveURL(/\/pos$/);

    const productCard = page.locator('[data-testid^="pos-product-"]').first();
    await expect(productCard).toBeVisible({ timeout: 15_000 });
    await productCard.click();

    // 購物車應有品項（結帳鈕可點或共 N 件可見）
    await expect(page.getByTestId('e2e-checkout-open')).toBeEnabled({ timeout: 5_000 });
    await expect(page.getByText(/共 \d+ 件/)).toBeVisible();

    // 掛單
    await page.getByTestId('e2e-pos-hold-btn').click();

    // 購物車應清空
    await expect(page.getByTestId('e2e-pos-cart-empty')).toBeVisible({ timeout: 5_000 });

    // 取單
    await page.getByTestId('e2e-pos-retrieve-btn').click();
    await expect(page.getByTestId('e2e-pos-retrieve-held-modal')).toBeVisible({ timeout: 5_000 });

    // 應有掛單列（至少一筆）
    const heldRow = page.locator('[data-testid^="e2e-pos-retrieve-held-row-"]').first();
    await expect(heldRow).toBeVisible({ timeout: 5_000 });
    await heldRow.click();

    // Modal 關閉，購物車回填
    await expect(page.getByTestId('e2e-pos-retrieve-held-modal')).toBeHidden({ timeout: 5_000 });
    await expect(page.getByText(/共 \d+ 件/)).toBeVisible();
  });

});
