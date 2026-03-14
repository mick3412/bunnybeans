import { test, expect } from '@playwright/test';

/**
 * 客戶 CSV preview／apply 頁（FRONTEND-INSTRUCTIONS）
 * - 頁可進入：不需 Key。
 * - POST preview 200：需 VITE_ADMIN_API_KEY／ADMIN_API_KEY（與 CI secrets.ADMIN_API_KEY 一致）；無則 skip。
 */
const hasAdminKey = Boolean(
  (process.env.VITE_ADMIN_API_KEY ?? process.env.ADMIN_API_KEY ?? '').trim(),
);

async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();
  await expect(page).toHaveURL(/\/admin(\/|$)/, { timeout: 15_000 });
}

test.describe('後台 客戶 CSV 匯入頁', () => {
  test('可進入 /admin/customers/import（e2e-admin-customers-import）', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/customers/import');
    await expect(page.getByTestId('e2e-admin-customers-import')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '客戶 CSV 匯入' })).toBeVisible();
  });

  test('預覽 POST /customers/import/preview 200（需 ADMIN_KEY）', async ({ page }) => {
    test.skip(
      !hasAdminKey,
      '未設 VITE_ADMIN_API_KEY／ADMIN_API_KEY 時 skip（CI 請設 secrets.ADMIN_API_KEY）',
    );
    await loginAdmin(page);
    await page.goto('/admin/customers/import');
    await expect(page.getByTestId('e2e-admin-customers-import')).toBeVisible({ timeout: 15_000 });
    const fileInput = page.getByTestId('e2e-admin-customers-import-preview').locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'e2e-customers.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('name,phone\nE2ECustomer,0900000001\n'),
    });
    const respPromise = page.waitForResponse(
      (r) =>
        r.url().includes('/customers/import/preview') &&
        r.request().method() === 'POST' &&
        r.ok(),
      { timeout: 20_000 },
    );
    await page.getByRole('button', { name: '預覽' }).click();
    await respPromise;
    await expect(page.getByText(/預覽|套用寫入|fileHash/)).toBeVisible({ timeout: 5_000 });
  });
});
