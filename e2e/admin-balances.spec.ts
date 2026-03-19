import { test, expect } from '@playwright/test';

/**
 * 應收應付餘額頁 smoke：載入、多方視角切換可見。
 */
async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();
  await expect(page).toHaveURL(/\/admin(?:\/|\?|$)/, { timeout: 15_000 });
}

test.describe('後台 應收應付餘額頁', () => {
  test('載入與多方視角切換可見', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/balances');
    await expect(page).toHaveURL(/\/admin\/balances/);
    const container = page.getByTestId('e2e-admin-finance-balances');
    await expect(container).toBeVisible({ timeout: 15_000 });
    // 多方視角：全部／會員／供應商／其他
    await expect(
      container.getByText(/全部|會員|供應商|其他/).first(),
    ).toBeVisible();
  });

  test('金流報表依對象彙總 drill-down 可導向餘額頁', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/reports');
    const reportsRoot = page.getByTestId('e2e-admin-reports');
    await expect(reportsRoot).toBeVisible({ timeout: 15_000 });

    const drillLink = reportsRoot.getByTestId('e2e-reports-party-drilldown').first();
    if (!(await drillLink.isVisible().catch(() => false))) {
      test.skip(true, '金流報表依對象彙總無資料，需有 party 事件');
      return;
    }
    await drillLink.click();
    await expect(page).toHaveURL(/\/admin\/balances/);
    expect(page.url()).toContain('partyId=');
  });
});
