import { test, expect } from '@playwright/test';

test.describe('換貨 Phase2：差額/對帳旅程', () => {
  test('原單 → 換貨單 → 顯示差額與狀態（可 skip）', async ({ page }) => {
    const full = (process.env.E2E_PROFILE ?? '').trim() === 'full';
    if (!full) {
      test.skip(true, '換貨 fixture 僅於 E2E_PROFILE=full 建立（exchange/settlement）；一般 e2e:seed 無此資料');
    }
    // backend/scripts/e2e-seed.ts：Exchange source order id
    const EX_SOURCE_ORDER_REF_ID = 'e2e00005-0000-4000-8000-00000000d001';
    await page.goto('/login');
    await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();

    await page.goto('/admin/reports');
    await expect(page.getByTestId('e2e-admin-reports')).toBeVisible({ timeout: 15_000 });

    // 從報表穿透到任一訂單（若無資料則 skip）
    const refBtnAll = page.getByRole('button', { name: '訂單' });
    try {
      await expect(refBtnAll.first()).toBeVisible({ timeout: 15_000 });
    } catch {
      if (full) throw new Error('full profile 下需有金流事件/訂單 fixture 才能驗收換貨旅程');
      test.skip(true, '金流事件列表無可點 referenceId（需有資料/DB fixture）');
    }

    const exchangeRefBtn = page.locator(`button[title="${EX_SOURCE_ORDER_REF_ID}"]`).first();
    await expect(exchangeRefBtn).toBeVisible({ timeout: 15_000 });
    await exchangeRefBtn.click();
    await expect(page).toHaveURL(/\/pos\/orders\/[0-9a-f-]{36}/);

    // 舊版 UI 會有「換貨關聯」卡；新版 UI 會在「退換貨操作/退換貨歷程」顯示差額事件
    const exchangeCardTitle = page.getByText('換貨關聯', { exact: true });
    if ((await exchangeCardTitle.count()) > 0) {
      await expect(exchangeCardTitle).toBeVisible({ timeout: 15_000 });

      const derivedSection = page.getByText('衍生（換貨單）', { exact: true });
      await expect(derivedSection).toBeVisible({ timeout: 15_000 });
      const derivedViewButtons = derivedSection.locator('..').getByRole('button', { name: '查看' });
      const derivedBtnCount = await derivedViewButtons.count();
      if (derivedBtnCount === 0) {
        if (full) throw new Error('full profile 下需能穿透到衍生換貨單');
        test.skip(true, '此環境未提供可點擊的衍生換貨單（查看按鈕不存在），無法驗收旅程');
      }

      await derivedViewButtons.first().click();
      await expect(page).toHaveURL(/\/pos\/orders\/[0-9a-f-]{36}\?/);
      await expect(page).toHaveURL(/returnTo=/);

      const deltaBadge = page.getByText(/差額 \$0|需補款 \$|需退款 \$/);
      await expect(deltaBadge).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/退款狀態：/)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/補款狀態：/)).toBeVisible({ timeout: 15_000 });
    } else {
      // 新版：以「退換貨歷程」中的 exchange refund 差額事件作為驗收訊號
      const panelTitle = page.getByText('退換貨操作', { exact: true });
      await expect(panelTitle).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('退換貨歷程', { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/E2E exchange refund \(delta\)/)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/\$50/)).toBeVisible({ timeout: 15_000 });
    }
  });
});
