import { test, expect } from '@playwright/test';

/**
 * 分類頁 smoke：僅驗證列表與版面。標籤 CRUD 需 VITE_ADMIN_API_KEY；CI 無 KEY 時該則 skip。
 */
const hasAdminKey = Boolean(
  (process.env.VITE_ADMIN_API_KEY ?? process.env.ADMIN_API_KEY ?? '').trim(),
);

async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();
  await expect(page).toHaveURL(/\/admin(?:\/|\?|$)/, { timeout: 15_000 });
}

test.describe('後台 分類頁', () => {
  test('登入後分類頁可見', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/categories');
    await expect(page.getByTestId('e2e-admin-categories')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '類別管理' })).toBeVisible();
  });

  test('標籤區可見', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/categories');
    const tagsSection = page.getByTestId('e2e-admin-categories-tags');
    await expect(tagsSection).toBeVisible({ timeout: 15_000 });
    await expect(tagsSection.getByRole('heading', { name: '標籤' })).toBeVisible();
  });

  test('標籤新增（需 VITE_ADMIN_API_KEY）', async ({ page }) => {
    test.skip(!hasAdminKey, '未設 VITE_ADMIN_API_KEY／ADMIN_API_KEY 時 skip');
    await loginAdmin(page);
    await page.goto('/admin/categories');
    const tagsSection = page.getByTestId('e2e-admin-categories-tags');
    await expect(tagsSection).toBeVisible({ timeout: 15_000 });
    const tagName = `E2E-TAG-${Date.now()}`;
    await tagsSection.getByPlaceholder('新增標籤名稱').fill(tagName);
    await tagsSection.getByRole('button', { name: '新增' }).click();
    await expect(tagsSection.getByText(tagName)).toBeVisible({ timeout: 5_000 });
  });
});
