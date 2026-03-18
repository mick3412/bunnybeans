import { test, expect } from '@playwright/test';

const hasAdminKey = Boolean(
  (process.env.VITE_ADMIN_API_KEY ?? process.env.ADMIN_API_KEY ?? '').trim(),
);

/**
 * 補貨建議頁 smoke：載入、倉庫選單、建議列表或空態。
 */
async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();
  await expect(page).toHaveURL(/\/admin(?:\/|\?|$)/, { timeout: 15_000 });
}

test.describe('後台 補貨建議頁', () => {
  test('載入與倉庫選單可見', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/replenishment');
    await expect(page).toHaveURL(/\/admin\/replenishment/);
    const container = page.getByTestId('e2e-admin-replenishment');
    await expect(container).toBeVisible({ timeout: 15_000 });
    await expect(container.getByRole('heading', { name: '補貨建議' })).toBeVisible();
    // 倉庫選單
    await expect(container.locator('select').first()).toBeVisible();
  });

  test('建議列表或空態區塊存在', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/replenishment');
    const container = page.getByTestId('e2e-admin-replenishment');
    await expect(container).toBeVisible({ timeout: 15_000 });
    // 有建議時為表格、無建議時為「目前沒有需要補貨的商品。」
    await expect(
      container.locator('table').or(container.getByText('目前沒有需要補貨的商品。')),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('建立採購草稿流程（需 VITE_ADMIN_API_KEY，且有補貨建議時）', async ({ page }) => {
    test.skip(!hasAdminKey, '需 VITE_ADMIN_API_KEY');
    await loginAdmin(page);
    await page.goto('/admin/replenishment');
    const container = page.getByTestId('e2e-admin-replenishment');
    await expect(container).toBeVisible({ timeout: 15_000 });
    const firstRowCheckbox = container.locator('tbody input[type="checkbox"]').first();
    const hasRows = await firstRowCheckbox.isVisible().catch(() => false);
    test.skip(!hasRows, '無補貨建議資料，跳過端對端流程');
    await firstRowCheckbox.check();
    const supplierSelect = container.locator('select').nth(1); // 第二個為供應商
    await supplierSelect.selectOption({ index: 1 });
    await container.getByRole('button', { name: '建立採購草稿' }).click();
    await Promise.race([
      page.waitForURL(/\/admin\/purchase-orders/, { timeout: 10_000 }),
      page.getByText('建立採購草稿 API 即將上線').waitFor({ state: 'visible', timeout: 10_000 }),
    ]);
  });
});
