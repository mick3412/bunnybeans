## 目前完成的前端工作（依 docs/progress/integrated-progress-2026-03-13.md 前端任務執行）

- 已建立 React + Vite + TypeScript 的 POS 前端骨架，並導入 Tailwind v4（`@tailwindcss/vite`）與 React Router，提供 `/login`、`/pos`、`/pos/orders`、`/pos/orders/:id` 路由。
- 已實作登入頁（`/login`），包含簡化登入表單與「檢查後端連線」按鈕，會呼叫 `VITE_API_BASE_URL/health` 並顯示結果。
- 已實作 POS 收銀主畫面（`/pos`）的桌機版 UI：左側為商品分類與商品格子區，右側為購物車明細、小計/稅額/應收金額與行為按鈕（清空、前往結帳）；**門市與商品改為從 `GET /stores`、`GET /products` 取得**，結帳時使用 UUID（storeId、productId）。
- 已建立 **POS Orders API 客戶端**（`frontend/src/modules/pos/posOrdersApi.ts`）：`createOrder`（POST /pos/orders）、`listOrders`（GET /pos/orders）、`getOrderById`（GET /pos/orders/:id）、`getStores`、`getProducts`；請求可帶 `X-Trace-Id`。
- **結帳流程已改接真實 API**：結帳 Modal 呼叫 `POST /pos/orders`，Request 使用 UUID，payments 總和等於訂單總金額；錯誤時顯示 `statusCode` + `message` + `traceId`（依 `docs/backend-error-format.md`），並預留 `code` → 文案 mapping。
- **訂單列表已改接真實 API**：`/pos/orders` 呼叫 `GET /pos/orders`（支援 page、pageSize），顯示分頁與「共 N 筆」；錯誤時顯示 message。
- **訂單明細頁**：新增 `/pos/orders/:id`，直接呼叫 `GET /pos/orders/:id`，依 `PosOrderDetail` 顯示品項、數量、單價、總額；列表頁「查看明細」導向該頁。
- 已抽出初版共用 UI 元件（`Button`, `TextInput`）、POS 購物車 hook（`usePosCart`）、三列篩選（品項／品牌／折扣，mock 分類為全部、衣服、牧草、飼料、用品）與商品卡（`PosProductDisplay`）；Header 有「今日訂單」入口。

## 目前使用的 API 與狀態

- `GET /health`  
  - 用途：登入頁上的「檢查後端連線」按鈕，用來確認 backend 是否啟動。  
  - 狀態：**已實作且可依賴**（實作細節不在 `docs/api-design-*.md` 內，但僅用於 boolean/健康檢查，不牽涉業務資料）。
  - 前端依賴：只檢查 `res.ok` 與回傳 JSON 內的 `timestamp` 欄位（若不存在則顯示 `unknown`），不依賴特定錯誤結構。

- `GET /stores`、`GET /products`  
  - 用途：POS 頁載入時取得門市與商品主檔，供結帳使用 **UUID**（storeId、productId）；商品列表用於商品區 grid，售價目前為前端預設 100（後端 Product 無 price 欄位時）。  
  - 狀態：後端已實作（Merchant / Product 模組），前端已改接。

- `POST /pos/orders`、`GET /pos/orders`、`GET /pos/orders/:id`  
  - 前端已**改接真實 API**（`posOrdersApi.ts`），結帳、列表、明細均呼叫後端。  
  - 狀態：**stable**（依 `docs/api-design-pos.md`）。  
  - 使用方式：  
    - `POST /pos/orders`：結帳 Modal 送出，Request 為 UUID + payments 總和等於訂單總金額；錯誤顯示 statusCode + message + traceId。  
    - `GET /pos/orders`：訂單列表頁，支援 page、pageSize，分頁顯示。  
    - `GET /pos/orders/:id`：訂單明細頁顯示品項與總額。

- Inventory / Finance API（`/inventory/events`, `/inventory/balances`, `/finance/events`）  
  - 目前僅在設計層面參考 `docs/api-design-inventory-finance.md` 與 `docs/backend-module-design.md`，**前端尚未直接呼叫或建立 mock**。  
  - 預期用途：在 POS 結帳成功後，由 backend `PosService` 透過 `InventoryService` / `FinanceService` 處理事件，不由前端直接串這些 endpoint。

## 需要後端配合的事項

1. **業務錯誤碼（可選）**
   - 前端已預留 `code` → 文案 mapping（`ERROR_CODE_MAP`），目前僅顯示 `message`。若後端在 `docs/backend-error-format.md` 補上業務錯誤碼（如 `INVENTORY_INSUFFICIENT`、`STORE_NOT_FOUND`），前端可對應友善文案。

2. **確認 POS Orders 與 Inventory / Finance 模組之間的關係不需前端直接介入**
   - 文件位置：  
     - `docs/api-design-pos.md` 4.1（說明 `POST /pos/orders` 會透過 `InventoryService` 與 `FinanceService` 寫入事件）。  
     - `docs/api-design-inventory-finance.md` 4.1, 4.2, 5.1。  
   - 請後端確認以下設計前提是否成立，若有變更請在文件中明確寫出：  
     - POS 前端 **只需要呼叫 `POST /pos/orders`**，不會直接呼叫 `/inventory/events` 或 `/finance/events`。  
     - 庫存與金流事件的寫入與一致性，由 backend Application 層負責（包括交易、重試與錯誤對應），前端只需處理「訂單建立是否成功」與必要錯誤訊息。

3. **提供 POS Orders 的簡易測試方式（當實作完成時）**
   - 希望在 `docs/api-design-pos.md` 或新文件中，補上一小節「測試說明」，內容包含：  
     - 使用 `curl` 或 HTTP Client（如 `REST Client` snippet）的最小測試請求範例。  
     - 需要先建立的前置資料（例如：至少需要一個 `Store`、一個 `Product`，對應欄位為何）。  
   - 理由：前端在切換到真實 API 前，可以先用這些範例手動驗證 backend 行為是否與文件一致，再進行整合除錯。

## 前端下一步 TODO

- 若後端提供 `GET /categories`、`GET /brands` 或商品列表 API（含 category/brand/tags 參數），可將三列篩選改為依 API 選項與結果篩選；目前品項／品牌／折扣選項仍為 mock。
- 當後端在錯誤回應中補上 `code` 欄位並於 `docs/backend-error-format.md` 定義對照表後，在前端補上 `ERROR_CODE_MAP` 實際對應。
- 可選：訂單列表支援 storeId、from、to 篩選（API 已支援，前端可加 UI）。

## 本日變更紀錄

- （僅追加、不刪不改。每次更新當日進度時在此追加一筆，例如：`- 14:30 更新：…`）
