import { test, expect } from '@playwright/test';

test.describe('整合旅程：報表 → 訂單 → 換貨 → 活動成效', () => {
  test('金流報表 referenceId → 訂單 → 換貨導引 → 回到來源 → 活動成效', async ({ page }) => {
    const full = (process.env.E2E_PROFILE ?? '').trim() === 'full';
    await page.goto('/login');
    await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();

    await page.goto('/admin/reports');
    await expect(page.getByTestId('e2e-admin-reports')).toBeVisible({ timeout: 15_000 });

    const refBtnAll = page.getByRole('button', { name: '訂單' });
    if (!full) {
      const refCount = await refBtnAll.count();
      if (refCount === 0) {
        test.skip(true, '金流事件列表無可點 referenceId（需有資料/DB fixture）');
      }
    }

    // full profile：不以 referenceId 按鈕數量=0 skip，改成等待穿透解析完成
    await expect(refBtnAll.first()).toBeVisible({ timeout: 30_000 });
    await refBtnAll.first().click();
    await expect(page).toHaveURL(/\/pos\/orders\/[0-9a-f-]{36}\?/);
    await expect(page).toHaveURL(/returnTo=/);

    await expect(page.getByRole('button', { name: '換貨' })).toBeVisible();
    await page.getByRole('button', { name: '換貨' }).click();
    await expect(page.getByRole('heading', { name: '換貨（MVP）' })).toBeVisible();

    // 關閉遮罩彈窗，避免擋住「回到來源」按鈕點擊
    await page.getByRole('button', { name: '關閉' }).click();
    await expect(page.getByRole('heading', { name: '換貨（MVP）' })).toBeHidden({ timeout: 10_000 });

    // 回到來源報表
    await page.getByRole('button', { name: '回到來源' }).click();
    await expect(page).toHaveURL(/\/admin\/reports/);
    await expect(page.getByTestId('e2e-admin-reports')).toBeVisible({ timeout: 15_000 });

    // 旅程延伸到活動成效（僅驗證可抵達與頁殼可見）
    await page.goto('/admin/loyalty/reports');
    await expect(page.getByTestId('e2e-loyalty-report-activity')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '活動成效報表' })).toBeVisible();
  });
});

