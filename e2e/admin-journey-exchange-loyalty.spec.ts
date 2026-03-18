import { test, expect } from '@playwright/test';

test.describe('整合旅程：報表 → 訂單 → 換貨 → 活動成效', () => {
  test('金流報表 referenceId → 訂單 → 換貨導引 → 回到來源 → 活動成效', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();

    await page.goto('/admin/reports');
    await expect(page.getByTestId('e2e-admin-reports')).toBeVisible({ timeout: 15_000 });

    const refBtnAll = page.getByRole('button', { name: '訂單' });
    const refCount = await refBtnAll.count();
    if (refCount === 0) {
      test.skip(true, '金流事件列表無可點 referenceId（需有資料/DB fixture）');
    }

    await refBtnAll.first().click();
    await expect(page).toHaveURL(/\/pos\/orders\/[0-9a-f-]{36}\?/);
    await expect(page).toHaveURL(/returnTo=/);

    await expect(page.getByRole('button', { name: '換貨' })).toBeVisible();
    await page.getByRole('button', { name: '換貨' }).click();
    await expect(page.getByRole('heading', { name: '換貨導引（MVP）' })).toBeVisible();

    // 回到來源報表
    await page.getByRole('button', { name: '回到來源' }).click();
    await expect(page).toHaveURL(/\/admin\/reports/);

    // 旅程延伸到活動成效（僅驗證可抵達與頁殼可見）
    await page.goto('/admin/loyalty/reports');
    await expect(page.getByTestId('e2e-loyalty-report-activity')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '活動成效報表' })).toBeVisible();
  });
});

