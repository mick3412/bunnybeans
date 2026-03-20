import { test, expect } from '@playwright/test';

test.describe('條碼最小驗收', () => {
  test('POS 條碼 Enter 加入（或多筆命中可選）', async ({ page }) => {
    const defaultBarcode = 'E2E-BC-0001';
    const full = (process.env.E2E_PROFILE ?? '').trim() === 'full';
    const requireFixtures = full || (process.env.E2E_REQUIRE_DB_FIXTURES ?? '').trim() === '1';
    const barcode = defaultBarcode;

    await page.goto('/login');
    await page.getByTestId('e2e-login-submit').click();
    await expect(page).toHaveURL(/\/pos$/, { timeout: 15_000 });
    await page.waitForURL(/\/pos$/);

    const input = page.getByTestId('e2e-pos-barcode-input');
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.fill(barcode);
    await input.press('Enter');

    const hint = page.getByTestId('e2e-pos-barcode-hint');
    await expect(hint).toBeVisible({ timeout: 15_000 });

    const hintText = await hint.textContent();
    if (hintText?.toLowerCase().includes('failed to fetch') || hintText?.includes('查詢失敗')) {
      test.skip(
        true,
        [
          '後端/API 無法連線，無法驗證條碼端到端：',
          '- 確認後端已啟動（預設 http://127.0.0.1:3003）或設定 VITE_API_BASE_URL',
          '- 並先跑：pnpm db:seed（會清空業務表）→ pnpm --filter pos-erp-backend e2e:seed',
          '- DATABASE_URL 需可連線且允許 seed 寫入',
        ].join('\n'),
      );
    }
    if (hintText?.includes('找不到')) {
      const msg = [
        '此環境無對應 barcode fixture，請先補齊 DB fixture 後再跑本 spec：',
        '- 先跑：pnpm db:seed（會清空業務表）',
        '- 再跑：pnpm --filter pos-erp-backend e2e:seed',
        `- 預設條碼：${defaultBarcode}`,
        '- 需提供可連線的 DATABASE_URL，並確保後端可用（VITE_API_BASE_URL 指向後端）',
      ].join('\n');
      if (requireFixtures) {
        throw new Error(msg);
      }
      test.skip(true, msg);
    }

    const choices = page.getByTestId('e2e-pos-barcode-choices');
    if (await choices.isVisible().catch(() => false)) {
      await choices.getByRole('button').first().click();
      await expect(hint).toContainText('已加入購物車');
    } else {
      await expect(hint).toContainText('已加入購物車');
    }
  });
});

