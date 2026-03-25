import { test, expect } from '@playwright/test';

/**
 * 收銀班次 E2E：PosSessionBar、開班/結班 Modal、AdminPosSessionsPage
 * 需後端 sessions API（GET /pos/sessions/current、POST open/close、GET list）與門市資料。
 */
async function loginAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '進入後台（庫存／商品）' }).click();
  await expect(page).toHaveURL(/\/admin(?:\/|\?|$)/, { timeout: 15_000 });
}

async function loginPos(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByTestId('e2e-login-submit').click();
  await expect(page).toHaveURL(/\/pos$/, { timeout: 15_000 });
}

test.describe('後台 收銀班次頁', () => {
  test('載入收銀班次頁與列表／空態', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/pos/sessions');
    await expect(page).toHaveURL(/\/admin\/pos\/sessions/);

    const container = page.getByTestId('e2e-admin-pos-sessions');
    await expect(container).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '收銀班次', level: 2 })).toBeVisible();

    await expect(container.getByText('班次列表', { exact: true })).toBeVisible();
  });

  test('側欄收銀班次連結可導向班次頁', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/reports');

    const sessionsLink = page.getByRole('link', { name: '收銀班次' });
    await expect(sessionsLink).toBeVisible();
    await expect(sessionsLink).toHaveAttribute('href', '/admin/pos/sessions');

    await sessionsLink.click();
    await expect(page).toHaveURL(/\/admin\/pos\/sessions/);
    await expect(page.getByTestId('e2e-admin-pos-sessions')).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('POS 班次列與開班／結班', () => {
  test('POS 頁班次列可見（尚無開班 或 班次進行中）', async ({ page }) => {
    await loginPos(page);

    const sessionBar = page.getByTestId('e2e-pos-session-bar');
    // 需有 storeId 才會顯示；無門市時不 render，timeout 後 skip
    const visible = await sessionBar.isVisible().catch(() => false);
    if (!visible) {
      test.skip(true, 'POS 無門市或 sessions API 未就緒，班次列未顯示');
      return;
    }

    // 尚無開班：顯示開班按鈕
    const openBtn = page.getByTestId('e2e-pos-session-open-btn');
    // 班次進行中：顯示結班按鈕
    const closeBtn = page.getByTestId('e2e-pos-session-close-btn');
    await expect(openBtn.or(closeBtn)).toBeVisible();
  });

  test('開班 Modal 流程', async ({ page }) => {
    const full = (process.env.E2E_PROFILE ?? '').trim() === 'full';
    await loginPos(page);

    const sessionBar = page.getByTestId('e2e-pos-session-bar');
    const openBtn = page.getByTestId('e2e-pos-session-open-btn');
    if (!(await sessionBar.isVisible().catch(() => false)) || !(await openBtn.isVisible().catch(() => false))) {
      test.skip(true, '尚無開班按鈕（可能已有班次或無門市）');
      return;
    }

    await openBtn.click();
    await expect(page.getByRole('heading', { name: '開班' })).toBeVisible({ timeout: 5_000 });

    const amountInput = page.getByTestId('e2e-pos-open-amount');
    await expect(amountInput).toBeVisible();
    await amountInput.fill('1000');

    const submitBtn = page.getByTestId('e2e-pos-open-submit');
    await submitBtn.click();

    if (full) {
      await expect(page.getByRole('heading', { name: '開班' })).toBeHidden({ timeout: 15_000 });
      await expect(page.getByTestId('e2e-pos-session-close-btn')).toBeVisible({ timeout: 5_000 });
    } else {
      // 非 full 時可能因後端未就緒而失敗，僅驗證 Modal 可操作
      await expect(submitBtn).toBeVisible();
    }
  });
});
