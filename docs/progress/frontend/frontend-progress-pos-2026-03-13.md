## 今日進度快照（2026-03-13）

> **最後彙整**：2026-03-13 **22:12**—退貨入庫改 `returns/stock`、E2E 5 全過、實操路徑

| 項目 | 內容 |
|------|------|
| **今日完成** | **退貨入庫 API 路徑**：前端改打 **`POST .../returns/stock`**（舊 `return-to-stock` 仍相容）；明細成功 **`e2e-detail-return-success`**、201 時必顯示成功文案。**E2E**：`waitForResponse` 斷言 201；本機需**單一後端佔 3003**（舊 process 會 404）。**本機驗收**：**5 passed**。**ERROR_CODE_MAP**：`POS_STORE_NO_WAREHOUSE`。 |
| **卡點** | 無（曾遇 **EADDRINUSE :3003** → 先 kill 舊後端再起）。 |
| **To Do** | 報表 MVP；Admin toast；可選 ADMIN_KEY 商品 E2E。 |

---

## 目前完成的前端工作（摘要）

- 路由：`/login`、`/pos`、`/pos/orders`、`/pos/orders/:id`。
- API：同上 + **appendOrderPayment**（補款）；列表／明細展示 **customerName**（依後端回傳）。
- **結帳**：全額或掛帳；掛帳必填客戶 ID；錯誤碼含賒帳三碼。
- **訂單明細**：`paidAmount`／`remainingAmount`／`credit` + 收款方式列。
- **POS 品項／品牌／tag**：分類 + 品牌 + **折扣 tag** API 載入商品。
- **E2E**：**5 spec**（+ 退貨入庫）+ **`e2e.yml`**／one-click／POS-E2E.app。
- **明細退款**：`postRefund`、api-design-pos §4.1c。
- **退貨入庫**：`postReturnToStock` → **`/pos/orders/:id/returns/stock`**；明細綠區 + E2E。

## 需要後端配合的事項

- **已滿足**：賒帳建單、brands、補款 API、錯誤碼表。
- **已接顯示**：列表／明細依 API 顯示 customerId、customerName、customerCode；後端未寫入時為 null／—。

## 前端下一步 TODO

- 後台 MVP；報表頁（P3）。

## 本日變更紀錄 （僅追加）

