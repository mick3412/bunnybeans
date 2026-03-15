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

### 2026-03-14 23:45（商品主檔 UX + 採購列表穩定 + POS 會員說明）
- 做了：**商品主檔** — 表頭增 **分類／品牌**（`categoryName`／`brandName`）、欄寬持久化鍵改 **v2**。**新增／編輯** 改 **右側懸浮抽屜**：預設 `translate-x-full` 收起、右緣 **「新增商品」** 直條點擊向左展開（max-w 440px）；列 **編輯** 自動 `setPanelOpen(true)`；標題列 **收起**、儲存成功關閉；行動版遮罩關閉。**採購三頁** — 搜尋 debounce 改 **`loadRef.current`**，避免 merchant 閉包延遲請求把列表洗空；**purchaseApi** 正規化 PO/RN（`lines`、`_count` 防呆）；表格 `(p.lines || [])`。**POS** — 釐清：促銷試算需 **customerId** 試算折扣；結帳 Modal **關聯會員** 寫入訂單；Modal 開啟時 **`setMemberInput('')`** 故易覺重填，後續可 **預填試算 UUID** 減少重複輸入。
- 檔案：`AdminProductsPage.tsx`、`purchaseApi.ts`、`AdminSuppliersPage.tsx`、`AdminPurchaseOrdersPage.tsx`、`AdminReceivingNotesPage.tsx`、`PosCheckoutModal.tsx`（行為說明）、後端 PO/RN list 補 **lines**／**_count**（白屏根因）。

### 2026-03-17 15:40（Loyalty 儀表板對齊範本 + 全店存摺 + E2E smoke）
- 做了：**後端** — `GET /loyalty/dashboard` 擴充四 KPI（流通點數、本月新會員、累計 BURNED、進行中促銷數）+ **recentLedger** + **activePromotions**；**GET point-ledger** 僅 **merchantId** 時全店最近流水（含 **customerName**）。**前端** — **LoyaltyDashboardPage** 四卡 + 最近異動表 + 進行中活動；**點數存摺** 預設全店 + 可選會員 + 搜尋；設定頁業務摘要、**e2e-admin-loyalty**／**e2e-loyalty-settings**。**E2E** — `e2e/admin-loyalty-smoke.spec.ts`；**e2e-pos.md** 列檔。**api-design-loyalty §3** 補擴充欄位。**build** 綠；**backend jest 45** 綠。
- 檔案：`loyalty.service.ts`、`loyalty.controller.ts`、`loyaltyApi.ts`、`LoyaltyDashboardPage.tsx`、`LoyaltyPointLedgerPage.tsx`、`LoyaltySettingsPage.tsx`、`LoyaltyLayout.tsx`、`admin-loyalty-smoke.spec.ts`、`api-design-loyalty.md`、`e2e-pos.md`。

### 2026-03-17 14:05（Loyalty Cannot GET：dev 預設 API 基底 + Vite proxy）
- 做了：**根因** — `VITE_API_BASE_URL` 空時 `fetch('/loyalty/...')` 打到 **Vite:5173** → **Cannot GET**。**修正** — **adminApi／loyaltyApi／posOrdersApi／purchaseApi** 在 **`import.meta.env.DEV`** 時預設 **`http://127.0.0.1:3003`**（正式 build 仍須設 env）。**vite.config** 增 proxy **`/loyalty`、`/customers`、`/merchants`** → 3003 作備援。**build** 綠。
- 檔案：`adminApi.ts`、`loyaltyApi.ts`、`posOrdersApi.ts`、`purchaseApi.ts`、`vite.config.ts`。

### 2026-03-17 12:50（FRONTEND-INSTRUCTIONS：Loyalty CRM F0–F6 對齊後端 B1–B6）
- 做了：**F0** — `/admin/loyalty` 子路由 + **深藍側欄** 六連結（儀表板、點數存摺、促銷、會員、優惠券、設定）；商家下拉 + **OutletContext merchantId**。**F1** — **GET/PATCH loyalty/settings**、三區塊表單、Admin Key toast。**F2** — **GET point-ledger**（需選會員 customerId）+ Tab 篩選類型 + 表。**F3** — **GET /customers** 擴充欄位表 + 搜尋。**F4** — **GET loyalty/dashboard** 三 KPI 卡。**F5** — 促銷頁連結 **`/admin/promotions?merchantId=`**。**F6** — **GET/POST/PATCH loyalty/coupons** 列表 + 新增 + 啟停。**adminApi needsAdminKey**：`loyalty/settings` PATCH、`loyalty/coupons` POST/PATCH。**AdminLayout** 側欄 **Loyalty CRM**。**build** 綠。
- 檔案：`loyaltyApi.ts`、`LoyaltyLayout.tsx`、`LoyaltyDashboardPage.tsx`、`LoyaltyPointLedgerPage.tsx`、`LoyaltyPromotionsPage.tsx`、`LoyaltyMembersPage.tsx`、`LoyaltyCouponsPage.tsx`、`LoyaltySettingsPage.tsx`、`App.tsx`、`AdminLayout.tsx`、`adminApi.ts`（needsAdminKey）。

### 2026-03-18 11:30（FRONTEND-INSTRUCTIONS 迴歸 + 會員架構側欄扁平化）
- 做了：**會員／集點** 分頁改為與採購相同：主側欄直接列出 **儀表板、點數存摺、會員管理、優惠券、系統設定**（無內層 Loyalty 側欄）；**移除促銷活動**（與促銷規則重複，`/admin/loyalty/promotions` 改 **Navigate → /admin/promotions**）。**LoyaltyLayout** 僅保留商家選擇器 + 內容區（**data-testid="e2e-admin-loyalty"** 保留）。**build** 綠。E2E 本機埠占用未跑；採購三連結未拆。
- 檔案：`AdminLayout.tsx`、`LoyaltyLayout.tsx`、`App.tsx`（移除 LoyaltyPromotionsPage、promotions 改 Navigate）、刪除 `LoyaltyPromotionsPage.tsx`。
