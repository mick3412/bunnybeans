import { test, expect } from '@playwright/test';

test.describe('後台 Admin smoke', () => {
  test('登入 → 後台 → 庫存頁載入', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();
    await page.goto('/admin/inventory');
    await expect(page).toHaveURL(/\/admin\/inventory/);
    await expect(page.getByTestId('e2e-admin-inventory')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '庫存報表', level: 1 })).toBeVisible();
  });

  test('金流報表頁載入', async ({ page }) => {
    const full = (process.env.E2E_PROFILE ?? '').trim() === 'full';
    await page.goto('/login');
    await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();
    await page.goto('/admin/reports');
    await expect(page.getByTestId('e2e-admin-reports')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '金流報表', level: 1 })).toBeVisible();

    // referenceId 穿透（若列表有資料且存在可辨識單據）
    const refBtnAll = page.getByRole('button', { name: '訂單' });
    const refCount = await refBtnAll.count();
    if (refCount === 0) {
      if (full) {
        throw new Error('E2E_PROFILE=full 下金流報表需有固定資料集（至少 1 筆可穿透訂單的 referenceId）');
      }
      test.skip(true, '金流事件列表無可點 referenceId（需有資料/DB fixture）');
    }
    await refBtnAll.first().click();
    await expect(page).toHaveURL(/\/pos\/orders\/[0-9a-f-]{36}/);
  });
});