- 09:50 更新：（略，見歷史）
- 14:26 更新：（略，見歷史）
- **執行彙整**：（略）
- **整合更新**：後端已上 Brand + 賒帳；前端 To Do 改為接 allowCredit／brands／明細 paidRemaining／新 error code。
- **15:03 更新**：賒帳結帳 Modal（allowCredit、customerId、payments 加總 ≤ 應收）；PosOrderDetail 與明細 UI（paidAmount、remainingAmount、credit）；getBrands + 品牌篩選 + getProducts brandId；ERROR_CODE_MAP 三碼；ProductDto brandId/tags。
- **15:19 更新**：今日前端開發進度彙整；上方快照與 README 對齊；P0（賒帳／品牌／明細／錯誤碼）已落地；To Do 維持 E2E、tag 篩選、補款 API 可選。
- **整合更新**：新需求—訂單關聯消費者顯示名稱、響應式排版；待後端 PosOrder.customerId + API 欄位後前端再接顯示。
- **響應式**：POS 主區 min-h-0、商品格 flex-1 可捲動、窄螢幕 2 欄起；明細表 overflow-x-auto、max-w-3xl。
- **15:37 更新**：客戶欄／明細消費者區／賒帳醒目 banner／補款 UI；列表 md 下卡片；收銀小螢幕底部購物車；ERROR_CODE_MAP 補款與 POS_CUSTOMER_NOT_FOUND；型別 customerId／customerName／customerCode。
- **本輪更新**：`PosPage` 購物車 **`< lg` 固定底部、`lg+` 側欄**；移除 `sm:relative` 提早並排；主內容 `pb-[calc(14rem+safe-area)]`、購物車 `pb` 含 safe-area；README 前端列最後更新同步。
- **P1 完成**：`getProducts` 加 `tag`；POS 折扣列改 API；Playwright + `docs/e2e-pos.md`；多處 `data-testid`。
- **晚間更新**：掛帳 E2E 與後端 seed E2E 客戶 upsert 對齊；**本機 2 passed**；`e2e-one-click.sh`、`pnpm e2e:one`／`e2e:local`、`macos/POS-E2E.app`；`playwright` 重用 5173；README 前端列同步。
- **16:51 更新**（對齊 §二）：`.github/workflows/e2e.yml`；`postRefund` + 明細退款表單 + ERROR_CODE_MAP；`e2e-pos.md` CI；README 前端列。
- **16:54 更新**：依指示記錄前端開發進度；上方快照與摘要已含 CI E2E、退款 UI、Playwright／一鍵 App、tag、響應式底欄；To Do 維持後台 MVP／Named Tunnel。
- **17:15 更新**（§二 Phase3）：`adminApi` list/create/update/delete Merchants／Stores；`AdminMerchantsPage`／`AdminStoresPage`；`App` 路由 `merchants`／`stores`；`AdminLayout` 商家／門市導覽；`AdminInventoryPage` e2e testid；`e2e/admin-smoke.spec.ts`；`deploy-preview.md` Named Tunnel 與 VITE_API_BASE_URL；`LoginPage` 健康檢查錯誤附 deploy 文件說明。
- **17:28 更新**：本機 **`scripts/e2e-one-click.sh`** 跑 Playwright **3 passed**（後台 Admin smoke、POS 全額結帳、掛帳與補款）；流程與 **`macos/POS-E2E.app`**／`macos/README.md` 一致。備註：Cursor 內建終端若設了沙盒 `PLAYWRIGHT_BROWSERS_PATH`，可能出現 Chromium 架構與本機不符；**本機 Terminal 或雙擊 App** 可正常安裝 arm64 瀏覽器並通過。
- **17:36 更新**（§二）：`adminApi.request` 對受保護寫入帶 **X-Admin-Key**（`VITE_ADMIN_API_KEY`）；**倉庫** POST/PATCH/DELETE + **AdminWarehousesPage** CRUD（商家／門市選擇）；**PosOrderDetailPage** `e2e-detail-refund-*`；**e2e/pos-refund.spec.ts**；**e2e-pos.md**；**deploy-preview** `VITE_ADMIN_API_KEY` 列。
- **20:50 更新**：本機 **`scripts/e2e-one-click.sh`**（等同 **POS-E2E.app**）Playwright **4 passed**（約 4.4s）—後台 Admin smoke、POS 全額結帳、掛帳與補款、**POS 退款（小額退款成功）**；與 repo 現有 **e2e/*.spec.ts** 一致。
- **21:07 更新**（§二）：**退貨入庫 UI**（`postReturnToStock`、`PosOrderDetailPage` 綠區 + testid）；**ERROR_CODE_MAP** `POS_RETURN_*`；**e2e/pos-return-stock.spec.ts**；**AdminCategoriesPage** `/admin/categories`；**LoginPage** `<details>` Tunnel／VITE_ADMIN；**e2e-pos.md**。
- **22:12 更新**：**`posOrdersApi.postReturnToStock`** 改 **`returns/stock`**；明細成功分支強化（201 必提示、`e2e-detail-return-success`）；**pos-return-stock.spec** 等 **201**；**api-design-pos** 建議路徑；維運備註 **3003 僅一實例** 否則退貨入庫 E2E 曾 404；本機 **5 passed** 已對齊。
- **00:39 更新**（§五 分類 CRUD）：**`adminApi`** `createCategory`／`updateCategory`／`deleteCategory`；**`needsAdminKey`** 含 `categories` POST、`categories/*` PATCH／DELETE；**`AdminCategoriesPage`** 新增／列上編輯／刪除；**`CATEGORY_IN_USE`** error map；**`admin-inventory-ui.md`** 對照。
- **01:13 更新**（AGENT 對照計畫）：**`getFinanceEvents`** + **`/admin/reports`** 金流報表 MVP；**`AdminToastProvider`** + 分類成功 toast；商品表 **展開各倉／收合**；**e2e** `admin-categories.spec` + admin-smoke 報表；**e2e.yml** 註明 6 spec；jest 14 綠。
