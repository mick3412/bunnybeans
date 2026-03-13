## Inventory / Finance API 設計

> 狀態：Inventory / Finance 寫入與查詢 API 已實作，相關 endpoint 標為 **stable**。  
> 讀者：後端 Agent、前端 Agent、人類開發者。

---

### 1. 範圍與目標

- **本文件範圍**
  - 庫存事件（InventoryEvent）與匯總（InventoryBalance）相關 API。
  - 金流事件（FinanceEvent）寫入 API（Phase 1 僅寫入，不提供查詢）。
- **與其他文件關係**
  - 不可變事件設計與備援概念：`docs/inventory-finance-immutability.md`。
  - 模組分層與服務介面：`docs/backend-module-design.md`。
  - 事件型別共用定義：`shared/src/index.ts`（`InventoryEvent`, `InventoryEventType`, `FinanceEvent`, `FinanceEventType`）。

---

### 2. 型別說明

#### 2.1 事件型別（shared）

> 下列型別已在 `shared/src/index.ts` 定義，這裡僅重申用途供 API 文件參考。  
> 實際欄位以 `shared/src/index.ts` 為準。

- `InventoryEventType`
  - `'PURCHASE_IN' | 'SALE_OUT' | 'RETURN_FROM_CUSTOMER' | 'RETURN_TO_SUPPLIER' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'STOCKTAKE_GAIN' | 'STOCKTAKE_LOSS'`
- `InventoryEvent`
  - 主要欄位：`id`, `occurredAt`, `type`, `productId`, `warehouseId`, `quantity`, `referenceId?`, `note?`。
- `FinanceEventType`
  - `'SALE_RECEIVABLE' | 'SALE_PAYMENT' | 'SALE_REFUND' | 'PURCHASE_PAYABLE' | 'PURCHASE_REBATE' | 'PURCHASE_RETURN' | 'ADJUSTMENT'`
- **`SALE_PAYMENT`**：銷售實收（POS 賒帳／部分付款時，每一筆 `payments[]` 一筆事件；`referenceId` = POS 訂單 id；`note` 可含收款方式）。與同單 `SALE_RECEIVABLE`（應收總額）並存，未收餘額 = 應收 − 各筆 `SALE_PAYMENT` 之和。
- `FinanceEvent`
  - 主要欄位：`id`, `occurredAt`, `type`, `partyId`, `currency`, `amount`, `taxAmount?`, `referenceId?`, `note?`。
- **已實作**：`SALE_PAYMENT` 由 POS 建單（`allowCredit: true` 時每筆初收）或 **`POST /pos/orders/:id/payments` 補款** 寫入；全額付清且未開賒帳時仍僅一筆 `SALE_RECEIVABLE`（與既有行為相容）。
- **`SALE_REFUND`**：由 **`POST /pos/orders/:id/refunds`** 寫入（Phase 1）；`referenceId` = 訂單 id，`amount` 為正；可退上限 = `sum(PosOrderPayment)` − 該單已存在之 `SALE_REFUND` 合計；**不**刪改既有事件，見 `erp-spec` 5.2.1、`inventory-finance-immutability`。
- **`RETURN_FROM_CUSTOMER`（POS）**：由 **`POST /pos/orders/:id/return-to-stock`** 寫入（Phase 2）；與該單建單時同一 `warehouseId`，`referenceId` = 訂單 id；累計退貨量不得超過原 `SALE_OUT` 量，見 `erp-spec` 5.2.2、api-design-pos §4.1d。

#### 2.2 匯總與列表型別（文件草稿）

```ts
// 庫存匯總（Projection），來源為 InventoryEvent 的累積結果
interface InventoryBalance {
  productId: string;
  warehouseId: string;
  onHandQty: number;
  updatedAt: string; // ISO datetime
}

// 通用分頁結果
interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
```

> `InventoryBalance` 與 `PagedResult<T>` 目前僅在文件中作為說明型別；實際 response 結構會依這個定義實作。

---

### 3. Endpoint 一覽

