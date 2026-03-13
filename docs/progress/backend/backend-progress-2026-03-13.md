# 後端進度紀錄 2026-03-13

> 後端進度回報以本目錄（`docs/progress/backend/`）為準，與前端 `docs/progress/frontend/` 對應，供前後端同步使用。

---

## 今日完成

- **主檔 CRUD**：Merchant / Store / Warehouse / Product 已具備完整 REST CRUD API（先前已完成）。
- **Inventory 模組**：實作 `InventoryService`、`InventoryRepository`、`InventoryController`。提供 `POST /inventory/events`、`GET /inventory/balances`、`GET /inventory/events`，事件為 append-only，匯總由 Service 更新。
- **Finance 模組**：實作 `FinanceService`、`FinanceRepository`、`FinanceController`。提供 `POST /finance/events`（Phase 1 僅寫入）。
- **POS 模組**：實作 `PosService`、`PosRepository`、`PosController`。`POST /pos/orders` 以 transaction 建立訂單後，依序呼叫 `InventoryService.recordInventoryEvent`（SALE_OUT）與 `FinanceService.recordFinanceEvent`（SALE_RECEIVABLE）。門市須至少關聯一個 Warehouse 作為扣庫倉庫。並提供 `GET /pos/orders`、`GET /pos/orders/:id`。
- **Seed 腳本**：新增 `backend/prisma/seed.ts`，建立一組 Merchant / Store / Warehouse / 三筆 Product 與初始庫存。執行方式：`pnpm --filter pos-erp-backend db:seed`。說明見 `docs/db-seed.md`。
- **全域錯誤格式與 Logging**：實作 `HttpExceptionFilter` 統一錯誤回應（`statusCode`、`message`、`error`、`traceId`）；在 `main.ts` 加入 request logger（輸出 `traceId`、`module`、`method`、`path`、`statusCode`、`durationMs`）。說明見 `docs/backend-error-format.md`。
- **整合測試**：新增 `pos-create-order.integration-spec.ts`，驗證「建立 POS 訂單 → 庫存扣減 → 金流事件」流程。需 `DATABASE_URL`，執行：`pnpm --filter pos-erp-backend test` 或 `pnpm --filter pos-erp-backend test:integration`。
- **API 文件更新**：`docs/api-design-pos.md`、`docs/api-design-inventory-finance.md` 中相關 endpoint 已標為 **stable**，並補上錯誤情境與測試說明（POS 含 curl 與前置資料）。
- **依 docs/progress/integrated-progress-2026-03-13.md 後端任務執行**：
  - **P1 業務錯誤碼**：POS / Inventory / Finance 所有拋錯處已帶上 `code`（如 `POS_STORE_NOT_FOUND`、`INVENTORY_INSUFFICIENT`、`FINANCE_AMOUNT_INVALID` 等）；`docs/backend-error-format.md` 已新增業務錯誤碼對照表。
  - **P2 商品篩選**：`GET /products` 支援可選 query `search`、`sku`、`categoryId`；回傳含 `categoryId`。**GET /categories** 已實作（CategoryModule），回傳 `{ id, code, name }[]`，供前端 POS 三列篩選使用。
  - **P3 整合測試**：新增 `inventory.integration-spec.ts`（記錄事件 → 餘額與事件查詢）、`finance.integration-spec.ts`（記錄金流事件 → 以 Prisma 驗證寫入）；與既有 POS 整合測試共 3 個 suite，`pnpm test` 可於 CI 執行。
- **POS 支付與測試補強（本輪）**：
  - `docs/api-design-pos.md` 已新增 POS 測試說明（含 db-seed 前置、POST/GET 範例、帶 storeId/from/to/page/pageSize 查詢、錯誤範例與 `POS_PAYMENT_MISMATCH`）及 **TRANSFER** 付款方式說明。
  - `backend-error-format.md` 業務錯誤碼已與實作核對，一致無缺項。
  - 賒帳設計草案已撰寫於 `erp-spec.md` 5.4 節與 `api-design-inventory-finance.md`；`backend-module-design.md` 已草擬 Brand / Tag schema 與 GET /brands、GET /products 篩選 API 草案。
