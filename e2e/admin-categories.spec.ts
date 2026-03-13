import { test, expect } from '@playwright/test';

/**
 * 分類頁 smoke：僅驗證列表與版面。寫入需 VITE_ADMIN_API_KEY；CI 無 KEY 時仍應通過列表載入。
 */
test.describe('後台 分類頁', () => {
  test('登入後分類頁可見', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();
    await page.goto('/admin/categories');
    await expect(page.getByTestId('e2e-admin-categories')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '分類維護' })).toBeVisible();
  });
});
