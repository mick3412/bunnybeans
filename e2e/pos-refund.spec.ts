import { test, expect } from '@playwright/test';

async function checkoutOneOrder(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByTestId('e2e-login-submit').click();
  await expect(page).toHaveURL(/\/pos$/);

  const storeSelect = page.getByTestId('e2e-pos-store-select');
  await expect(storeSelect).toBeVisible({ timeout: 15_000 });
  const storeValue = await storeSelect.inputValue();
  if (!storeValue) {
    await storeSelect.selectOption({ index: 1 });
  }

  await expect(page.getByTestId('e2e-pos-session-bar')).toBeVisible({ timeout: 15_000 });
  const openBtn = page.getByTestId('e2e-pos-session-open-btn');
  if (await openBtn.isEnabled()) {
    await openBtn.click();
    await expect(page.getByTestId('e2e-pos-open-amount')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('e2e-pos-open-submit').click();
    await expect(page.getByTestId('e2e-pos-open-amount')).toHaveCount(0, { timeout: 15_000 });
  }

  await page.getByTestId('e2e-pos-barcode-input').fill('E2E-BC-0001');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('e2e-pos-cart-empty')).toHaveCount(0, { timeout: 15_000 });
  await page.getByTestId('e2e-checkout-open').click();
  await expect(page.getByTestId('e2e-checkout-modal')).toBeVisible();

  const checkoutRespPromise = page.waitForResponse(
    (r) => r.url().includes('/pos/orders') && r.request().method() === 'POST',
    { timeout: 20_000 },
  );
  await page.getByTestId('e2e-checkout-submit').click();
  const checkoutResp = await checkoutRespPromise;
  if (checkoutResp.status() < 200 || checkoutResp.status() >= 300) {
    let code = '';
    let message = '';
    try {
      const j = (await checkoutResp.json()) as { message?: string; code?: string };
      code = String(j.code ?? '').trim();
      message = String(j.message ?? '').trim();
    } catch {
      // ignore
    }
    if (checkoutResp.status() === 409 && code === 'INVENTORY_INSUFFICIENT') {
      test.skip(true, `此環境缺少可售庫存 fixture：${message || 'INVENTORY_INSUFFICIENT'}（請先 db:seed/e2e:seed 或切 full profile）`);
    }
    throw new Error(`checkout POST /pos/orders status=${checkoutResp.status()}`);
  }
  await expect(page.getByTestId('e2e-checkout-modal')).toBeHidden({ timeout: 20_000 });
}

test.describe('POS 退款', () => {
  test('全額結帳 → 訂單明細 → 部分退貨完成', async ({ page }) => {
    await checkoutOneOrder(page);

    await page.getByText('最新訂單').locator('..').getByRole('link').click();
    await expect(page).toHaveURL(/\/pos\/orders\//);
    await expect(page.getByText('退換貨操作')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: '部分退貨' }).click();
    await expect(page.getByText('勾選退貨品項')).toBeVisible({ timeout: 10_000 });
    await page.locator('input[type="checkbox"]').first().check();
    await page.locator('input[placeholder="退"]').first().fill('1');
    await page.getByRole('button', { name: '試算退款' }).click();
    await expect(page.getByText('退款試算')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '確認退貨' }).click();
    await expect(page.getByText('退貨完成')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('退貨單')).toBeVisible({ timeout: 15_000 });
  });
});
