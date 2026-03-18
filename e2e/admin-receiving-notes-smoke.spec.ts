import { test, expect } from '@playwright/test';

async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();
  await expect(page).toHaveURL(/\/admin(\/|$)/, { timeout: 15_000 });
}

test.describe('Admin 進貨驗收 smoke', () => {
  test('載入清單並執行退回供應商，驗證 toast 與後端 inventory 事件', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/receiving-notes');

    const root = page.getByTestId('e2e-admin-receiving-notes');
    await expect(root).toBeVisible({ timeout: 15_000 });

    const searchInput = root.getByPlaceholder('搜尋驗收單號 / 採購單號 / 供應商...');
    await searchInput.fill('E2E-RN-0001');

    const rnRow = root.locator('tbody tr', { hasText: 'E2E-RN-0001' }).first();
    await expect(rnRow).toBeVisible({ timeout: 15_000 });
    await rnRow.click();

    // 「退回供應商」在 UI 同時出現在標題與按鈕文字，這裡用 div 標題避免 strict mode
    const returnTitle = page.locator('div').filter({ hasText: /^退回供應商$/ }).first();
    await expect(returnTitle).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '送出退回供應商' })).toBeVisible({ timeout: 15_000 });

    const returnCard = returnTitle.locator('xpath=ancestor::div[contains(@class,"bg-amber-50")][1]');

    // 填入欲退數量/原因（取第一列）
    const qtyInput = returnCard.locator('input[type="number"]').first();
    await expect(qtyInput).toBeVisible({ timeout: 10_000 });
    await qtyInput.fill('1');

    const reasonInput = returnCard.locator('input[placeholder^="原因"]').first();
    await expect(reasonInput).toBeVisible({ timeout: 10_000 });
    await reasonInput.fill('E2E test');

    await returnCard.getByRole('button', { name: '送出退回供應商' }).click();

    await expect(page.getByText('已送出退回供應商')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('本次送出明細')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('E2E test')).toBeVisible({ timeout: 10_000 });

    // 驗證後端：寫入 InventoryEvent（RETURN_TO_SUPPLIER），並包含此 RN receiptNumber
    const apiBase = process.env.VITE_API_BASE_URL ?? 'http://localhost:3003';
    const adminKey = (process.env.ADMIN_API_KEY ?? process.env.VITE_ADMIN_API_KEY ?? '').trim();
    const fromIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const headers: Record<string, string> = {};
    if (adminKey) {
      headers['x-admin-key'] = adminKey;
      headers['x-api-key'] = adminKey;
    }

    const resp = await page.request.get(
      `${apiBase}/inventory/events?type=RETURN_TO_SUPPLIER&from=${encodeURIComponent(fromIso)}`,
      { headers: Object.keys(headers).length ? headers : undefined },
    );
    expect(resp.status()).toBe(200);
    const json = (await resp.json()) as { items?: Array<{ note?: string | null; type?: string }> };
    const items = Array.isArray(json.items) ? json.items : [];

    expect(
      items.some((x) => (x.note ?? '').includes('E2E-RN-0001') && x.type === 'RETURN_TO_SUPPLIER'),
    ).toBeTruthy();
  });
});

