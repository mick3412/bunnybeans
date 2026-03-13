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

## 卡點

- 無。

## To Do

- 前端已可驗證明細 `payments`、賒帳 `allowCredit`、品牌列 `GET /brands` + `GET /products?brandId=`（見前端進度檔與整合報告）。
- E2E（Playwright 等）可涵蓋補款流程；沖帳／退款 API 仍屬後續。
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
