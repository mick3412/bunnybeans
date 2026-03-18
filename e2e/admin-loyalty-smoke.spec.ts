import { test, expect } from '@playwright/test';

const hasAdminKey = Boolean(
  (process.env.VITE_ADMIN_API_KEY ?? process.env.ADMIN_API_KEY ?? '').trim(),
);

test.describe('Loyalty CRM smoke', () => {
  test('登入 → Loyalty 壳可見', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();
    await page.goto('/admin/loyalty');
    await expect(page.getByTestId('e2e-admin-loyalty')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: '儀表板' })).toBeVisible();
    await expect(page.getByRole('link', { name: '點數存摺' })).toBeVisible();
  });

  test('設定頁區塊可見（有 Key 時完整載入）', async ({ page }) => {
    test.skip(!hasAdminKey, '未設 VITE_ADMIN_API_KEY／ADMIN_API_KEY 時 skip（設定頁需後端 Loyalty API）');
    await page.goto('/login');
    await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();
    await page.goto('/admin/loyalty/settings');
    await expect(page.getByTestId('e2e-loyalty-settings')).toBeVisible({ timeout: 15_000 });
  });
});
