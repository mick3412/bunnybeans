# 前端開發紀錄（僅追加）

規格 Agent 收斂時讀本檔**最新條目**。前端 Agent **每輪完成後**在下方追加，**勿刪改**上方舊文。**新條目標題必含實際寫入當下之 `HH:MM`**。

格式：

```markdown
### YYYY-MM-DD HH:MM（本輪摘要一句）
- 做了：…
- PR／檔案（可選）：…
```

---

### 初始化

- 本檔建立：協作流程改為 agent-log；之後每輪前端完成必追加。

### 2026-03-14 15:05（E1+E2 批量匯出 UI）
- 做了：AdminInventoryPage「匯出餘額 CSV」、AdminReportsPage「匯出 CSV」；adminApi `fetchCsvExport` + export 路由帶 X-Admin-Key。
- 檔案：`frontend/src/modules/admin/adminApi.ts`、`AdminInventoryPage.tsx`、`AdminReportsPage.tsx`。

### 2026-03-14 16:31（E4 商品 CSV 匯入 UI）
- 做了：`POST /products/import` 前端：multipart `file` + `X-Admin-Key`；成功/失敗列顯示、toast、401 提示 ADMIN_KEY；`data-testid="e2e-admin-products-import"`。
- 檔案：`frontend/src/modules/admin/adminApi.ts`（`importProductsCsv`、`needsAdminKey products/import`）、`frontend/src/pages/admin/AdminProductsPage.tsx`。

### 2026-03-14 17:48（E3 訂單匯出 CSV + E5 盤點匯入 + needsAdminKey）
- 做了：**E3** PosOrdersListPage「匯出訂單 CSV」`fetchCsvExport(pos/orders/export?storeId&from&to)`、`data-testid="e2e-pos-orders-export"`、無 Key 時 disabled。**needsAdminKey** 補 **pos/orders/export** GET、**inventory/events/import** POST。**E5** AdminInventoryPage 盤點 CSV 上傳 + `importInventoryEventsCsv` + ok/failed、reload 餘額／事件。
- 檔案：`frontend/src/modules/admin/adminApi.ts`、`frontend/src/pages/PosOrdersListPage.tsx`、`frontend/src/pages/admin/AdminInventoryPage.tsx`。

### 2026-03-13 18:02（E2E 批量 smoke + 庫存匯出 testid）
- 做了：**e2e/admin-bulk.spec.ts** — 商品頁 `e2e-admin-products-import`、庫存 `e2e-admin-inventory-export` 點擊後 **GET …/inventory/balances/export** 200（無 **VITE_ADMIN_API_KEY** 時該則 skip）、盤點區塊 `e2e-admin-inventory-import`、POS `/pos/orders` **e2e-pos-orders-export**。**build** 綠。選配 **POST /customers/import** 後端尚未上線，未做 D5 UI。
- 檔案：`e2e/admin-bulk.spec.ts`、`frontend/src/pages/admin/AdminInventoryPage.tsx`（`data-testid="e2e-admin-inventory-export"`）、`docs/e2e-pos.md`。

### 2026-03-14 20:35（E2E 登入 URL 修正 + 本機執行環境）
- 做了：**根因**：Login「進入後台」導向 **`/admin`**（dashboard），舊斷言 **`/\/admin\//`** 對不到 → **admin-bulk** 第一則等滿 timeout。**修正**：`e2e/admin-bulk.spec.ts` 的 `loginAdmin` 改 **`/\/admin(\/|$)/`**。**admin-smoke** 第一則登入後補 **`goto('/admin/inventory')`** 再驗庫存頁（與路由一致）。本機釋放 **3003／5173**、重起後端；沙箱內 Playwright Chromium 路徑缺檔 → **`PLAYWRIGHT_BROWSERS_PATH=0`** + **`pnpm exec playwright install chromium`** 後可跑。**admin-bulk 四則全綠**；**pos-checkout** 單則綠。CI／本機跑全套請帶 **`VITE_ADMIN_API_KEY`**（同 backend **ADMIN_API_KEY**）。
- 檔案：`e2e/admin-bulk.spec.ts`、`e2e/admin-smoke.spec.ts`。

### 2026-03-14 20:41（客戶 preview/apply + 訂單含明細 + 非同步 job）
- 做了：**必做** — 新頁 **`/admin/customers/import`**：`POST /customers/import/preview` → 表格逐列 skip/create/overwrite（DB 衝突可覆寫）、**Skip Rest**、同 **File** 保留至 **apply**；**POST /customers/import/apply**（multipart `file` + `fileHash` + `decisions` JSON）；下載略過列 CSV；**adminApi** `needsAdminKey` 含 preview/apply。**選配 A** — PosOrdersListPage 勾選 **含明細** → `includeLines=1` 匯出。**選配 B** — 商品頁／庫存頁 **POST /imports/jobs/products_csv|inventory_csv** + 輪詢 **GET /imports/jobs/:id**。**build** 綠。
- 檔案：`frontend/src/modules/admin/adminApi.ts`、`AdminCustomerImportPage.tsx`、`App.tsx`、`AdminLayout.tsx`、`PosOrdersListPage.tsx`、`AdminProductsPage.tsx`、`AdminInventoryPage.tsx`。

