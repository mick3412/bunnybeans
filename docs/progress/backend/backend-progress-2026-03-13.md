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

## 卡點

- 無。

## To Do

- 前端可將三列篩選（品項）改接 `GET /categories` 與 `GET /products?categoryId=`。
- 若未來需品牌主檔，可擴充 Prisma schema（Brand）並實作 `GET /brands`。
- 前後端串接後可視需求補全端 E2E（登入 → 加商品 → 結帳 → 查訂單）。

## 本日變更紀錄

- （僅追加、不刪不改。每次更新當日進度時在此追加一筆，例如：`- 14:30 更新：…`）
- 更新：新增 GET /categories（CategoryModule）、GET /products 支援 categoryId 篩選與回傳；今日完成與 To Do 已改寫；backend-module-design 已更新。
