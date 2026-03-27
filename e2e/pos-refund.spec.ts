import { test, expect } from '@playwright/test';

test.describe('POS 退款', () => {
  test('全額結帳 → 明細 → 小額退款成功', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('e2e-login-submit').click();
    await expect(page).toHaveURL(/\/pos$/);

    // 確保已選門市（未選時結帳會被 disable / 後端也可能拒絕）
    const storeSelect = page.getByTestId('e2e-pos-store-select');
    await expect(storeSelect).toBeVisible({ timeout: 15_000 });
    const storeValue = await storeSelect.inputValue();
    if (!storeValue) {
      const opts = await storeSelect.locator('option').allTextContents();
      const idx =
        opts.findIndex((t) => t.includes('S001')) >= 0
          ? opts.findIndex((t) => t.includes('S001'))
          : opts.findIndex((t) => t.includes('總店') || t.includes('示範') || t.includes('預設'));
      await storeSelect.selectOption({ index: Math.max(1, idx >= 0 ? idx : 1) });
    }

    // 若尚未開班，先開班（否則建單可能被後端拒絕）
    await expect(page.getByTestId('e2e-pos-session-bar')).toBeVisible({ timeout: 15_000 });
    const openBtn = page.getByTestId('e2e-pos-session-open-btn');
    if (await openBtn.isEnabled()) {
      await openBtn.click();
      await expect(page.getByTestId('e2e-pos-open-amount')).toBeVisible({ timeout: 10_000 });
      await page.getByTestId('e2e-pos-open-submit').click();
      await expect(page.getByTestId('e2e-pos-open-amount')).toHaveCount(0, { timeout: 15_000 });
    }

    // 用條碼 fixture 加入購物車（避免商品卡點擊受 z-index 影響）
    await page.getByTestId('e2e-pos-barcode-input').fill('E2E-BC-0001');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('e2e-pos-cart-empty')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId('e2e-checkout-open')).toBeEnabled({ timeout: 15_000 });
    await page.getByTestId('e2e-checkout-open').click();
    await expect(page.getByTestId('e2e-checkout-modal')).toBeVisible();
    const checkoutRespPromise = page.waitForResponse(
      (r) => r.url().includes('/pos/orders') && r.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.getByTestId('e2e-checkout-submit').click();
    const checkoutResp = await checkoutRespPromise;
    if (checkoutResp.status() < 200 || checkoutResp.status() >= 300) {
      let detail = '';
      let code = '';
      let message = '';
      try {
        const j = (await checkoutResp.json()) as { message?: string; code?: string };
        code = String(j.code ?? '').trim();
        message = String(j.message ?? '').trim();
        detail = ` code=${code} message=${message}`.trim();
      } catch {
        // ignore
      }
      if (checkoutResp.status() === 409 && code === 'INVENTORY_INSUFFICIENT') {
        test.skip(true, `此環境缺少可售庫存 fixture：${message || 'INVENTORY_INSUFFICIENT'}（請先 db:seed/e2e:seed 或切 full profile）`);
      }
      throw new Error(`checkout POST /pos/orders status=${checkoutResp.status()}${detail ? ` (${detail})` : ''}`);
    }
    await expect(page.getByTestId('e2e-checkout-modal')).toBeHidden({ timeout: 20_000 });

    await page.getByRole('link', { name: '退換貨' }).click();
    await expect(page).toHaveURL(/\/pos\/after-sales/);
    await expect(page.getByTestId('e2e-pos-after-sales')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: '退款' }).click();
    await page.getByRole('button', { name: '查看明細' }).first().click();
    await expect(page).toHaveURL(/\/pos\/orders\//);

    await expect(page.getByTestId('e2e-detail-refund-amount')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('e2e-detail-refund-amount').fill('1');
    await page.getByTestId('e2e-detail-refund-submit').click();
    // 成功時會清空金額欄並更新明細
    await expect(page.getByTestId('e2e-detail-refund-amount')).toHaveValue('', { timeout: 12_000 });
  });
});
