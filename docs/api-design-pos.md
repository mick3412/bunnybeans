## POS API 設計（POS Orders）

> 狀態：POS Orders 相關 endpoint 已實作，標為 **stable**。  
> 讀者：前端 Agent、後端 Agent、人類開發者。

---

### 1. 範圍與目標

- **本文件範圍**
  - POS 銷售單（Order）建立與查詢相關 API。
  - 目前僅涵蓋「單一銷售單」流程，不含退貨 / 換貨。
- **與其他文件關係**
  - 庫存與金流細節請參考 `docs/api-design-inventory-finance.md` 與 `docs/inventory-finance-immutability.md`。
  - 資料分層與模組邊界請參考 `docs/backend-module-design.md` 與 `DEVELOPMENT-GUIDELINES.md`。

---

### 2. 共用型別與 DTO（文件層級草稿）

> 下列為文件用 TypeScript 介面，用來描述 API 結構。  
> 若未來需要前後端共用，會再搬到 `shared/src/index.ts`。

```ts
// 單筆銷售明細
interface PosOrderItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

// 單筆付款資訊（Phase 1 先以字串 method 表示）
interface PosPaymentInput {
  method: string; // e.g. "CASH" | "CARD" | "EWALLET"
  amount: number;
}

// 建立 POS 銷售單的 Request 結構
interface CreatePosOrderRequest {
  storeId: string;
  occurredAt: string; // ISO datetime
  items: PosOrderItemInput[];
  payments: PosPaymentInput[];
  customerId?: string | null;
}

// POS 銷售單摘要（列表用）
interface PosOrderSummary {
  id: string;
  orderNumber: string;
  storeId: string;
  totalAmount: number;
  createdAt: string; // ISO datetime
}

// POS 銷售單明細（單筆查詢用）
interface PosOrderDetail extends PosOrderSummary {
  items: {
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
  }[];
}

interface PosOrderListResponse {
  items: PosOrderSummary[];
  page: number;
  pageSize: number;
  total: number;
}
```

---

### 3. Endpoint 一覽

| Path               | Method | 說明                            | 狀態   |
|--------------------|--------|---------------------------------|--------|
| `/pos/orders`      | POST   | 建立一筆 POS 銷售單             | **stable** |
| `/pos/orders`      | GET    | 取得 POS 銷售單列表（分頁）     | **stable** |
| `/pos/orders/:id`  | GET    | 取得單筆 POS 銷售單明細         | **stable** |

---

### 4. Endpoint 詳細規格

#### 4.1 建立 POS 銷售單

- **Method**：`POST`
- **Path**：`/pos/orders`
- **用途**：建立一筆銷售單，並在 Application 層觸發：
  - 建立 `PosOrder` / `PosOrderItem`。
  - 透過 `InventoryService` 寫入 `SALE_OUT` 類型的 `InventoryEvent`，更新 `InventoryBalance`。
  - 透過 `FinanceService` 寫入 `SALE_RECEIVABLE` 類型的 `FinanceEvent`。
- **狀態**：**stable**（已實作）。

**Request body（對齊 `CreatePosOrderRequest`）**

```json
{
  "storeId": "uuid-of-store",
  "occurredAt": "2026-03-13T10:00:00Z",
  "items": [
    { "productId": "uuid-of-product", "quantity": 2, "unitPrice": 300 }
  ],
  "payments": [
    { "method": "CASH", "amount": 600 }
  ],
  "customerId": null
}
```

**成功回應（計畫結構，實作時會再確認）**

```json
{
  "id": "uuid-of-order",
  "orderNumber": "POS-20260313-0001",
  "storeId": "uuid-of-store",
  "totalAmount": 600,
  "createdAt": "2026-03-13T10:00:01Z",
  "items": [
    {
      "id": "uuid-of-item",
      "productId": "uuid-of-product",
      "quantity": 2,
      "unitPrice": 300
    }
  ]
}
```

**錯誤情境（實際回傳）**