| Path                    | Method | 說明                             | 所屬模組   | 狀態   |
|-------------------------|--------|----------------------------------|------------|--------|
| `/inventory/events`     | POST   | 新增一筆庫存事件（append-only） | Inventory  | **stable** |
| `/inventory/balances`   | GET    | 查詢庫存匯總                     | Inventory  | **stable** |
| `/inventory/balances/enriched` | GET | 查詢庫存匯總（附 sku、name，需 warehouseId） | Inventory | **stable** |
| `/inventory/events`     | GET    | 查詢庫存事件歷史（分頁）        | Inventory  | **stable** |
| `/finance/events`       | GET    | 查詢金流事件（只讀、分頁／篩選） | Finance    | **stable** |
| `/finance/events`       | POST   | 新增一筆金流事件（append-only） | Finance    | **stable** |

---

### 4. Inventory API 詳細規格

#### 4.1 新增庫存事件

- **Method**：`POST`
- **Path**：`/inventory/events`
- **用途**：
  - 新增一筆庫存事件（不可變事件表），並同步更新對應 `InventoryBalance` 匯總。
  - 由 POS / 採購 / 退貨 / 盤點等模組呼叫，不直接給人工作業使用。
- **狀態**：**stable**（已實作）。
- **可選保護**：環境變數 **`ADMIN_API_KEY`** 若設定，須帶 **`X-Admin-Key`**（與 `POST/PATCH/DELETE /products` 相同）；未設定則不變。未帶或錯誤 → `401` **`ADMIN_API_KEY_REQUIRED`**。

**Request body（對齊 `InventoryEvent` 主要欄位）**

```json
{
  "productId": "uuid-of-product",
  "warehouseId": "uuid-of-warehouse",
  "type": "SALE_OUT",
  "quantity": 2,
  "occurredAt": "2026-03-13T10:00:00Z",
  "referenceId": "POS-20260313-0001",
  "note": "POS sale"
}
```

**成功回應（計畫結構）**

```json
{
  "event": {
    "id": "uuid-of-event",
    "productId": "uuid-of-product",
    "warehouseId": "uuid-of-warehouse",
    "type": "SALE_OUT",
    "quantity": 2,
    "occurredAt": "2026-03-13T10:00:00Z",
    "referenceId": "POS-20260313-0001",
    "note": "POS sale",
    "createdAt": "2026-03-13T10:00:01Z"
  },
  "balance": {
    "productId": "uuid-of-product",
    "warehouseId": "uuid-of-warehouse",
    "onHandQty": 98,
    "updatedAt": "2026-03-13T10:00:01Z"
  }
}
```

**錯誤情境（草案）**

- `400 INVENTORY_INVALID_INPUT`：欄位缺漏或格式錯誤。
- `404 PRODUCT_NOT_FOUND`：商品不存在。
- `404 WAREHOUSE_NOT_FOUND`：倉庫不存在。
- `409 INVENTORY_INSUFFICIENT`：不允許負庫存時，出現扣減超過目前庫存的情形。

---

#### 4.2 查詢庫存匯總

- **Method**：`GET`
- **Path**：`/inventory/balances`
- **用途**：查詢指定商品 / 倉庫的即時庫存結餘，供 POS 與後台顯示。
- **狀態**：**stable**（已實作）。

**Query 參數**

- `productId`：可重複多次，例如 `?productId=a&productId=b`。
- `warehouseId`：可重複多次。

**成功回應（對齊 `InventoryBalance[]`）**

```json
[
  {
    "productId": "uuid-of-product",
    "warehouseId": "uuid-of-warehouse",
    "onHandQty": 100,
    "updatedAt": "2026-03-13T10:00:01Z"
  }
]
```

#### 4.2b 查詢庫存匯總（後台 enriched）

- **Method**：`GET`
- **Path**：`/inventory/balances/enriched`
- **Query**：`warehouseId`（必填，單一倉庫 UUID）
- **用途**：後台餘額表一次取得 sku／name，無需再對每筆 productId 打 GET /products/:id
- **狀態**：**stable**

**成功回應** `200` — `Array<{ productId, warehouseId, onHandQty, updatedAt, sku, name }>`（sku/name 若商品已刪則可為 null）

**錯誤**：`400 INVENTORY_INVALID_INPUT`（缺 warehouseId）；`404 INVENTORY_WAREHOUSE_NOT_FOUND`

---

#### 4.3 查詢庫存事件歷史

- **Method**：`GET`
- **Path**：`/inventory/events`
- **用途**：提供後台查詢特定商品 / 倉庫的歷史異動明細，用於稽核或除錯。
- **狀態**：**stable**（已實作）。

