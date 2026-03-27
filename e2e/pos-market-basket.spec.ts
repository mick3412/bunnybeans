import { test, expect } from '@playwright/test';

async function loginToPos(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '進入門市收銀' }).click();
  await expect(page).toHaveURL(/\/pos/);
}

test.describe('共購分析 (Market Basket)', () => {
  test('頁面載入與 promoFilter 切換', async ({ page }) => {
    await loginToPos(page);
    await page.getByRole('link', { name: '報表' }).click();

    const reportsContainer = page.getByTestId('e2e-pos-reports');
    await expect(reportsContainer).toBeVisible({ timeout: 15_000 });

    const mbLink = reportsContainer.getByRole('link', { name: '共購分析' });
    await expect(mbLink).toBeVisible();
    await mbLink.click();

    await expect(page).toHaveURL(/\/pos\/reports\/market-basket/);

    const container = page.getByTestId('e2e-market-basket');
    await expect(container).toBeVisible({ timeout: 15_000 });

    await expect(container.getByText('共購分析')).toBeVisible();
    await expect(container.getByTestId('e2e-mb-promo-filter')).toBeVisible();

    const promoFilterGroup = container.getByTestId('e2e-mb-promo-filter');
    await expect(promoFilterGroup).toBeVisible();

    await promoFilterGroup.getByText('無促銷').click();
    await expect(page).toHaveURL(/promoFilter=without_promo/);

    await promoFilterGroup.getByText('有促銷').click();
    await expect(page).toHaveURL(/promoFilter=with_promo/);

    await promoFilterGroup.getByText('全部').click();
    await expect(page.url()).not.toMatch(/promoFilter=/);

    const emptyHint = container.getByText('此條件下尚無共購組合');
    const table = container.getByRole('table');
    await expect(table.or(emptyHint)).toBeVisible();
  });

  test('preset 與門市篩選同步 URL', async ({ page }) => {
    await loginToPos(page);
    await page.getByRole('link', { name: '報表' }).click();
    await page.getByRole('link', { name: '共購分析' }).click();

    const container = page.getByTestId('e2e-market-basket');
    await expect(container).toBeVisible({ timeout: 15_000 });

    const presetSelect = container.getByTestId('e2e-mb-preset');
    await presetSelect.selectOption('last7d');
    await expect(page).toHaveURL(/preset=last7d/);

    const chartTitle = container.getByText('Top 10 共購組合');
    const emptyHint = container.getByText('此條件下尚無共購組合');
    await expect(chartTitle.or(emptyHint)).toBeVisible();

    const storeSelect = container.getByTestId('e2e-mb-store');
    await expect(storeSelect).toBeVisible();

    const firstStoreOption = storeSelect.locator('option').filter({ hasNotText: '全部門市' }).first();
    if (await firstStoreOption.isVisible()) {
      const storeValue = await firstStoreOption.getAttribute('value');
      if (storeValue) {
        await storeSelect.selectOption(storeValue);
        await expect(page).toHaveURL(new RegExp(`storeId=${storeValue}`));
      }
    }
  });

  test('返回業績概覽連結', async ({ page }) => {
    await loginToPos(page);
    await page.getByRole('link', { name: '報表' }).click();
    await page.getByRole('link', { name: '共購分析' }).click();

    const container = page.getByTestId('e2e-market-basket');
    await expect(container).toBeVisible({ timeout: 15_000 });

    const backLink = container.getByRole('link', { name: '返回業績概覽' });
    await expect(backLink).toBeVisible();
    await backLink.click();
    await expect(page).toHaveURL(/\/pos\/reports$/);
  });
});
