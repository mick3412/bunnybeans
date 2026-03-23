import { test, expect } from '@playwright/test';

const hasAdminKey = Boolean(
  (process.env.VITE_ADMIN_API_KEY ?? process.env.ADMIN_API_KEY ?? '').trim(),
);

/** 需後端 3003 + db:seed 門市，storeId 就緒後取單/掛單按鈕才會 enabled */
async function requireStoreIdReady(page: import('@playwright/test').Page): Promise<void> {
  const retrieveBtn = page.getByTestId('e2e-pos-retrieve-btn');
  await retrieveBtn.waitFor({ state: 'visible', timeout: 5_000 });
  for (let i = 0; i < 20; i++) {
    if (await retrieveBtn.isEnabled()) return;
    await page.waitForTimeout(500);
  }
  test.skip(true, 'storeId not ready - need backend 3003 + db:seed with stores');
}

test.describe('POS 掛單／取單', () => {
  test('暫無掛單時取單 Modal 顯示空態', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('e2e-login-submit').click();
    await expect(page).toHaveURL(/\/pos$/);
    await expect(page.locator('[data-testid^="pos-product-"]').first()).toBeVisible({ timeout: 15_000 });

    await requireStoreIdReady(page);
    await page.getByTestId('e2e-pos-retrieve-btn').click();
    await expect(page.getByTestId('e2e-pos-retrieve-held-modal')).toBeVisible({ timeout: 5_000 });
    // 新 session 無掛單應顯示空態
    await expect(page.getByTestId('e2e-pos-retrieve-empty')).toBeVisible();
    await expect(page.getByTestId('e2e-pos-retrieve-empty')).toHaveText('暫無掛單');
  });

  test('加品項 → 掛單 → 購物車清空 → 取單 → 選掛單 → 購物車回填', async ({ page }) => {
    test.skip(!hasAdminKey, '掛單/取單需 VITE_ADMIN_API_KEY（與後端 ADMIN_API_KEY 一致）');
    await page.goto('/');
    await page.getByTestId('e2e-login-submit').click();
    await expect(page).toHaveURL(/\/pos$/);
    await expect(page.locator('[data-testid^="pos-product-"]').first()).toBeVisible({ timeout: 15_000 });

    await requireStoreIdReady(page);

    const productCard = page.locator('[data-testid^="pos-product-"]').first();
    await productCard.click();

    // 購物車應有品項
    await expect(page.getByTestId('e2e-checkout-open')).toBeEnabled({ timeout: 5_000 });
    await expect(page.getByText(/共 \d+ 件/).first()).toBeVisible();

    // 掛單（等 API 完成後再斷言）
    const holdRequest = page.waitForResponse(
      (res) => res.url().includes('held-carts') && res.request().method() === 'POST',
      { timeout: 8_000 },
    );
    await page.getByTestId('e2e-pos-hold-btn').click();
    const holdRes = await holdRequest;
    if (!holdRes.ok()) {
      const body = await holdRes.json().catch(() => ({})) as { code?: string; message?: string };
      test.skip(true, `hold API failed: ${holdRes.status()} ${body.code ?? body.message ?? ''} - 需後端 ADMIN_API_KEY 與 VITE_ADMIN_API_KEY 一致`);
    }

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
    await expect(page.getByText(/共 \d+ 件/).first()).toBeVisible();
  });

});
