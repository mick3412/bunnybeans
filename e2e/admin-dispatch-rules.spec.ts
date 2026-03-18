import { test, expect } from '@playwright/test';

/**
 * 發券規則頁 smoke：載入、列表或空態。
 */
async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();
  await expect(page).toHaveURL(/\/admin(\/|$)/, { timeout: 15_000 });
}

test.describe('後台 發券規則頁', () => {
  test('載入與列表或空態', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/dispatch-rules');
    await expect(page).toHaveURL(/\/admin\/dispatch-rules/);
    const container = page.getByTestId('e2e-admin-dispatch-rules');
    await expect(container).toBeVisible({ timeout: 15_000 });
    // 有規則時為表格列、無規則時為「尚無發券規則，請新增」
    await expect(
      container.locator('table tbody tr').or(container.getByText('尚無發券規則，請新增')),
    ).toBeVisible({ timeout: 10_000 });
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
    expect(resp.status).toBe(200);

    // refresh list
    await page.goto('/admin/dispatch-rules');

    const root2 = page.getByTestId('e2e-admin-dispatch-rules');
    const targetRow2 = root2.locator('table tbody tr', { hasText: RULE_ENABLED_NAME }).first();
    await expect(targetRow2).toBeVisible({ timeout: 15_000 });

    const lastRunAtText = (await targetRow2.locator('span.tabular-nums').first().textContent()) ?? '';
    expect(lastRunAtText.trim()).not.toBe('—');

    const lastRunCodeText = ((await targetRow2.locator('span.font-mono').first().textContent()) ?? '').trim();
    expect(['SENT', 'SKIPPED', 'FAILED']).toContain(lastRunCodeText);

    // lastRunNote should be present (UI hides it when null)
    const noteSpan = targetRow2.locator('span[title]').first();
    await expect(noteSpan).toBeVisible({ timeout: 10_000 });
    const noteText = (await noteSpan.textContent()) ?? '';
    expect(noteText).toMatch(/jobId=|duplicate-protection|CRM_JOB/i);

    // ops run log should show crm-run-scheduled
    await page.goto('/admin/ops/jobs?kind=crm-run-scheduled');
    const opsRoot = page.getByTestId('e2e-admin-ops-jobs');
    await expect(opsRoot).toBeVisible({ timeout: 15_000 });
    const jobRow = opsRoot.locator('table tbody tr', { hasText: 'crm-run-scheduled' }).first();
    await expect(jobRow).toBeVisible({ timeout: 15_000 });

    const opsLastRunAt = (await jobRow.locator('td').nth(1).textContent()) ?? '';
    expect(opsLastRunAt.trim()).not.toBe('—');

    const opsMsg = (await jobRow.locator('td').nth(3).textContent()) ?? '';
    const opsMsgTitle = (await jobRow.locator('td').nth(3).getAttribute('title')) ?? '';
    expect(opsMsg).toContain('jobId=');
    if (opsMsgTitle) {
      expect(opsMsgTitle).toContain(RULE_ENABLED_NAME);
    } else {
      expect(opsMsg).toContain(RULE_ENABLED_NAME);
    }
  });
});
