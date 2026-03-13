## ERP API 設計與介面合約

本文件作為前後端與不同 Agent 之間的**唯一 API 合約來源**。  
所有對外公開的後端 HTTP API，都需要在此先定義或更新，再進行實作與串接。

> 規則：
> - 若 API 尚未實作，在此標註狀態為 `draft`。
> - 一旦有前端或其他系統開始使用，狀態改為 `stable`，之後修改需保留相容性或標註版本。
> - 新增或調整 API 時，需同步更新 `shared` 中的對應型別（Request/Response DTO）。

---

## 1. 命名與通用約定

- 基礎 URL：`http://localhost:3003`（開發環境）
- 路徑以資源/動作為核心，而非畫面名稱：
  - 範例：`/inventory/events`, `/inventory/balance`, `/pos/checkout`
- 回傳格式：
  - 成功：`{ success: true, data: ... }`
  - 失敗：`{ success: false, code: string, message: string, traceId?: string }`
- 時間欄位一律使用 ISO 8601 UTC 字串（例如 `2026-03-12T18:12:31.348Z`）。

> 註：實際錯誤結構與封裝可在實作階段細化，這裡先以邏輯層級描述。

---

## 2. 健康檢查

### 2.1 `GET /health`（stable）

- **用途**：檢查後端服務是否正常運作，供前端與監控使用。
- **Request**
  - 無參數。
- **Response（範例）**

```json
{
  "status": "ok",
  "timestamp": "2026-03-12T18:12:31.348Z"
}
```

---

## 3. 庫存相關 API（Inventory）

> 狀態：`draft`。具體欄位需依 `shared` 中的 `InventoryEvent` 與 DB schema 完成後補齊。

### 3.1 `POST /inventory/events`（draft）

- **用途**：新增一筆庫存事件（例如進貨、銷售扣庫、退貨、盤點等），僅追加事件，不直接修改庫存數字。
- **Request Body**
  - 型別：`InventoryEvent`（定義於 `shared/src/index.ts`）
- **Response**
  - 成功：回傳該事件的基礎資訊（例如 `id`, `occurredAt`, `type` 等）。

### 3.2 `GET /inventory/balance`（draft）

- **用途**：查詢某商品在特定倉庫（或全倉）的目前庫存結餘。
- **Query Parameters（暫定）**
  - `productId`（必填）
  - `warehouseId`（選填，若省略則回傳所有倉庫的彙總）
- **Response（暫定）**
  - 結構示意：
    - `productId: string`
    - `balances: Array<{ warehouseId: string; quantity: number }>`

---

## 4. 金流相關 API（Finance）

> 狀態：`draft`。依 `FinanceEvent` 型別與會計邏輯補充。

### 4.1 `POST /finance/events`（draft）

- **用途**：新增一筆金流事件（如銷售應收、退款、進貨應付、退供折讓等）。
- **Request Body**
  - 型別：`FinanceEvent`（定義於 `shared/src/index.ts`）
- **Response**
  - 成功：回傳該事件的基礎資訊。

---

## 5. POS 流程相關 API（POS）

> 狀態：`draft`。未來 POS Flow 與後端整合時使用。

### 5.1 `POST /pos/checkout`（draft）

- **用途**：完成一筆門市收銀流程（建立銷售單、產生庫存與金流事件）。
- **Request Body**
  - 型別：`PosCheckoutRequest`（預計定義於 `shared/src/types/pos.ts` 或類似檔案）
  - 內容示意：
    - `items: Array<{ productId: string; quantity: number; unitPrice: number }>`
    - `customerId?: string`
    - `paymentMethods: Array<{ type: string; amount: number }>`
    - `storeId: string`
    - `operatorId: string`
- **Response**
  - 型別：`PosCheckoutResponse`（預計定義於 shared）
  - 內容示意：
    - `saleId: string`
    - `totalAmount: number`
    - `items: ...`
    - `createdAt: string`

---

## 6. 規則與流程備註

- 新增 API 前，請先在本文件增加對應小節，標註為 `draft`。
- API 一旦被前端或外部系統使用，請：
  - 將狀態改為 `stable`；
  - 若未來需要大改，優先考慮新增版本（例如 `/v2/...`）或向下相容調整。
- 變更任何 API 合約時，需同步更新：
  - `shared` 中的 DTO 型別；
  - 相關前端呼叫程式碼；
  - 測試案例（單元 / E2E）。

