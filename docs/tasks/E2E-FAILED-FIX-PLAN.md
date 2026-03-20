# E2E 7 Failed 修復計畫

> 依據 agent-log 034 後續與 FRONTEND-INSTRUCTIONS 035 整理。

## 分派摘要

| 任務 | 負責 | 說明 |
|------|------|------|
| ① 條碼 locator | **前端** | E2E spec 補等待、locator 修正 |
| ② 進貨驗收 toast | **前端** | E2E spec 無 Key 時 skip、斷言調整 |
| ③ POS 商品 locator | **前端** | E2E spec 改用 `pos-product-*` 第一個 |
| 環境（db:seed、e2e:seed） | **後端** | 確認 fixture 齊全，無需改 Guard |

---

## 失敗摘要

| 分類 | 影響 spec | 根因摘要 |
|------|-----------|----------|
| ① 條碼 | admin-barcode-min、admin-barcode-multi-match | `e2e-pos-barcode-input` 找不到 |
| ② 進貨驗收 | admin-receiving-notes-smoke | 未出現「已送出退回供應商」文案 |
| ③ POS 商品 | pos-checkout、pos-credit、pos-refund、pos-return-stock | `[data-product-name="食盆 小"]` 找不到 |

---

## ① 條碼 spec：e2e-pos-barcode-input 找不到

### 現況

- **PosPage.tsx** 已設 `data-testid="e2e-pos-barcode-input"`（L452）。
- **admin-barcode-min** 流程：`/login` → 點 `e2e-login-submit`（進入門市收銀）→ `/pos` → 使用 `e2e-pos-barcode-input`。

### 可能根因

1. **Lazy 載入時序**：PosPage 為 `PosPageLazy`，Suspense fallback 期間 input 尚不存在。
2. **版面 / viewport**：小螢幕或特定斷點時，input 可能被收合或不在可見區域。
3. **路徑不符**：實際導向非 `/pos`，或停留在 `/pos/orders` 等子路由。

### 修復方案（依序嘗試）

| 步驟 | 作法 | 說明 |
|------|------|------|
| 1 | **增加等待條件** | 在 `getByTestId('e2e-pos-barcode-input')` 前加 `await page.waitForURL(/\/pos$/);` 與 `await expect(input).toBeVisible({ timeout: 15_000 });`，確保路由與元素已載入。 |
| 2 | **檢查 login 導向** | 確認 `e2e-login-submit` 會導向 `/pos` 而非 `/pos/orders`；必要時在 spec 補 `await page.goto('/pos')`。 |
| 3 | **確認 POS 載入完成** | 改為等待任一穩定元素出現（如 `e2e-checkout-open` 或 `e2e-pos-barcode-input`）再操作，避免在 Suspense 期間開始測試。 |
| 4 | **若仍失敗則加明確 testid** | 若 PosPage 有多個 search input，確認條碼輸入為唯一帶 `e2e-pos-barcode-input` 的欄位，避免誤用其他 input。 |

### 驗收

- `pnpm exec playwright test e2e/admin-barcode-min.spec.ts e2e/admin-barcode-multi-match.spec.ts` 全綠。

---

## ② 進貨驗收：未顯示「已送出退回供應商」

### 現況

- **AdminReceivingNotesPage.tsx** 成功時呼叫 `showToast('已送出退回供應商', 'ok')`（L1014）。
- **AdminToastContext** 會 render toast，但約 3.2 秒後移除。
- Spec 期待 `page.getByText('已送出退回供應商').toBeVisible({ timeout: 10_000 })`。

### 可能根因

1. **API 失敗**：若無 `VITE_ADMIN_API_KEY` 或後端 401，不會走到成功路徑，只會 `showToast(out.message, 'err')`，不會顯示「已送出退回供應商」。
2. **Toast 生命週期**：toast 3.2 秒後移除，若 API 較慢或 UI 較晚更新，可能在斷言前就已消失。
3. **Toast 定位**：toast 使用 `fixed right-4 top-4`，可能被 modal、overlay 遮住或超出 viewport。
4. **流程未完成**：表單送出後，modal 關閉或畫面切換，toast 尚未顯示即被覆蓋。

### 修復方案（依序嘗試）

| 步驟 | 作法 | 說明 |
|------|------|------|
| 1 | **確認 Admin Key** | 執行 spec 時設定 `VITE_ADMIN_API_KEY` 或 `ADMIN_API_KEY`，確保 return-to-supplier API 可成功。 |
| 2 | **skip 無 Key 情境** | 若無 Key，在 spec 開頭 `test.skip()` 並註明需 Admin Key；避免在必然失敗的環境跑完整流程。 |
| 3 | **改用 toast 專用 testid** | 在 toast 區塊保留 `data-testid="e2e-admin-toast"`，斷言改為 `page.getByTestId('e2e-admin-toast').filter({ hasText: '已送出退回供應商' })` 以鎖定正確 toast。 |
| 4 | **延長 toast 顯示時間（僅供 E2E）** | 若確認為時間問題，可考慮在 E2E 模式加長 toast 顯示時間，或改為先等 toast 出現再繼續後續斷言。 |
| 5 | **改驗證「本次送出明細」** | 若 toast 難以穩定取得，可改為斷言成功後 modal 內「本次送出明細」或明細列表出現，作為流程完成的依據。 |

