import { test, expect } from '@playwright/test';

test.describe('Ops click-audit 視覺化（full profile）', () => {
  test('report-clicks 頁應可載入並顯示 resultCode 區塊', async ({ page }) => {
    const full = (process.env.E2E_PROFILE ?? '').trim() === 'full';

    await page.goto('/login');
    await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();
    await page.goto('/admin/ops/report-clicks');

    const root = page.getByTestId('e2e-admin-ops-report-clicks');
    await expect(root).toBeVisible({ timeout: 15_000 });

    const heading = page.getByRole('heading', { name: 'ReportClickAudit（報表穿透點擊審計）' });
    await expect(heading).toBeVisible();

    // 以上 summary 視覺化卡片是條件渲染（summary 尚未回來可能找不到固定文案）
    // 改用不依賴 summary 的元素確保頁面載入正常
    await expect(page.getByPlaceholder('例：NOT_FOUND')).toBeVisible({ timeout: 15_000 });
    const headerVisible = await page
      .getByRole('columnheader', { name: 'resultCode' })
      .isVisible()
      .catch(() => false);
    if (!headerVisible) {
      await expect(page.getByText('沒有點擊審計紀錄')).toBeVisible({ timeout: 15_000 });
    }

    // full profile 下：不應長期 skip；若後端掛掉則直接失敗
    if (full) {
      // 若頁面顯示 error alert，直接 fail（避免默默通過）
      const err = root.getByText(/Failed to fetch|NETWORK_ERROR|無法/);
      if (await err.isVisible().catch(() => false)) {
        throw new Error('full profile 下 click-audit 頁載入失敗，請確認後端/seed/ADMIN_KEY 就緒');
      }
    }
  });
});