### 2026-03-14 20:52（本輪 FRONTEND-INSTRUCTIONS：build + 客戶 import E2E + 手動清單）
- 做了：**build** 綠。**E2E** — 新增 `e2e/admin-customers-import.spec.ts`：登入 → `goto('/admin/customers/import')` → `e2e-admin-customers-import`；有 Key 時最小 CSV → **預覽** → **POST …/customers/import/preview** 200；無 Key 時 preview 則 **skip**。**docs/e2e-pos.md** 已列該 spec 與 skip 條件。**側欄「客戶 CSV」** 與 **401／無 Key 預覽 disabled** 維持既有實作未改。**手動迴歸清單**（請本機執行）：① POS 訂單列表勾 **含明細** 匯出 CSV；② 商品／庫存頁 **async job** 觀察 **pending→done** 或 **failed** 與 **error** 欄。
- 檔案：`e2e/admin-customers-import.spec.ts`、`docs/e2e-pos.md`。

### 2026-03-14 21:46（採購 Phase1 UI：供應商／採購單／進貨驗收）
- 做了：側欄 **採購** 三連結 **`/admin/suppliers`**、**`/admin/purchase-orders`**、**`/admin/receiving-notes`**。**purchaseApi**（BASE_URL 空 → in-memory mock，不 throw）：suppliers CRUD、PO 列表／草稿／submit／cancel、receiving-notes 建立／PATCH lines／complete（mock 回寫 PO qtyReceived）／reject。**AdminSuppliersPage** 搜尋、表、雙欄 Modal、啟用停用 tag。**AdminPurchaseOrdersPage** 狀態篩選、詳情 Modal、下單、建立驗收導向 receiving-notes。**AdminReceivingNotesPage** 新增驗收（選 ORDERED／PARTIAL PO）、詳情 訂購／實收／合格／退回、完成驗收／退回。**build** 綠。
- 檔案：`frontend/src/modules/admin/purchaseApi.ts`、`AdminSuppliersPage.tsx`、`AdminPurchaseOrdersPage.tsx`、`AdminReceivingNotesPage.tsx`、`App.tsx`、`AdminLayout.tsx`。

### 2026-03-14 21:57（採購 UI 對齊範例圖）
- 做了：**採購單頁** — 白底卡片、搜尋內嵌放大鏡、狀態 Tab 含 **已核准**、表無「預計到貨」、狀態彩色 tag、操作 chevron；**新增採購單** Modal（供應商*、預計到貨日、訂購品項多列＋合計＋備註、建立採購單；單號／倉庫程式內自動）。**進貨驗收** — 同風格列表；**新增驗收單** 副標、採購單下拉含供應商、選 PO 後 **驗收品項**（待收／實收／退回／合格綠字）、`createReceivingNote(lineInputs)`；紫鈕。**build** 綠。
- 檔案：`AdminPurchaseOrdersPage.tsx`、`AdminReceivingNotesPage.tsx`。

### 2026-03-14 22:11（FRONTEND-INSTRUCTIONS：採購契約 + 真 API 體驗）
- 做了：**契約** — 對齊 api-design-purchase：移除 **APPROVED**（PoStatus、mock PO、Tab、建立驗收條件）；可驗收 PO 僅 **ORDERED／PARTIALLY_RECEIVED**。**listSuppliers／listPurchaseOrders／listReceivingNotes** 改 **PurchaseListResult**；**req** try/catch 網路錯。**三採購頁** — loading spinner、API 失敗 toast + 紅條 **重試**、空態（供應商／可驗收 PO 文案）。**完成驗收** 成功 → **關閉詳情** + refetch。**選配** — 商品／庫存 async job **failed** 紅框凸顯 **error** + 庫存 toast。**build** 綠。手測後端：需 **VITE_API_BASE_URL** + merchantId／路由與 seed 一致。
- 檔案：`purchaseApi.ts`、`AdminSuppliersPage.tsx`、`AdminPurchaseOrdersPage.tsx`、`AdminReceivingNotesPage.tsx`、`AdminProductsPage.tsx`、`AdminInventoryPage.tsx`。

### 2026-03-14 22:28（FRONTEND-INSTRUCTIONS 更新版：維護 seed DB + POS memberLevel）
- 做了：**未執行 db:seed**（避免清空既有完整 seed DB）。**未跑會寫入後端之 E2E**（遵守常駐清理／不髒資料）。**build** 綠。**選配** — 後端 **GET /customers?merchantId=** 唯讀列表；POS **促銷試算** 下拉選客戶並顯示 **memberLevel**（VIP／GOLD 等，與 seed 一致）；仍能手填 UUID。
- 檔案：`backend/.../customer.controller.ts`、`customer.service.ts`、`posOrdersApi.ts`、`PosPage.tsx`。
