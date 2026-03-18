import { test, expect } from '@playwright/test';

/**
 * 發券規則頁 smoke：載入、列表或空態。
 */
async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();
  await expect(page).toHaveURL(/\/admin(\/|$)/, { timeout: 15_000 });
}

test.describe('後台 發券規則頁', () => {
  test('載入與列表或空態', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/dispatch-rules');
    await expect(page).toHaveURL(/\/admin\/dispatch-rules/);
    const container = page.getByTestId('e2e-admin-dispatch-rules');
    await expect(container).toBeVisible({ timeout: 15_000 });
    // 有規則時為表格列、無規則時為「尚無發券規則，請新增」
    await expect(
      container.locator('table tbody tr').or(container.getByText('尚無發券規則，請新增')),
    ).toBeVisible({ timeout: 10_000 });
  });
});
