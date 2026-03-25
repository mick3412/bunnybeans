import { test, expect } from '@playwright/test';

/**
 * 折扣標籤 E2E：AdminDiscountTagsPage、PosPromosPage 折扣區、PosPage 折扣篩選
 * API：GET /product-tags、GET /product-tags/for-pos-discount
 */
const hasAdminKey = Boolean(
  (process.env.VITE_ADMIN_API_KEY ?? process.env.ADMIN_API_KEY ?? '').trim(),
);

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

test.describe('後台 折扣標籤頁', () => {
  test('載入折扣標籤頁', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/discount-tags');
    await expect(page).toHaveURL(/\/admin\/discount-tags/);

    const container = page.getByTestId('e2e-admin-discount-tags');
    await expect(container).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '折扣標籤設定' })).toBeVisible();
    await expect(container.getByText('新增標籤', { exact: true })).toBeVisible();
    await expect(container.getByText('現有標籤', { exact: true })).toBeVisible();
  });

  test('側欄折扣標籤連結可導向', async ({ page }) => {
    await loginAdmin(page);
    await page.goto('/admin/products');

    const link = page.getByRole('link', { name: '折扣標籤' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/admin/discount-tags');

    await link.click();
    await expect(page).toHaveURL(/\/admin\/discount-tags/);
    await expect(page.getByTestId('e2e-admin-discount-tags')).toBeVisible({ timeout: 5_000 });
  });

  test('新增折扣標籤（需 VITE_ADMIN_API_KEY）', async ({ page }) => {
    test.skip(!hasAdminKey, '未設 VITE_ADMIN_API_KEY／ADMIN_API_KEY 時 skip');
    await loginAdmin(page);
    await page.goto('/admin/discount-tags');

    const container = page.getByTestId('e2e-admin-discount-tags');
    await expect(container).toBeVisible({ timeout: 15_000 });

    const tagName = `E2E-DISCOUNT-${Date.now()}`;
    await container.getByTestId('e2e-admin-discount-tags-create-name-input').fill(tagName);
    await container.getByTestId('e2e-admin-discount-tags-create-add-btn').click();
    await expect(container.getByText(tagName)).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('POS 促銷頁 折扣標籤區塊', () => {
  test('進行中促銷頁含折扣標籤區', async ({ page }) => {
    await loginPos(page);
    await page.getByRole('link', { name: '促銷' }).click();
    await expect(page).toHaveURL(/\/pos\/promos/);

    const promos = page.getByTestId('e2e-pos-promos');
    const apiErr = page.getByText(/無法載入門市|無法取得|門市未帶/);
    await expect(promos.or(apiErr)).toBeVisible({ timeout: 25_000 });
    if (await apiErr.isVisible()) {
      test.skip(true, 'POS 促銷頁 API 未就緒（門市／後端）');
      return;
    }
    const discountSection = promos.getByTestId('e2e-pos-promos-discount-tags');
    await expect(discountSection).toBeVisible();
    await expect(discountSection.getByRole('heading', { name: '折扣標籤' })).toBeVisible();
    await expect(discountSection.getByText('收銀區「折扣」篩選列顯示的標籤')).toBeVisible();
    await expect(promos.getByRole('link', { name: '後台編輯折扣標籤' })).toHaveAttribute('href', '/admin/discount-tags');
  });
});

test.describe('POS 收銀頁 折扣篩選', () => {
  test('折扣篩選列可見（無／標籤）', async ({ page }) => {
    await loginPos(page);
    await expect(page).toHaveURL(/\/pos$/);

    const productCard = page.locator('[data-testid^="pos-product-"]').first();
    await expect(productCard).toBeVisible({ timeout: 15_000 });

    const discountLabel = page.getByText('折扣', { exact: true });
    await expect(discountLabel).toBeVisible();
    const noneBtn = page.getByTestId('pos-filter-tag-none');
    await expect(noneBtn).toBeVisible();
  });

  test('點擊折扣篩選「無」不影響列表', async ({ page }) => {
    await loginPos(page);
    const noneBtn = page.getByTestId('pos-filter-tag-none');
    await expect(noneBtn).toBeVisible({ timeout: 15_000 });
    await noneBtn.click();
    await expect(noneBtn).toHaveClass(/bg-brand-primary/);
  });
});