**Query 參數**

- `productId?`
- `warehouseId?`
- `type?`（`InventoryEventType`）
- `from?` / `to?`（ISO datetime）
- `page?`（預設 `1`）
- `pageSize?`（預設 `50`）

**成功回應（`PagedResult<InventoryEvent>`）**

```json
{
  "items": [
    {
      "id": "uuid-of-event",
      "productId": "uuid-of-product",
      "warehouseId": "uuid-of-warehouse",
      "type": "SALE_OUT",
      "quantity": 2,
      "occurredAt": "2026-03-13T10:00:00Z",
      "referenceId": "POS-20260313-0001",
      "note": "POS sale",
      "createdAt": "2026-03-13T10:00:01Z"
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 1
}
```

---

### 5. Finance API 詳細規格

#### 5.0 查詢金流事件（只讀）

- **Method**：`GET`
- **Path**：`/finance/events`
- **用途**：報表／稽核前置；**只讀**，不變更事件表。
- **狀態**：**stable**（已實作）。

**Query（皆選填）**

- `partyId`：精確比對（與寫入時一致；空字串可視為未指定對象之列）。
- `referenceId`：精確比對（例如 POS 訂單 id）。
- `type`：`FinanceEventType`。
- `from` / `to`：`occurredAt` 區間（ISO）。
- `page`（預設 `1`）、`pageSize`（預設 `50`，上限 `100`）。

**成功回應** `200` — `PagedResult<FinanceEvent>`（與 POST 成功單筆欄位一致；`amount`／`taxAmount` 為數字）

**錯誤**：`400 FINANCE_LIST_PAGE_INVALID`（page／pageSize 非法）。

---

#### 5.1 新增金流事件

- **Method**：`POST`
- **Path**：`/finance/events`
- **用途**：
  - 由 POS / 採購 / 應收應付模組寫入金流事件。
- **狀態**：**stable**（已實作）。

**Request body（對齊 `FinanceEvent` 主要欄位）**

```json
{
  "type": "SALE_RECEIVABLE",
  "partyId": null,
  "currency": "TWD",
  "amount": 600,
  "taxAmount": 0,
  "occurredAt": "2026-03-13T10:00:00Z",
  "referenceId": "POS-20260313-0001",
  "note": "POS sale"
}
```

**成功回應（`FinanceEvent`）**

```json
{
  "id": "uuid-of-finance-event",
  "type": "SALE_RECEIVABLE",
  "partyId": null,
  "currency": "TWD",
  "amount": 600,
  "taxAmount": 0,
  "occurredAt": "2026-03-13T10:00:00Z",
  "referenceId": "POS-20260313-0001",
  "note": "POS sale",
  "createdAt": "2026-03-13T10:00:01Z"
}
```

**錯誤情境（草案）**

- `400 FINANCE_INVALID_INPUT`：欄位錯誤。
- `400 FINANCE_UNSUPPORTED_TYPE`：未支援的 `FinanceEventType`。

---

### 6. 資料一致性與限制（與不可變性設計對齊）

- **事件表為唯一事實來源**
  - `InventoryEvent` / `FinanceEvent` 不允許透過 API 進行 `UPDATE` / `DELETE`。
  - 所有修正皆需透過新增補償事件完成。
- **匯總表為投影**
  - `InventoryBalance` 僅能由後端服務根據事件重算或 incremental 更新。
  - 不提供直接更新匯總表的 API。
- **跨模組存取規則**
  - POS / Purchase / Stocktake 等模組：
    - 若要異動庫存，只能呼叫 `InventoryService.recordInventoryEvent` 或 `/inventory/events`。
    - 若要紀錄應收 / 應付，只能呼叫 `FinanceService.recordFinanceEvent` 或 `/finance/events`。

---

### 7. 與現有實作的關係（2026-03 現況）

- Prisma schema：
  - `InventoryEvent`, `InventoryBalance`, `FinanceEvent` 已定義於 `backend/prisma/schema.prisma`。
- Backend：
  - `InventoryModule` / `FinanceModule` 已實作 Service、Controller、Repository；Inventory 事件為 append-only，匯總由 Service 更新。
- 前端：
  - 目前尚未直接呼叫 Inventory / Finance 相關 API，之後可依本文件先實作 mock，再接上正式 API。