- **訂單明細 payments（TASK-order-detail-payments）**：
  - Prisma 新增 `PosOrderPayment`（`orderId`、`method`、`amount`），建單時一併寫入；`GET /pos/orders/:id` 與 `POST /pos/orders` 成功回應皆含 `payments: { method, amount }[]`。
  - 既有訂單無付款列時回傳 `payments: []`。見 `docs/api-design-pos.md`、`backend/prisma/migrations/20260313120000_add_pos_order_payment/migration.sql`（新環境可 `migrate deploy`；本機曾用 `db push` 者請同步 schema）。
- **Brand / Tag（本輪）**：
  - Prisma：`Brand` 主檔、`Product.brandId`、`Product.tags`（JSON 字串陣列）。
  - **`GET /brands`**（BrandModule）、**`GET /products`** 新增 `brandId`、`tag` 篩選；商品回傳含 `brandId`、`tags`。
  - Seed：三品牌 + 14 筆商品掛品牌／標籤；`docs/api-design.md` §6、`docs/db-seed.md`、`backend-module-design.md` 已同步。
- **賒帳（部分付款）**：
  - `POST /pos/orders` 可選 **`allowCredit: true`**（須 **`customerId`**）；`sum(payments) <= totalAmount`；金流 **`SALE_RECEIVABLE` + `SALE_PAYMENT`**；明細含 **`paidAmount`、`remainingAmount`、`credit`**。
  - Prisma **`FinanceEventType.SALE_PAYMENT`**；錯誤碼見 `backend-error-format.md`。前端可依 `docs/api-design-pos.md` 開發結帳與明細。
- **補款 API**：`POST /pos/orders/:id/payments` 追加收款；`PosOrderPayment` + `SALE_PAYMENT`；已結清回 `POS_ORDER_ALREADY_SETTLED`；見 api-design-pos §4.1b、`deploy-preview.md` 部署前 db 說明。
- **P0 訂單關聯客戶**：`PosOrder.customerId`（FK → Customer，`onDelete: SetNull`）；建單帶 `customerId` 時驗證與門市同 Merchant，否則 `POS_CUSTOMER_NOT_FOUND`；`GET /pos/orders` 摘要含 `customerId`、`customerName`；明細另含 `customerCode`；migration `20260313180000_pos_order_customer_id`；seed 可選 Demo 客戶 C001；整合測試已覆蓋掛帳單與錯誤 merchant。
- **AGENT §一 本輪**：E2E 前置寫入 `db-seed.md`／`deploy-preview.md`；`api-design.md` §6 與 seed 對齊 **tag** 表；**退款 API** `POST /pos/orders/:id/refunds` 寫入 **`SALE_REFUND`**（`erp-spec` 5.2.1、api-design-pos §4.1c、inventory-finance 說明）；錯誤碼 `POS_REFUND_NO_PAYMENT`、`POS_REFUND_EXCEEDS_PAID`；`cloudflare-tunnel-demo.md` Named Tunnel／CORS 簡述；整合測試 6 則含退款。
- **Seed E2E 客戶**：`db:seed` 對固定 id **`e2e00001-0000-4000-8000-00000000c001`** upsert（code **E2E**），供 Playwright 掛帳與 `POS_CUSTOMER_NOT_FOUND` 對齊；見 `db-seed.md`、`e2e-pos.md`。
- **CI 後端**：`.github/workflows/backend-ci.yml`—Postgres 15、`db push`、seed、`pnpm --filter pos-erp-backend test`；`docs/e2e-pos.md` 補 CI 與可選 Playwright job 順序（對齊 AGENT-DEV §一）。
- **AGENT §一 再一輪**：可選 **`ADMIN_API_KEY`**—未設定不擋；設定時 `POST /inventory/events` 與 **POST/PATCH/DELETE /products** 須 **`X-Admin-Key`**（或 Bearer）；`AdminApiKeyGuard`；`ADMIN_API_KEY_REQUIRED`；admin-inventory-ui／admin-roles／api-design-inventory-finance 已同步。**erp-spec 5.2.2** 退款與庫存沖銷草案（`RETURN_FROM_CUSTOMER`）。本機 **9 tests** 全過。
- **Phase2 退貨入庫**：`POST /pos/orders/:id/return-to-stock`（`PosService.returnToStock`）—`items[]` 須為該單明細子集、累計退貨量 ≤ 原銷量；append **`RETURN_FROM_CUSTOMER`**（`referenceId` = 訂單 id、與建單同倉）。錯誤碼 `POS_RETURN_ITEMS_EMPTY`、`POS_RETURN_PRODUCT_NOT_ON_ORDER`、`POS_RETURN_EXCEEDS_SOLD`。api-design-pos §4.1d、api-design-inventory-finance、backend-error-format 已同步；整合測試 **10 tests** 全過。
- **§一加量**：**GET /finance/events** 只讀（`partyId`、`referenceId`、`type`、`from`/`to`、分頁）；**POST/PATCH /categories**（`AdminApiKeyGuard` 與 products 一致）；錯誤碼 `FINANCE_LIST_PAGE_INVALID`、`CATEGORY_*`；api-design-inventory-finance §5.0、api-design.md §6.0b；整合測試 **12 tests**（含 `category.integration-spec`）。

