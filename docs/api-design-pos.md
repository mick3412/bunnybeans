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
  method: string; // "CASH" | "CARD" | "EWALLET" | "TRANSFER" 等
  amount: number;
}
// method 支援值說明：
// - CASH：現金
// - CARD：刷卡
// - EWALLET：電子支付
// - TRANSFER：轉帳（現場已確認轉帳成功，報表歸類為「轉帳收款」，不計入現金；實收仍計入該銷售單應收結清）

// 建立 POS 銷售單的 Request 結構
interface CreatePosOrderRequest {
  storeId: string;
  occurredAt?: string; // ISO datetime
  items: PosOrderItemInput[];
  payments: PosPaymentInput[];
  customerId?: string | null;
  /** 選填；依電話查詢／綁定 Customer（前端可單一欄位自動辨識後帶入） */
  customerPhone?: string | null;
  /** 選填；依 email 查詢／綁定 Customer */
  customerEmail?: string | null;
  /**
   * 為 true：賒帳／部分付款。規則：
   * - 掛帳時須能解析到一筆客戶：`customerId`（UUID），或 `customerPhone`／`customerEmail`（同 merchant 內唯一）
   * - sum(payments[].amount) <= totalAmount（可為 0 全賒）
   * - 金流：一筆 SALE_RECEIVABLE(應收總額) + 每筆實收一筆 SALE_PAYMENT
   * 未帶或 false：與先前相同，sum(payments) 須等於訂單總額
   */
  allowCredit?: boolean;
}

// 若帶 customerId：須為該門市所屬商家（Merchant）底下之 Customer；通過驗證後寫入 PosOrder.customerId。
// 賒帳 allowCredit: true 時須帶 customerId 或可唯一對應的 customerPhone／customerEmail。

// POS 銷售單摘要（列表用）
interface PosOrderSummary {
  id: string;
  orderNumber: string;
  storeId: string;
  totalAmount: number;
  createdAt: string; // ISO datetime
  /** 訂單掛載之客戶 id；未掛客戶為 null */
  customerId: string | null;
  /** 客戶名稱；未掛客戶為 null */
  customerName: string | null;
}