- `400 Bad Request`：`items must not be empty`、`Payments total must equal order total amount`、`Store has no warehouse configured for inventory`。
- `404 Not Found`：`Store not found`、`Product not found: <id>`、`Order not found`。
- `409 Conflict`：`Insufficient inventory for product <id>: required <n>, on hand <m>`。

> 錯誤回應目前為 NestJS 預設格式（`statusCode`、`message`、`error`）；未來將由全域 Exception Filter 統一為 `code` + `message` + `traceId`。

---

#### 4.2 查詢 POS 銷售單列表

- **Method**：`GET`
- **Path**：`/pos/orders`
- **用途**：提供 POS 歷史紀錄、後台報表的基本列表查詢。
- **狀態**：**stable**（已實作）。

**Query 參數**

- `storeId?`：過濾指定門市。
- `from?`：起始時間（ISO datetime）。
- `to?`：結束時間（ISO datetime）。
- `page?`：頁碼（預設 `1`）。
- `pageSize?`：每頁筆數（預設 `50`）。

**成功回應（計畫結構）**

```json
{
  "items": [
    {
      "id": "uuid-of-order",
      "orderNumber": "POS-20260313-0001",
      "storeId": "uuid-of-store",
      "totalAmount": 600,
      "createdAt": "2026-03-13T10:00:01Z"
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 1
}
```

---

#### 4.3 查詢單筆 POS 銷售單

- **Method**：`GET`
- **Path**：`/pos/orders/:id`
- **用途**：查詢單筆銷售單詳情，供 POS「查看明細」或後台查詢。
- **狀態**：**stable**（已實作）。

**成功回應（結構同 `PosOrderDetail`）**

```json
{
  "id": "uuid-of-order",
  "orderNumber": "POS-20260313-0001",
  "storeId": "uuid-of-store",
  "totalAmount": 600,
  "createdAt": "2026-03-13T10:00:01Z",
  "items": [
    {
      "id": "uuid-of-item",
      "productId": "uuid-of-product",
      "quantity": 2,
      "unitPrice": 300
    }
  ]
}
```

---

### 5. 測試說明

**前置資料（需先建立）**

- 至少一個 **Merchant**（`POST /merchants` 或透過 seed）。
- 至少一個 **Store**，且該門市必須有關聯的 **Warehouse**（`storeId` 指向此 Store）。建立方式：`POST /stores`、`POST /warehouses`（body 內 `storeId` 填該門市 id）。
- 至少一個 **Product**（`POST /products`）。
- 該 Product 在該 Warehouse 下有庫存：呼叫 `POST /inventory/events`，`type: "PURCHASE_IN"`，`productId` / `warehouseId` / `quantity` 填對應 id 與數量。

**最小 curl 範例（建立一筆 POS 訂單）**

```bash
# 假設 STORE_ID、WAREHOUSE_ID、PRODUCT_ID 已取得，且該商品在該倉庫已有庫存
curl -X POST http://localhost:3003/pos/orders \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "'"$STORE_ID"'",
    "occurredAt": "2026-03-13T10:00:00Z",
    "items": [{"productId": "'"$PRODUCT_ID"'", "quantity": 1, "unitPrice": 100}],
    "payments": [{"method": "CASH", "amount": 100}]
  }'
```

**查詢列表與單筆**

```bash
curl "http://localhost:3003/pos/orders?page=1&pageSize=10"
curl "http://localhost:3003/pos/orders/<ORDER_ID>"
```

---

### 6. 與現有實作的關係（2026-03 現況）

- DB schema：
  - `PosOrder` / `PosOrderItem` 已在 `backend/prisma/schema.prisma` 中定義。
- Backend 程式碼：
  - `PosModule` 已實作 `PosService`、`PosController`、`PosRepository`；建立訂單時會依序寫入 `PosOrder`、`InventoryEvent`（SALE_OUT）、`FinanceEvent`（SALE_RECEIVABLE）。門市需至少關聯一個 Warehouse 作為銷售扣庫倉庫。
- 前端：
  - 可依本文件將 mock 切換為真實 `POST /pos/orders`、`GET /pos/orders`、`GET /pos/orders/:id`。