## 卡點

- 無。

## To Do

- （可選）GitHub Actions **Playwright** job 與後端 job 串接；見 `docs/e2e-pos.md` CI 小節。
- 生產若設 `ADMIN_API_KEY`：後台 **POST/PATCH /categories** 與商品相同須帶 **X-Admin-Key**。
- 部署 migrate + seed 說明維護。
- 新環境部署請執行：`pnpm --filter pos-erp-backend exec prisma db push`（或 migrate）後再 `db:seed`。
- 前後端串接後可視需求補全端 E2E（登入 → 加商品 → 結帳 → 查訂單）。

## 本日變更紀錄

- （僅追加、不刪不改。每次更新當日進度時在此追加一筆（請使用更新當下的時間），例如：`- 14:30 更新：…`）
- 更新：新增 GET /categories（CategoryModule）、GET /products 支援 categoryId 篩選與回傳；今日完成與 To Do 已改寫；backend-module-design 已更新。
- 更新：POS 支付方式新增 TRANSFER 並補測試說明；backend-error-format code 表已與實作對齊；新增賒帳設計草案（僅文件）；Brand/Tag schema 與 API 草案已草擬；Inventory/Finance 測試強化規劃已補於 integrated-progress。
- 14:00 更新：後端開發進度已同步，今日完成與 To Do 維持現狀。
- 14:25 更新：PosOrderPayment 持久化；GET/POST 訂單明細回傳 `payments`；api-design-pos 與 backend-module-design 已同步；整合測試已斷言 payments。
- 執行彙整：整合報告與前端進度已更新；後端 To Do 已收斂（payments／品項篩選前端已接）。
- 14:37 更新：BrandModule、GET /brands、Product brandId/tags 與 GET /products?brandId=&tag=；api-design.md §6；seed 已補品牌與標籤。
- 14:42 更新：賒帳 allowCredit + SALE_PAYMENT；PosOrderDetail 新增 paidAmount／remainingAmount／credit；api-design-pos、api-design-inventory-finance、backend-error-format 已同步；整合測試已覆蓋。
- 14:46 更新：後端進度與 To Do 已收斂（賒帳已實作）；本機已執行 prisma db push + generate 與 db:seed，DB 與 schema 同步。
- 15:01 更新：POST /pos/orders/:id/payments 補款；錯誤碼 POS_ORDER_ALREADY_SETTLED／POS_PAYMENT_EXCEEDS_REMAINING／POS_CREDIT_NO_RECEIVABLE；整合測試已覆蓋；deploy-preview 補 db push／seed 說明。
- 17:00 更新：後端進度檔同步；今日完成已含補款 API、賒帳／GET /brands／PosOrderPayment 等主線；To Do 維持 E2E／沖帳後續與部署 db push／seed；README 後端列最後更新已對齊本日。
- 整合更新：To Do 新增 PosOrder.customerId + 明細／列表客戶名稱 API（與前端響應式並列下一輪）。
- 18:30 更新：P0 訂單關聯客戶—Prisma `PosOrder.customerId`、建單驗證、`GET` 列表／明細客戶欄、`POS_CUSTOMER_NOT_FOUND`、migration、seed Demo 客戶、整合測試；api-design-pos／backend-error-format 已同步。
- 20:15 更新：後端進度再次同步；本機已執行 `prisma db push`、`generate`、`db:seed`；`pos-create-order.integration-spec` 四則全通（建單、掛帳+客戶、補款結清、`POS_CUSTOMER_NOT_FOUND`）；今日完成與 To Do 維持現狀，供部署／前端對齊。
- 21:30 更新：對齊 AGENT-DEV §一—P1 E2E／tag 文件；P2 `POST /pos/orders/:id/refunds` + erp-spec 5.2.1 + 整合測試；Named Tunnel 文件；backend-progress／README 同步。
- **seed E2E 客戶**：每次 `db:seed` 對固定 id `e2e00001-0000-4000-8000-00000000c001` **upsert**（code E2E），與既有 C001 分離；修復 Playwright 掛帳 E2E 因 `POS_CUSTOMER_NOT_FOUND` 導致結帳 Modal 不關；`db-seed.md`／`e2e-pos.md` 已同步。
- 22:15 更新：**今日後端進度紀錄**—今日完成已含 P0 客戶、補款、退款 API、AGENT §一 文件、E2E seed 客戶 upsert；卡點無；To Do 含 E2E／部署 db+seed；README 後端列與本檔對齊。
- 16:50 更新：AGENT §一—新增 **Backend CI** workflow（Postgres、`db push`、seed、jest）；`e2e-pos.md` CI 說明與 Playwright 可選步驟；To Do 改為可選 E2E job。
- 16:51 更新：**直接執行**本機與 CI 同序—`prisma generate`、`db push`、`db:seed`、`pnpm test`；3 suites／8 tests 全通（Finance、Inventory、POS 含退款）；GitHub 推上後 Actions 會跑同一套。
- 17:14 更新：對齊 §一—**jest 全綠**；**ADMIN_API_KEY** 可選 Guard + 文件 + **5.2.2** 沖銷草案；backend-progress／README 同步。
- 17:37 更新：**Phase2 沖銷實作**—`POST /pos/orders/:id/return-to-stock`、`RETURN_FROM_CUSTOMER`、錯誤碼與 api-design；整合測試建單→退 1→庫存 +1、退超過售出 `POS_RETURN_EXCEEDS_SOLD`；jest **10 passed**；README 後端列同步。
- 21:07 更新：**GET /finance/events** + **Category POST/PATCH**；Finance `recordFinanceEvent` 回傳欄位與列表一致（amount 數字）；jest **12 passed**；AGENT-DEV／admin-inventory-ui／README 同步。
- 22:12 更新：**後端開發紀錄同步**—今日完成欄已含 POS／退款／return-to-stock／**GET /finance/events**／**Category POST/PATCH**／ADMIN_API_KEY／Backend CI；**jest 12 passed**（4 suites：Inventory、Finance、Category、POS）；卡點無；To Do 維持 E2E 可選、部署 db+seed、ADMIN_KEY 與分類維護；`docs/progress/README.md` 後端列已對齊本筆時間。