// POS 銷售單明細（單筆查詢用；POST 建單成功回應亦同結構）
interface PosOrderDetail extends PosOrderSummary {
  items: {
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
  }[];
  /** 已收列；實收 = paidAmount。賒帳單可為部分或空 */
  payments: Array<{ method: string; amount: number }>;
  /** 實收合計，等同 sum(payments) */
  paidAmount: number;
  /** 未收餘額 = totalAmount - paidAmount（>=0） */
  remainingAmount: number;
  /** true 表示仍有未收（remainingAmount > 0） */
  credit: boolean;
  /** 客戶代碼；明細專用；未掛或無 code 為 null */
  customerCode: string | null;
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
| `/pos/orders/:id/payments` | POST | 對既有訂單追加一筆收款（補款） | **stable** |
| `/pos/orders/:id/refunds` | POST | 對既有訂單登記一筆退款（`SALE_REFUND`） | **stable** |
| `/pos/orders/:id/returns/stock` | POST | 依訂單明細沖銷入庫（`RETURN_FROM_CUSTOMER`） | **stable** |
| `/pos/orders/:id/return-to-stock` | POST | 同上（相容舊路徑） | **stable** |

---

### 4. Endpoint 詳細規格

#### 4.1 建立 POS 銷售單

- **Method**：`POST`
- **Path**：`/pos/orders`
- **用途**：建立一筆銷售單，並在 Application 層觸發：
  - 建立 `PosOrder`（可選 **`customerId`**，與門市同 Merchant 之 Customer）/ `PosOrderItem` / `PosOrderPayment`（持久化 `payments[]`）。
  - 透過 `InventoryService` 寫入 `SALE_OUT` 類型的 `InventoryEvent`，更新 `InventoryBalance`。
  - 透過 `FinanceService` 寫入金流：一般單一筆 `SALE_RECEIVABLE`；**賒帳**（`allowCredit: true`）時再加多筆 `SALE_PAYMENT`（每筆實收）。
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
  "customerId": null,
  "allowCredit": false
}
```

**賒帳範例**（應收 600、先收 200 現金；`customerId` 為客戶／會員 UUID）

```json
{
  "storeId": "uuid-of-store",
  "items": [{ "productId": "uuid-of-product", "quantity": 2, "unitPrice": 300 }],
  "payments": [{ "method": "CASH", "amount": 200 }],
  "customerId": "uuid-of-customer",
  "allowCredit": true
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
  ],
  "payments": [{ "method": "CASH", "amount": 600 }],
  "paidAmount": 600,
  "remainingAmount": 0,
  "credit": false
}
```

**錯誤情境（實際回傳）**

- `400 Bad Request`：`items must not be empty`（`POS_ITEMS_EMPTY`）；未開賒帳時付款須全額（`POS_PAYMENT_MISMATCH`）；賒帳無法解析客戶（`POS_CREDIT_REQUIRES_CUSTOMER`，須 `customerId` 或同一 merchant 下唯一對應的 `customerPhone`／`customerEmail`）；多筆客戶同號（`POS_CREDIT_CUSTOMER_LOOKUP_AMBIGUOUS`）；賒帳實收超過應收（`POS_PAYMENT_EXCEEDS_TOTAL`）；付款金額非法（`POS_PAYMENT_AMOUNT_INVALID`）；`Store has no warehouse configured for inventory`（`POS_STORE_NO_WAREHOUSE`）。
- `404 Not Found`：`Store not found`（`POS_STORE_NOT_FOUND`）、`Product not found: <id>`（`POS_PRODUCT_NOT_FOUND`）、`Order not found`（`POS_ORDER_NOT_FOUND`）、客戶不存在或不屬該門市商家（`POS_CUSTOMER_NOT_FOUND`）、賒帳依手機／Email 查無客戶（`POS_CREDIT_CUSTOMER_NOT_FOUND`）。
- `409 Conflict`：`Insufficient inventory for product <id>: required <n>, on hand <m>`（code: `INVENTORY_INSUFFICIENT`）。

> 錯誤回應由全域 `HttpExceptionFilter` 統一為 `statusCode`、`message`、`error`、`code`、`traceId`，見 `docs/backend-error-format.md`。

---

#### 4.1b 補款（對既有訂單追加收款）

- **Method**：`POST`
- **Path**：`/pos/orders/:id/payments`
- **用途**：未收餘額 &gt; 0 時再收一筆；寫入 `PosOrderPayment` 並追加 **`SALE_PAYMENT`**（`partyId` 與該單之 `SALE_RECEIVABLE` 相同）。
- **狀態**：**stable**（已實作）。

**Request body**

```json
{
  "method": "CASH",
  "amount": 50,
  "occurredAt": "2026-03-13T15:00:00Z"
}
```

- `method`（必填）、`amount`（必填，&gt; 0）、`occurredAt`（選填，預設當下）。

**規則**

- 訂單須存在；`paidAmount + amount <= totalAmount`；已結清（`remainingAmount <= 0`）→ `POS_ORDER_ALREADY_SETTLED`。
- 補款超過未收 → `POS_PAYMENT_EXCEEDS_REMAINING`。
- 找不到該單之 `SALE_RECEIVABLE`（極端舊資料）→ `POS_CREDIT_NO_RECEIVABLE`。

**成功回應**：與 `GET /pos/orders/:id` 相同之 `PosOrderDetail`（`201`）。

---

#### 4.1c 退款（沖帳金流，Phase 1）

- **Method**：`POST`
- **Path**：`/pos/orders/:id/refunds`
- **用途**：已實收範圍內登記退款，append **`SALE_REFUND`**；不改 `PosOrderPayment`；**不**自動退庫。
- **狀態**：**stable**（已實作）。

**Request body**

```json
{
  "amount": 50,
  "occurredAt": "2026-03-13T16:00:00Z",
  "note": "optional"
}
```

- `amount`（必填，&gt; 0）；`occurredAt`、`note` 選填。

**規則**

- 訂單須存在；須有 `SALE_RECEIVABLE`（`partyId`）。
- 已入帳實收 = `sum(PosOrderPayment)`；若為 0 → `POS_REFUND_NO_PAYMENT`（全賒未收不可退現）。
- 已退合計 = 該單 `SALE_REFUND` 之和；`amount > 實收 − 已退`（0.01 容差）→ `POS_REFUND_EXCEEDS_PAID`。

**成功回應**：與 `GET /pos/orders/:id` 相同之 `PosOrderDetail`（`201`）。明細之 `paidAmount` 仍為實收列合計；淨收由報表匯總 `SALE_REFUND`。

---

#### 4.1d 退貨入庫（Phase 2，erp-spec 5.2.2）

- **Method**：`POST`
- **Path**：`/pos/orders/:id/returns/stock`（**建議**）；相容 `/pos/orders/:id/return-to-stock`
- **用途**：依原訂單扣庫倉 append **`RETURN_FROM_CUSTOMER`**，不回沖金流（退款仍用 §4.1c）。
- **狀態**：**stable**（已實作）。

**Request body**

```json
{
  "items": [{ "productId": "uuid", "quantity": 1 }],
  "occurredAt": "2026-03-13T17:00:00Z"
}
```

- `items`（必填，非空）：每筆 `productId` 須出現在該訂單 `items`；`quantity` 為正整數。
- 同一訂單累計退貨量（含本次）不可超過該品項原銷售量；`occurredAt` 選填。

**錯誤**：`POS_ORDER_NOT_FOUND`、`POS_RETURN_ITEMS_EMPTY`、`POS_RETURN_PRODUCT_NOT_ON_ORDER`、`POS_RETURN_EXCEEDS_SOLD`。

**成功回應**：與 `GET /pos/orders/:id` 相同之 `PosOrderDetail`（`201`）。

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
      "createdAt": "2026-03-13T10:00:01Z",
      "customerId": "uuid-or-null",
      "customerName": "客戶名稱或 null"
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
- **用途**：查詢單筆銷售單詳情，供 POS「查看明細」或後台查詢（含實收與收款方式）。
- **狀態**：**stable**（已實作）。

**成功回應（結構同 `PosOrderDetail`）**

```json
{
  "id": "uuid-of-order",
  "orderNumber": "POS-20260313-0001",
  "storeId": "uuid-of-store",
  "customerId": "uuid-or-null",
  "customerName": "客戶名稱或 null",
  "customerCode": "C001 或 null",
  "totalAmount": 600,
  "createdAt": "2026-03-13T10:00:01Z",
  "items": [
    {
      "id": "uuid-of-item",
      "productId": "uuid-of-product",
      "quantity": 2,
      "unitPrice": 300
    }
  ],
  "payments": [
    { "method": "CASH", "amount": 400 },
    { "method": "TRANSFER", "amount": 200 }
  ],
  "paidAmount": 600,
  "remainingAmount": 0,
  "credit": false
}
```

> 列表 `GET /pos/orders` 仍不含 `payments`／`paidAmount`／`credit`／`customerCode`（摘要僅 `customerId`、`customerName`）。明細含 `customerCode`。舊訂單無付款列時 `payments: []`、`paidAmount: 0`、`remainingAmount` 等於 `totalAmount`、`credit: true`（視為歷史賒帳或未紀錄實收，前端可再與營運確認）。

---

### 5. 測試說明（Testing guidance）

**資料前置條件**

- 可依 `docs/db-seed.md` 執行 `pnpm db:seed`，會建立 M001 / S001 / W001、14 筆商品與庫存。
- 或手動建立：至少一個 Merchant、Store（須關聯 Warehouse）、Product，且該 Product 在該 Warehouse 有庫存（`POST /inventory/events`，`type: "PURCHASE_IN"`）。
- 取得 `storeId`、`productId`：`GET /stores`、`GET /products` 回傳的 `id` 欄位；seed 執行完成後終端也會印出部分 id。
- **`GET /stores`** 回傳每筆含 **`warehouseIds: string[]`**（該門市底下 `storeId` 指向本門市之倉庫）。POS 前端應優先選 **至少一間倉** 的門市為預設 `storeId`，否則建單會 **400 `POS_STORE_NO_WAREHOUSE`**。

**POST /pos/orders 範例**

```bash
# 使用 shell 變數（先以 GET /stores、GET /products 取得 id，或從 seed 輸出複製）
curl -X POST http://localhost:3003/pos/orders \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "'"$STORE_ID"'",
    "items": [{"productId": "'"$PRODUCT_ID"'", "quantity": 1, "unitPrice": 100}],
    "payments": [{"method": "CASH", "amount": 100}]
  }'
