# 任務：訂單明細頁顯示實收金額與收款方式

> 整合計畫來源：訂單明細顯示實收與收款方式（2026-03-13）  
> 執行順序：**後端先完成 → 前端接續**（後端 API 合約變更需先定案）

---

## 一、需求摘要

在訂單明細頁（`/pos/orders/:id`）目前僅顯示「應收金額」，需新增：
- **實收金額**：實際收取的金額（= payments 總和）
- **收款方式**：支付方式列表（如現金、刷卡、轉帳）

### 現況

- 建立訂單時前端已送出 `payments[]`，後端驗證總和 = 應收後寫入庫存與金流，**但未持久化 payments**。
- `GET /pos/orders/:id` 回應不含 `payments`，`PosOrderDetail` 僅有 `items`、`totalAmount`。

---

## 二、後端 Agent 指令

### 2.1 前置閱讀

在開始前，請依序閱讀：
- [docs/progress/README.md](../progress/README.md) — 進度入口
- [docs/collaboration-rules-backend-frontend.md](../collaboration-rules-backend-frontend.md) — 協作規則
- [docs/api-design-pos.md](../api-design-pos.md) — POS API 合約
- [docs/backend-module-design.md](../backend-module-design.md) — 模組設計

### 2.2 任務內容

1. **Schema**：在 [backend/prisma/schema.prisma](../../backend/prisma/schema.prisma) 新增 `PosOrderPayment` model，欄位：`id`、`orderId`、`method`、`amount`；`PosOrder` 建立對應關聯。執行 `prisma migrate dev` 產生 migration。

2. **Repository**：在 [backend/src/modules/pos/infrastructure/pos.repository.ts](../../backend/src/modules/pos/infrastructure/pos.repository.ts)：
   - `createOrder` 接收並儲存 `payments`，與訂單一併建立 `PosOrderPayment` 紀錄
   - `findById` 查詢時 `include: { items: true, payments: true }`

3. **Service**：在 [backend/src/modules/pos/application/pos.service.ts](../../backend/src/modules/pos/application/pos.service.ts)：
   - `createOrder` 將 `input.payments` 傳給 repository
   - `toOrderDetail` 回傳 `payments: [{ method, amount }]`（number 型態）

4. **API 規格**：在 [docs/api-design-pos.md](../api-design-pos.md) 更新 `PosOrderDetail`，補上 `payments: Array<{ method: string; amount: number }>`，並說明實收金額 = `payments` 總和。

5. **測試**：若 [pos-create-order.integration-spec.ts](../../backend/src/modules/pos/pos-create-order.integration-spec.ts) 有斷言 response 結構，請更新以包含 `payments`。

### 2.3 注意事項

- 既有訂單無 `PosOrderPayment` 紀錄屬預期；`payments` 為空陣列時，前端會以應收金額作為 fallback。
- 不破壞既有 `POST /pos/orders`、`GET /pos/orders` 合約；僅在 `GET /pos/orders/:id` 回應中**新增** `payments` 欄位。

### 2.4 完成後

- 更新 [docs/progress/backend/backend-progress-YYYY-MM-DD.md](../progress/backend/backend-progress-2026-03-13.md) 與 [docs/progress/README.md](../progress/README.md)。

---

## 三、前端 Agent 指令

### 3.1 前置條件

- **後端需已實作完成**：`GET /pos/orders/:id` 回應已包含 `payments: Array<{ method: string; amount: number }>`。
- 若後端尚未完成，請暫緩執行，或先以 mock 結構開發 UI（結構與文件一致）。

### 3.2 前置閱讀

在開始前，請依序閱讀：
- [docs/progress/README.md](../progress/README.md) — 進度入口
- [docs/collaboration-rules-backend-frontend.md](../collaboration-rules-backend-frontend.md) — 協作規則
- [docs/api-design-pos.md](../api-design-pos.md) — POS API 合約（含 `PosOrderDetail.payments`）
- [docs/backend-error-format.md](../backend-error-format.md) — 錯誤格式

### 3.3 任務內容

1. **型別**：在 [frontend/src/modules/pos/posOrdersMockService.ts](../../frontend/src/modules/pos/posOrdersMockService.ts) 更新 `PosOrderDetail`，新增 `payments?: Array<{ method: string; amount: number }>`（可選以相容舊回應）。

2. **頁面 UI**：在 [frontend/src/pages/PosOrderDetailPage.tsx](../../frontend/src/pages/PosOrderDetailPage.tsx)：
   - 在「應收金額」下方（或適當位置）新增：
     - **實收金額**：`order.payments?.reduce((s, p) => s + p.amount, 0) ?? order.totalAmount`
     - **收款方式**：依 `payments` 顯示，如「現金 $400」或「現金 $200、轉帳 $200」

3. **method 對照**：建議 mapping：CASH→現金、CARD→刷卡、TRANSFER→轉帳、EWALLET→電子支付，其餘顯示原值。

4. **舊資料相容**：`payments` 為空或 undefined 時，實收金額顯示應收金額，收款方式顯示「—」或「無紀錄」。

### 3.4 完成後

- 更新 [docs/progress/frontend/frontend-progress-pos-YYYY-MM-DD.md](../progress/frontend/frontend-progress-pos-2026-03-13.md) 與 [docs/progress/README.md](../progress/README.md)。

---

## 四、複製貼上用指令（給 Owner）

### 4.1 指派後端 Agent

```
你是後端 Agent。請先閱讀 docs/progress/README.md、docs/collaboration-rules-backend-frontend.md、docs/api-design-pos.md、docs/backend-module-design.md。

任務：依 docs/tasks/TASK-order-detail-payments-2026-03-13.md 第二節「後端 Agent 指令」執行，為訂單明細 API 新增 payments 回傳（含 PosOrderPayment  schema、repository、service、API 規格更新）。完成後更新 docs/progress 進度檔。
```

### 4.2 指派前端 Agent

```
你是前端 Agent。請先閱讀 docs/progress/README.md、docs/collaboration-rules-backend-frontend.md、docs/api-design-pos.md。

任務：依 docs/tasks/TASK-order-detail-payments-2026-03-13.md 第三節「前端 Agent 指令」執行，在訂單明細頁顯示「實收金額」與「收款方式」。須確認後端 GET /pos/orders/:id 已回傳 payments 欄位；若尚未完成可先以 mock 或相容寫法實作。完成後更新 docs/progress 進度檔。
```

---

## 五、影響範圍總覽

| 層級 | 檔案 |
|------|------|
| Schema | `backend/prisma/schema.prisma` |
| Repository | `backend/src/modules/pos/infrastructure/pos.repository.ts` |
| Service | `backend/src/modules/pos/application/pos.service.ts` |
| API 規格 | `docs/api-design-pos.md` |
| 前端型別 | `frontend/src/modules/pos/posOrdersMockService.ts` |
| 前端頁面 | `frontend/src/pages/PosOrderDetailPage.tsx` |
