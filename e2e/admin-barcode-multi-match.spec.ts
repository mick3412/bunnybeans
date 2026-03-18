import { test, expect } from '@playwright/test';

test.describe('條碼多筆命中 UX', () => {
  test('POS 條碼多筆命中需選擇（可 skip）', async ({ page }) => {
    const barcode = 'E2E-BC-MULTI';
    const full = (process.env.E2E_PROFILE ?? '').trim() === 'full';
    const requireFixtures = full || (process.env.E2E_REQUIRE_DB_FIXTURES ?? '').trim() === '1';

    await page.goto('/login');
    await page.getByTestId('e2e-login-submit').click();
    await expect(page).toHaveURL(/\/pos/);

    const input = page.getByTestId('e2e-pos-barcode-input');
    await expect(input).toBeVisible();
    await input.fill(barcode);
    await input.press('Enter');

    const hint = page.getByTestId('e2e-pos-barcode-hint');
    await expect(hint).toBeVisible({ timeout: 15_000 });
    const hintText = (await hint.textContent()) ?? '';

    if (hintText.toLowerCase().includes('failed to fetch') || hintText.includes('查詢失敗')) {
      test.skip(
        true,
        [
          '後端/API 無法連線，無法驗證條碼多筆命中：',
          '- 確認後端已啟動（預設 http://127.0.0.1:3003）或設定 VITE_API_BASE_URL',
          '- 並先跑：pnpm db:seed（會清空業務表）→ pnpm --filter pos-erp-backend e2e:seed',
          '- DATABASE_URL 需可連線且允許 seed 寫入',
        ].join('\n'),
      );
    }

    const choices = page.getByTestId('e2e-pos-barcode-choices');
    const hasChoices = await choices.isVisible().catch(() => false);
    if (!hasChoices) {
      const msg = [
        '此環境尚未提供「條碼多筆命中」fixture，請補齊後再跑本 spec：',
        '- 建議在後端 e2e-seed 提供 q=E2E-BC-MULTI 對應 >=2 筆商品',
        '- 再跑：pnpm db:seed（會清空業務表）→ pnpm --filter pos-erp-backend e2e:seed',
      ].join('\n');
      if (requireFixtures) throw new Error(msg);
      test.skip(true, msg);
    }

    await choices.getByRole('button').first().click();
    await expect(hint).toContainText('已加入購物車');
  });
});

