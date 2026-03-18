import { test, expect } from '@playwright/test';

/**
 * 發券規則頁 smoke：載入、列表或空態。
 */
async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();
  await expect(page).toHaveURL(/\/admin(?:\/|\?|$)/, { timeout: 15_000 });
}

test.describe('後台 發券規則頁', () => {
  test('載入與列表或空態', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/dispatch-rules');
    await expect(page).toHaveURL(/\/admin\/dispatch-rules/);
    const container = page.getByTestId('e2e-admin-dispatch-rules');
    await expect(container).toBeVisible({ timeout: 15_000 });
    // 有規則時為表格列、無規則時為「尚無發券規則，請新增」
    const rowCount = await container.locator('table tbody tr').count();
    if (rowCount > 0) {
      await expect(container.locator('table tbody tr').first()).toBeVisible({ timeout: 10_000 });
    } else {
      await expect(container.getByText('尚無發券規則，請新增')).toBeVisible({ timeout: 10_000 });
    }
  });

  test('full profile：dispatch-rules runner 更新 lastRun 並對應 ops run log', async ({ page }) => {
    const full = (process.env.E2E_PROFILE ?? '').trim() === 'full';
    if (!full) test.skip(true, '非 full profile，跳過 dispatch-rules runner 驗收');

    const apiBase = process.env.VITE_API_BASE_URL ?? 'http://localhost:3003';
    const adminKey = (process.env.ADMIN_API_KEY ?? process.env.VITE_ADMIN_API_KEY ?? '').trim();

    const RULE_ENABLED_NAME = 'E2E-RULE-ENABLED-0001';

    await loginAdmin(page);
    await page.goto('/admin/dispatch-rules');

    const root = page.getByTestId('e2e-admin-dispatch-rules');
    await expect(root).toBeVisible({ timeout: 15_000 });

    const targetRow = root.locator('table tbody tr', { hasText: RULE_ENABLED_NAME }).first();
    await expect(targetRow).toBeVisible({ timeout: 15_000 });

    // trigger runner (cron-like) via ops job run
    const resp = await fetch(`${apiBase}/ops/jobs/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminKey ? { 'x-admin-key': adminKey } : {}),
      },
      body: JSON.stringify({ kind: 'crm-run-scheduled' }),
    });
    // Ops jobs runner may return 200/201 depending on implementation.
    expect([200, 201]).toContain(resp.status);

    // refresh list
    await page.goto('/admin/dispatch-rules');

    const root2 = page.getByTestId('e2e-admin-dispatch-rules');
    const targetRow2 = root2.locator('table tbody tr', { hasText: RULE_ENABLED_NAME }).first();
    await expect(targetRow2).toBeVisible({ timeout: 15_000 });

    // lastRunAt/lastRunCode/lastRunNote: full gate 不允許長期是 null/空字串
    // （E2E 為了避免 UI DOM 差異，直接驗證 API 狀態）
    let merchantId: string | null = null;
    const merchantResp = await page.request.get(`${apiBase}/merchant/current`);
    if (merchantResp.status() === 200) {
      const merchantCurrent = (await merchantResp.json()) as { id?: string };
      merchantId = merchantCurrent.id ?? null;
    }
    if (!merchantId) {
      // useDefaultMerchantId fallback: 失敗則 fallback listMerchants()[0].id
      const merchantsResp = await page.request.get(`${apiBase}/merchants`);
      expect(merchantsResp.status()).toBe(200);
      const merchants = (await merchantsResp.json()) as Array<{ id: string }>;
      merchantId = merchants[0]?.id ?? null;
    }
    expect(merchantId).toBeTruthy();

    const rulesResp = await page.request.get(
      `${apiBase}/crm/dispatch-rules?merchantId=${encodeURIComponent(merchantId!)}`,
    );
    expect(rulesResp.status()).toBe(200);
    const rules = (await rulesResp.json()) as Array<{
      name: string;
      lastRunAt?: string | null;
      lastRunCode?: string | null;
      lastRunNote?: string | null;
    }>;

    const enabledRule = rules.find((r) => r.name === RULE_ENABLED_NAME);
    expect(enabledRule).toBeTruthy();
    expect(enabledRule!.lastRunAt).toBeTruthy();
    expect(enabledRule!.lastRunCode).toBeTruthy();
    expect(enabledRule!.lastRunNote).toBeTruthy();
    expect(enabledRule!.lastRunNote!).toMatch(/jobId=|duplicate-protection|CRM_JOB/i);

    // 點 run log 導向 /admin/ops/jobs?kind=crm-run-scheduled
    const runLogBtn = page.locator('button', { hasText: '查看 run log' }).first();
    await expect(runLogBtn).toBeVisible({ timeout: 15_000 });
    await runLogBtn.click();
    await expect(page).toHaveURL(/\/admin\/ops\/jobs\?kind=crm-run-scheduled/);

    const opsRoot = page.getByTestId('e2e-admin-ops-jobs');
    await expect(opsRoot).toBeVisible({ timeout: 15_000 });

    // 找到訊息含 jobId= 的那一筆（避免同 kind 多筆且某些 message 可能是 null）
    const msgCell = opsRoot.locator('[data-testid="e2e-admin-ops-jobs-message"]', { hasText: 'jobId=' }).first();
    await expect(msgCell).toBeVisible({ timeout: 15_000 });
    await expect(msgCell).toContainText('jobId=');

    const msgTitle = (await msgCell.getAttribute('title')) ?? '';
    if (msgTitle) {
      expect(msgTitle).toContain(RULE_ENABLED_NAME);
    } else {
      await expect(msgCell).toContainText(RULE_ENABLED_NAME);
    }

    const jobRow = msgCell.locator('xpath=ancestor::tr[1]').first();
    const opsLastRunAtEl = jobRow.locator('[data-testid="e2e-admin-ops-jobs-lastRunAt"]').first();
    const opsLastRunAtText = (await opsLastRunAtEl.textContent()) ?? '';
    expect(opsLastRunAtText.trim()).not.toBe('—');
  });
});
