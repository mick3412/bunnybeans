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
    // 頁面上可能同時存在多個 <select>（例如：preset 與日/週/月 groupBy）
    // 避免 strict mode violation，改用 option[value="last7d"] 定位正確 select。
    const presetSelect = container
      .locator('select')
      .filter({ has: page.locator('option[value="last7d"]') })
      .first();
    await presetSelect.selectOption('last7d');
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
    const dailyChartTitle = container.getByText('營收趨勢');
    const dailyEmpty = container.getByText('此區間內尚無營收／訂單紀錄。');
    // 頁面用 Alert 顯示錯誤：區間趨勢：{error}
    const dailyErr = container.getByText(/區間趨勢：/);
    const dailyAnyState = dailyTitle.or(dailyChartTitle).or(dailyEmpty).or(dailyErr);
    await expect.soft(dailyAnyState.first()).toBeVisible();
  });

  test('會員營收貢獻、營收趨勢、客單價分布、金流連結四區塊存在或空態不報錯', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: '進入門市收銀' }).click();
    await page.getByRole('link', { name: '報表' }).click();

    const container = page.getByTestId('e2e-pos-reports');
    await expect(container).toBeVisible({ timeout: 15_000 });

    // 會員營收貢獻：區塊標題或空態文案（memberContribution 有值時顯示）
    const memberContribTitle = container.getByText('會員營收貢獻');
    const memberContribEmpty = container.getByText('此區間尚無訂單');
    // 不要把「營收合計」混進 or，避免一次命中兩個元素造成 strict mode violation。
    await expect.soft(memberContribTitle.or(memberContribEmpty).first()).toBeVisible();

    // 營收趨勢：依日/週/月切換，有資料或空態
    const trendTitle = container.getByText('營收趨勢');
    const trendLoading = container.getByText('區間趨勢（按日）');
    const trendEmpty = container.getByText('此區間內尚無營收／訂單紀錄。');
    // 頁面用 Alert 顯示錯誤：區間趨勢：{error}
    const trendErr = container.getByText(/區間趨勢：/);
    const trendAnyState = trendTitle.or(trendLoading).or(trendEmpty).or(trendErr);
    await expect.soft(trendAnyState.first()).toBeVisible();

    // 日/週/月切換存在
    const groupBySelect = container.locator('select').filter({ has: page.locator('option[value="day"]') });
    if (await groupBySelect.isVisible()) {
      await groupBySelect.selectOption('week');
      await expect(groupBySelect).toHaveValue('week');
      await groupBySelect.selectOption('month');
      await expect(groupBySelect).toHaveValue('month');
    }

    // 客單價分布：有資料、載入中或空態
    const distTitle = container.getByText('客單價分布');
    const distEmpty = container.getByText('客單價分布：此區間尚無訂單');
    const distErr = container.getByText(/客單價分布載入失敗/);
    await expect.soft(distTitle.or(distEmpty).or(distErr)).toBeVisible();

    // 金流報表連結存在
    const financeLink = container.getByRole('link', { name: '金流報表' });
    await expect(financeLink).toBeVisible();
    await expect(financeLink).toHaveAttribute('href', '/admin/reports');
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

