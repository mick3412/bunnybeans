import { test, expect } from '@playwright/test';

test.describe('Admin POS 報表', () => {
  test('載入與 preset 切換', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: '進入門市收銀' }).click();
    await page.getByRole('link', { name: '報表' }).click();

    await expect(page).toHaveURL(/\/pos\/reports/);
    const container = page.getByTestId('e2e-pos-reports');
    await expect(container).toBeVisible({ timeout: 15_000 });

    // 預設今日（無 preset query）
    await expect(page).not.toHaveURL(/preset=/);

    // 切換到近 7 日
    await container.getByRole('combobox').selectOption('last7d');
    await expect(page).toHaveURL(/preset=last7d/);
  });

  test('summary / top-items / daily 區塊存在或顯示空態', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: '進入門市收銀' }).click();
    await page.getByRole('link', { name: '報表' }).click();

    const container = page.getByTestId('e2e-pos-reports');
    await expect(container).toBeVisible({ timeout: 15_000 });

    // summary 四卡至少其中一張存在
    await expect(container.getByText('營收合計')).toBeVisible();

    // 付款方式分布／熱銷品項／區間趨勢：有資料時出現區塊，沒資料則出現空態文案
    const topItemsTitle = container.getByText('熱銷品項');
    const topItemsRankTitle = container.getByText('熱銷排行');
    const topItemsEmpty = container.getByText('此區間內沒有任何銷售品項。');
    await expect.soft(topItemsTitle.or(topItemsRankTitle).or(topItemsEmpty)).toBeVisible();

    const dailyTitle = container.getByText('區間趨勢（按日）');
    const dailyChartTitle = container.getByText('日營收趨勢');
    const dailyEmpty = container.getByText('此區間內尚無營收／訂單紀錄。');
    const dailyErr = container.getByText('區間趨勢載入失敗');
    await expect.soft(dailyTitle.or(dailyChartTitle).or(dailyEmpty).or(dailyErr)).toBeVisible();
  });

  test('top-items 與銷售明細跳轉', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: '進入門市收銀' }).click();
    await page.getByRole('link', { name: '報表' }).click();

    const container = page.getByTestId('e2e-pos-reports');
    await expect(container).toBeVisible({ timeout: 15_000 });

    // 若有熱銷品項，點擊名稱導向 Admin 商品頁（href 以 /admin/products 為準）
    const topItemLink = container.locator('a[href^="/admin/products"]').first();
    if (await topItemLink.isVisible()) {
      await topItemLink.click();
      await expect(page).toHaveURL(/\/admin\/products/);
      await expect(page.url()).toContain('?q=');
    }

    // 回 POS 報表，測試銷售明細單號跳轉
    await page.goto('/pos/reports');
    const ordersTable = page.getByTestId('e2e-pos-reports');
    const orderLink = ordersTable.getByRole('link').filter({ hasText: /POS/ }).first();
    if (await orderLink.isVisible()) {
      await orderLink.click();
      await expect(page).toHaveURL(/\/pos\/orders\//);
    }
  });
});