```

預期回應：`201`，body 含 `id`、`orderNumber`、`storeId`、`totalAmount`、`items`、`payments`、`paidAmount`、`remainingAmount`、`credit`、`createdAt`。

**含 TRANSFER 的付款範例**（CASH + TRANSFER 合計等於訂單總額即可）：

```bash
# 訂單總額 200，一半現金、一半轉帳
curl -X POST http://localhost:3003/pos/orders \
  -H "Content-Type: application/json" \
  -d '{
    "storeId": "'"$STORE_ID"'",
    "items": [{"productId": "'"$PRODUCT_ID"'", "quantity": 2, "unitPrice": 100}],
    "payments": [
      {"method": "CASH", "amount": 100},
      {"method": "TRANSFER", "amount": 100}
    ]
  }'
```

**GET /pos/orders 範例**

```bash
# 無 query：取得最近訂單（預設 page=1, pageSize=50）
curl "http://localhost:3003/pos/orders"

# 帶分頁與篩選
curl "http://localhost:3003/pos/orders?storeId=$STORE_ID&from=2026-03-01&to=2026-03-31&page=1&pageSize=10"
```

回傳：`{ items: PosOrderSummary[], page, pageSize, total }`。

**GET /pos/orders/:id 範例**

```bash
curl "http://localhost:3003/pos/orders/<ORDER_ID>"
```

回傳結構同 `PosOrderDetail`，含 `items`、`payments` 明細。

**錯誤範例**（付款總額不符）

```bash
# 訂單總額 100，但 payments 僅 50 → 400 Bad Request
curl -X POST http://localhost:3003/pos/orders \
  -H "Content-Type: application/json" \
  -d '{"storeId":"'$STORE_ID'","items":[{"productId":"'$PRODUCT_ID'","quantity":1,"unitPrice":100}],"payments":[{"method":"CASH","amount":50}]}'
```

回傳示例：`{ "statusCode": 400, "message": "Payments total must equal order total amount", "code": "POS_PAYMENT_MISMATCH", "error": "Bad Request", "traceId": "..." }`，詳見 `docs/backend-error-format.md`。

---

### 6. 與現有實作的關係（2026-03 現況）

- DB schema：
  - `PosOrder` / `PosOrderItem` / **`PosOrderPayment`**（`method`、`amount`，與訂單一併建立）已在 `backend/prisma/schema.prisma` 中定義。
- Backend 程式碼：
  - `PosModule`：建單寫入 `PosOrder`、`PosOrderPayment`、`InventoryEvent`（SALE_OUT）。金流：一般 **SALE_RECEIVABLE**；**`allowCredit: true`** 時另寫 **SALE_PAYMENT**（每筆實收）。庫存仍於建單時扣減（與是否付清無關）。門市須至少一個 Warehouse；若多倉掛同門市，後端會選**第一個能滿足整單各品項庫存**的倉扣庫（避免誤用無存量測試倉）。
- 前端：
  - 可依本文件將 mock 切換為真實 `POST /pos/orders`、`GET /pos/orders`、`GET /pos/orders/:id`。

