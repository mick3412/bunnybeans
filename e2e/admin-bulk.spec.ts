import { test, expect } from '@playwright/test';

/**
 * 批量匯入／匯出 smoke（§1 FRONTEND-INSTRUCTIONS）
 * CI 須設 secrets.ADMIN_API_KEY = 與 VITE_ADMIN_API_KEY 相同；無 Key 時匯出相關測試 skip。
 */
const hasAdminKey = Boolean(
  (process.env.VITE_ADMIN_API_KEY ?? process.env.ADMIN_API_KEY ?? '').trim(),
);

async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();
  // Login 導向 /admin（dashboard），未必含第二段 path
  await expect(page).toHaveURL(/\/admin(\/|$)/, { timeout: 15_000 });
}

test.describe('後台批量 UI smoke', () => {
  test('商品頁匯入區塊存在（e2e-admin-products-import）', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/products');
    await expect(page.getByTestId('e2e-admin-products-import')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('庫存頁匯出餘額請求 200（需 VITE_ADMIN_API_KEY）', async ({ page }) => {
    test.skip(!hasAdminKey, '未設 VITE_ADMIN_API_KEY／ADMIN_API_KEY 時 skip（CI 請設 secrets.ADMIN_API_KEY）');
    await loginAdmin(page);
    await page.goto('/admin/inventory');
    await expect(page.getByTestId('e2e-admin-inventory')).toBeVisible({ timeout: 15_000 });
    const exportBtn = page.getByTestId('e2e-admin-inventory-export');
    await expect(exportBtn).toBeVisible();
    const respPromise = page.waitForResponse(
      (r) =>
        r.url().includes('/inventory/balances/export') &&
        r.request().method() === 'GET' &&
        r.ok(),
      { timeout: 20_000 },
    );
    await exportBtn.click();
    await respPromise;
  });

  test('庫存頁盤點上傳區塊存在（e2e-admin-inventory-import）', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/inventory');
    await expect(page.getByTestId('e2e-admin-inventory-import')).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe('POS 訂單匯出按鈕', () => {
  test('訂單列表匯出按鈕存在（e2e-pos-orders-export）', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('e2e-login-submit').click();
    await expect(page).toHaveURL(/\/pos/);
    await page.getByTestId('e2e-nav-orders').click();
    await expect(page).toHaveURL(/\/pos\/orders/);
    await expect(page.getByTestId('e2e-pos-orders-export')).toBeVisible({
      timeout: 15_000,
    });
  });
});
