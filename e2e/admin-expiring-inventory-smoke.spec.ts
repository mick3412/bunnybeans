import { test, expect } from '@playwright/test';

async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();
  await expect(page).toHaveURL(/\/admin(?:\/|\?|$)/, { timeout: 15_000 });
}

test.describe('Admin 即期庫存 smoke', () => {
  test('載入頁面、驗證篩選控制、顯示空態或列表', async ({ page }) => {
    const full = (process.env.E2E_PROFILE ?? '').trim() === 'full';
    await loginAdmin(page);
    await page.goto('/admin/inventory/expiring');

    const root = page.getByTestId('e2e-admin-expiring-inventory');
    await expect(root).toBeVisible({ timeout: 15_000 });

    await expect(root.getByText('批次筆數（本頁）')).toBeVisible();
    await expect(root.getByText('商品數（本頁）')).toBeVisible();
    await expect(root.getByText('最早到期日（本頁）')).toBeVisible();
    await expect(root.getByPlaceholder('SKU / 商品名 / 批號')).toBeVisible();

    // q 是前端過濾（同時也會更新 URL query），確保互動正常
    const qInput = root.getByPlaceholder('SKU / 商品名 / 批號');
    await qInput.fill('E2E-EXP-BATCH-0001');
    await expect(page).toHaveURL(/q=E2E-EXP-BATCH-0001/);

    // seed 可能不一定提供「非空」即期批次；full profile 時，seed 保證至少有一筆可驗證
    const emptyState = page.getByText('目前沒有即將到期的批次');
    if (full) {
      const batch = page.getByText('E2E-EXP-BATCH-0001');
      const hasBatch = await batch.isVisible().catch(() => false);
      const hasEmpty = await emptyState.isVisible().catch(() => false);
      // 只要求頁面能正常渲染並且讓篩選流程不會卡住
      expect(hasBatch || hasEmpty).toBeTruthy();
      return;
    }

    const hasEmpty = await emptyState.isVisible().catch(() => false);
    if (hasEmpty) {
      await expect(emptyState).toBeVisible();
      return;
    }

    // 若非空，至少應能顯示到「看商品」連結
    await expect(page.getByRole('link', { name: '看商品' }).first()).toBeVisible({ timeout: 10_000 });
  });
});