### 驗收

- `pnpm exec playwright test e2e/admin-receiving-notes-smoke.spec.ts` 全綠（含設定 Admin Key 時）。

---

## ③ POS 商品：data-product-name="食盆 小" 找不到

### 現況

- **PosPage** 商品卡使用 `data-product-name={product.name}`（L592）。
- **db/seed** 有 `DEMO-BOWL-S`，名稱 `食盆 小`。
- **PosPage** 有 fallback：`productsForGrid = apiProducts ?? mockProducts`；API 失敗時用 mock，mock 商品名為「示意商品 N」。

### 可能根因

1. **API 未回傳真實商品**：後端未啟動、未執行 `db:seed`，或 store/merchant 篩選導致無商品。
2. **使用 mock 商品**：API 失敗時 `apiProducts === null`，改用 mock，「食盆 小」不存在。
3. **商品名變更**：seed 或 fixture 已修改，「食盆 小」已更名或移除。
4. **載入時序**：商品 grid 非同步載入，斷言時尚未 render。

### 修復方案（依序嘗試）

| 步驟 | 作法 | 說明 |
|------|------|------|
| 1 | **確保 E2E 環境** | 依 `docs/e2e-pos.md`：先 `pnpm db:seed`、必要時 `e2e:seed`，並啟動後端（:3003），確保 getProducts 回傳真實商品。 |
| 2 | **改用不依賴商品名的 locator** | 以 `page.locator('[data-testid^="pos-product-"]').first()` 點選第一個商品，不依賴「食盆 小」。需確認第一個商品可完成結帳流程。 |
| 3 | **E2E 專用 fixture 商品** | 在 e2e-seed 新增穩定商品（如固定 id、固定 name），PosPage 加 `data-testid="e2e-pos-fixture-product"`，spec 用此 testid。 |
| 4 | **彈性 fallback 斷言** | 若「食盆 小」存在則點它，否則點第一個 `pos-product-*`，並在 spec 註明需 db:seed。 |
| 5 | **確認 getProducts 參數** | 檢查 posOrdersApi.getProducts 是否傳入正確 storeId/merchantId，確保能取得 seed 商品。 |

### 建議實作（方案 2 + 文件）

```ts
// 以第一個商品代替固定名稱，提高穩定性
const productCard = page.locator('[data-testid^="pos-product-"]').first();
await expect(productCard).toBeVisible({ timeout: 15_000 });
await productCard.click();
```

並在 `docs/e2e-pos.md` 註明：pos-checkout / pos-credit / pos-refund / pos-return-stock 需 `db:seed` 且後端運行，否則會用 mock 商品可能導致後續步驟失敗。

### 驗收

- `pnpm exec playwright test e2e/pos-checkout.spec.ts e2e/pos-credit.spec.ts e2e/pos-refund.spec.ts e2e/pos-return-stock.spec.ts` 全綠。

---

## 執行順序建議

1. **③ POS 商品**：改 locator 最快，且與後續結帳流程直接相關。
2. **① 條碼**：補等待條件與導向確認。
3. **② 進貨驗收**：確認 Admin Key、必要時加 skip、強化 toast 或流程斷言。

---

## VITE_ADMIN_API_KEY 與權限（客戶不切權限）

**決策**：客戶無需權限切換，**先隱藏**權限相關 UI，不改後端 Guard。

- **後端**：`AdminApiKeyGuard` 維持，API 仍驗證 Key。
- **前端**：隱藏「需管理金鑰」等提示；改由 `.env` 預設 `VITE_ADMIN_API_KEY`，不顯示權限設定 UI。
- **E2E**：admin-receiving-notes-smoke 等需 Admin API 的 spec，無 Key 時 skip；CI 時可設 env 取得 Key。

---

## 環境檢查清單

執行 E2E 前確認：

- [ ] 後端已啟動（預設 `http://localhost:3003`）
- [ ] `pnpm db:seed` 已執行（含「食盆 小」等商品）
- [ ] 必要時 `pnpm --filter pos-erp-backend e2e:seed`（E2E-RN-0001、E2E-BC-0001 等）
- [ ] `VITE_ADMIN_API_KEY` 或 `ADMIN_API_KEY` 已設（進貨驗收退回供應商、需 Admin 權限之 spec）
- [ ] 前端 `E2E_BASE_URL` 指向實際服務（預設 `http://localhost:5173`）
