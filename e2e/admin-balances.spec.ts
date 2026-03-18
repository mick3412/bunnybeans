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
});
