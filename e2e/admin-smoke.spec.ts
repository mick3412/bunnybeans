import { test, expect } from '@playwright/test';

test.describe('後台 Admin smoke', () => {
  test('登入 → 後台 → 庫存頁載入', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();
    await expect(page).toHaveURL(/\/admin\/inventory/);
    await expect(page.getByTestId('e2e-admin-inventory')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '庫存餘額與異動' })).toBeVisible();
  });
});
