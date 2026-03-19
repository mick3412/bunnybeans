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
| `/inventory/events/batch-stocktake` | POST | 多品多倉盤點（body warehouseId、lines[{ productId, actualQty }]；自動算差異寫 STOCKTAKE_GAIN/LOSS；Admin Key） | Inventory | **stable** |
| `/inventory/events/scan-stocktake` | POST | 掃碼盤點輸入流（先以 sku；後續可擴充 barcode）：body warehouseId、lines[{ sku, actualQty }]；後端解析 sku→productId 後走 batch-stocktake；Admin Key | Inventory | **stable** |
| `/inventory/import` | POST | 同 **`/inventory/events/import`**（CSV 盤點；單段 path 利於閘道／舊代理） | Inventory | **stable** |
| `/inventory/events/import` | POST | CSV 盤點調整（multipart **`file`**；**sku** + **warehouseCode** 或 **warehouseId** + **quantityDelta**；逐列 **STOCKTAKE_GAIN/LOSS**；**{ ok, failed, referenceId }**；1 萬列；Admin Key） | Inventory | **stable** |
| `/inventory/transfer`   | POST   | **原子調撥**（來源倉 TRANSFER_OUT + 目的倉 TRANSFER_IN，同一 transaction；與 events 相同須 **X-Admin-Key** 若已設） | Inventory | **stable** |
| `/inventory/balances`   | GET    | 查詢庫存匯總                     | Inventory  | **stable** |
| `/inventory/balances/enriched` | GET | 查詢庫存匯總（附 sku、name，需 warehouseId） | Inventory | **stable** |
| `/inventory/balances/export` | GET | 單倉庫存餘額 CSV（query **`warehouseId` 必填**；最多 1 萬列；UTF-8 BOM；**X-Admin-Key** 若已設；與 events/export 同 escape） | Inventory | **stable** |
| `/inventory/events`     | GET    | 查詢庫存事件歷史（分頁）        | Inventory  | **stable** |
| `/inventory/events/export` | GET | 庫存事件 CSV（最多 1 萬筆；**X-Admin-Key** 若已設） | Inventory | **stable** |
| `/inventory/slow-moving` | GET | 滯銷品（近 N 天銷量＜門檻且庫存＞門檻；query merchantId、warehouseId?、lookbackDays?、salesThreshold?、onHandThreshold?） | Inventory | **stable** |
| `/finance/events`       | GET    | 查詢金流事件（只讀、分頁／篩選） | Finance    | **stable** |
| `/finance/events/export` | GET | 金流事件 CSV（query 同 GET events；最多 1 萬列；BOM；**X-Admin-Key** 若已設） | Finance | **stable** |
| `/finance/events`       | POST   | 新增一筆金流事件（append-only） | Finance    | **stable** |
| `/finance/summary`     | GET    | 金流彙總（query：from、to、preset=last30d、**groupBy=type｜partyId｜day｜week**；回應 byType / byParty / trend） | Finance | **stable** |
| `/finance/balances`   | GET    | 應收／應付餘額（Phase 4；query **merchantId** 選填；**單一商家友善**：未傳 merchantId 且 DB 僅一筆 Merchant 時自動使用該 merchant；回傳 partyId、receivable、payable、**displayName?**、**kind?**；kind 篩選：`customer`｜`supplier`） | Finance | **stable** |

金流報表（GET /finance/events、GET /finance/summary）若未來對 `from`／`to` 做區間驗證，將與 POS 報表一致回傳 **`REPORT_INVALID_RANGE`**／**`REPORT_RANGE_TOO_LARGE`**，見 [backend-error-format.md](backend-error-format.md)。

#### 報表穿透（referenceId 跨模組連結）

- **FinanceEvent.referenceId**（報表穿透用）可對應：
  - **POS 訂單**：`SALE_RECEIVABLE`、`SALE_PAYMENT`、`SALE_REFUND` 之 referenceId = PosOrder.id；可依 `GET /finance/events?referenceId={orderId}` 查詢後，以該 id 打 `GET /pos/orders/:id` 取得訂單明細。
  - **驗收單**：`PURCHASE_PAYABLE`、`PURCHASE_RETURN` 之 referenceId = ReceivingNote.id；可連至採購驗收單詳情。
- **GET /finance/events**、**GET /finance/events/export** 皆回傳 `referenceId`，前端報表可依此提供「點擊穿透」至 POS 訂單或驗收單。

> **來源保證（stable）**：
> - `FinanceEvent.referenceId` **僅**會是 `PosOrder.id` 或 `ReceivingNote.id`（皆為 UUID）；不會回傳非 UUID 的 referenceId（若未來擴充其他來源，需在本段補規則或新增 resolve 端點）。

> **統一規則（stable）**：
> - referenceId 若為 **UUID**：
>   - 優先視為 **PosOrder.id**（可用 `GET /pos/orders/:id` 驗證；存在即 POS 訂單）
>   - 否則視為 **ReceivingNote.id**（可用 `GET /receiving-notes/:id` 驗證；存在即採購驗收單）
> - 目前系統內 **FinanceEvent.referenceId** 僅使用上述兩種 UUID；若未來引入其他來源，需在本段補上辨識規則或新增 resolve 端點。

---

### 4. Inventory API 詳細規格

#### 4.1b CSV 盤點匯入 `POST /inventory/events/import`（stable）

- **同實作短 URL**：**`POST /inventory/import`**（推薦本機 curl；與下列契約完全相同）。
- **Content-Type**：`multipart/form-data`；欄位 **`file`**（UTF-8，可 BOM）。
- **保護**：與 **`POST /inventory/events`** 相同 — **X-Admin-Key**（若已設 `ADMIN_API_KEY`）。
- **表頭（必填欄名，大小寫不拘）**：**`sku`**、**`quantityDelta`**；以及 **`warehouseCode`** 或 **`warehouseId`**（至少一欄）。
- **quantityDelta**：非 0 數字；**>0** → 一筆 **`STOCKTAKE_GAIN`**（與手動盤盈一致）；**<0** → **`STOCKTAKE_LOSS`**（盤虧）。每列成功時內部呼叫與單筆 **POST /inventory/events** 相同之 **`recordInventoryEvent`**（先 append **InventoryEvent** 再 upsert **InventoryBalance**）；**禁止**僅 UPDATE 餘額而不寫事件。
- **同批 referenceId**：本請求內成功列共用同一 **`referenceId`**（uuid），便於稽核；回傳體帶 **`referenceId`**。
- **列上限**：資料列最多 **10_000**（不含表頭）。
- **列級失敗**（不中斷後續列）：缺 sku／倉／商品不存在／delta 非法／扣庫不足等 → 列入 **`failed`**。
- **Response** `200`：`{ "ok": number, "failed": [{ "row": number, "reason": string }], "referenceId": string }`（**row** 為檔案列號，表頭第 1 列）。
- **錯誤**：**400** **`INVENTORY_IMPORT_HEADER`**／**`INVENTORY_IMPORT_TOO_MANY_ROWS`**；**400** **`INVENTORY_IMPORT_FILE_REQUIRED`**（未上傳 file）。

#### 4.1c 多品多倉盤點 `POST /inventory/events/batch-stocktake`（stable）

- **Method**：`POST`
- **Path**：`/inventory/events/batch-stocktake`
- **用途**：庫存頁支援多品多倉盤點；依 `actualQty` 與 `onHandQty` 差異，一鍵提交 STOCKTAKE_GAIN／STOCKTAKE_LOSS。
- **Body**：`{ warehouseId: string, lines: [{ productId: string, actualQty: number }] }`
- **邏輯**：依 `InventoryBalance` 取得各 productId+warehouseId 的 `onHandQty`；`delta = actualQty - onHandQty`；`delta > 0` → STOCKTAKE_GAIN(quantity=delta)；`delta < 0` → STOCKTAKE_LOSS(quantity=Math.abs(delta))；`delta === 0` 不寫入事件。
- **Response** `200`：`{ ok: number, failed: [{ lineIndex: number, reason: string }], referenceId: string }`
- **錯誤**：**400** **`INVENTORY_INVALID_INPUT`**（warehouseId 空、lines 空）；**404** **`INVENTORY_WAREHOUSE_NOT_FOUND`**
- **保護**：需 **X-Admin-Key**（同 POST /inventory/events）

#### 4.1d 掃碼盤點 `POST /inventory/events/scan-stocktake`（stable）

- **Method**：`POST`
- **Path**：`/inventory/events/scan-stocktake`
- **用途**：支援掃碼/輸入 sku 或 barcode 的盤點流程；後端會先解析 `sku`（欄位名保留，但可填 barcode）→productId，再以 batch-stocktake 的方式寫入 STOCKTAKE_GAIN／STOCKTAKE_LOSS。
- **Body**：`{ warehouseId: string, lines: [{ sku: string, actualQty: number }] }`（`sku` 欄位可填 barcode）
- **解析規則（stable）**
  - 先以 `Product.sku` 精確比對；找不到再以 `Product.barcode` 精確比對
  - 單筆無法解析時不會整體失敗，會回 `failed[]`：`{ lineIndex, reason: "unknown sku: <value>" }`
- **Response** `200`：`{ ok: number, failed: [{ lineIndex: number, reason: string }], referenceId: string }`
- **錯誤**：**400** **`INVENTORY_INVALID_INPUT`**（warehouseId 空、lines 空）；**404** **`INVENTORY_WAREHOUSE_NOT_FOUND`**
- **保護**：需 **X-Admin-Key**（同 POST /inventory/events）

---

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
  "referenceId": "uuid-of-pos-order",
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
    "referenceId": "uuid-of-pos-order",
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

#### 4.2 原子調撥 `POST /inventory/transfer`（stable）

- **Body**：`fromWarehouseId`、`toWarehouseId`、`productId`、`quantity`（正整數）、`note?`、`occurredAt?`。
- **行為**：同一 DB transaction 內寫入 `TRANSFER_OUT`（來源倉，數量為負）與 `TRANSFER_IN`（目的倉，數量為正），兩筆事件共用同一 `referenceId`（uuid），並更新兩倉 `InventoryBalance`。來源倉餘額不足 → `409 INVENTORY_INSUFFICIENT`。
- **錯誤**：`400 INVENTORY_TRANSFER_SAME_WAREHOUSE`（來源＝目的）；`400 INVENTORY_TRANSFER_INVALID`／`INVENTORY_TRANSFER_INVALID_QTY`；`404` 商品或倉不存在（`INVENTORY_PRODUCT_NOT_FOUND`、`INVENTORY_WAREHOUSE_NOT_FOUND`）。
- **保護**：與 `POST /inventory/events` 相同，若設 `ADMIN_API_KEY` 須 **X-Admin-Key**。

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

#### 4.2c 匯出庫存餘額 CSV `GET /inventory/balances/export`（stable）

- **Query**：`warehouseId`（必填，單一倉庫 UUID）。
- **回應**：`200` `text/csv; charset=utf-8`；**UTF-8 BOM**（`\uFEFF`）+ 本文；`Content-Disposition: attachment; filename="inventory-balances.csv"`。
- **列上限**：該倉最多 **10_000** 筆餘額列（依 `productId` 升序）；與 `GET /inventory/events/export` 上限一致。
- **欄位（表頭）**：`sku`,`name`,`productId`,`warehouseId`,`onHandQty`,`updatedAt`（與 enriched 語意對齊；escape 規則同 events export）。
- **保護**：若環境變數 **`ADMIN_API_KEY`** 已設定，須 **`X-Admin-Key`**；未帶或錯誤 → `401` **`ADMIN_API_KEY_REQUIRED`**。
- **錯誤**：`400 INVENTORY_INVALID_INPUT`（缺 warehouseId）；`404 INVENTORY_WAREHOUSE_NOT_FOUND`。

#### 4.2d 即將到期批次查詢 `GET /inventory/expiring`（draft）

- **Method**：`GET`
- **Path**：`/inventory/expiring`
- **用途**：查詢「即將到期且仍有庫存」之批次清單，供飼料／生鮮等商品做效期管理與報表。
- **狀態**：`draft`（本輪實作後可標記為 stable）。

**Query 參數**

- `warehouseId?`：單一倉庫 UUID；未帶時代表所有倉。
- `productId?`：單一商品 UUID；未帶時代表所有商品。
- `from?` / `to?`：效期區間（ISO 日期或 DateTime）；若未帶，則預設以「今天」為起點。
- `daysAhead?`：整數天數，用來指定「從今天起往後 N 天內到期」；僅在未帶 `to` 時生效；預設 `30`，上限建議 `365`。
- `page?`（預設 `1`）、`pageSize?`（預設 `50`，上限 `200`）。

> 決策：以 **ReceivingNoteLine** 做為批次與效期的來源（`batchCode`／`expiryDate`），`POST /receiving-notes/:id/complete` complete 時會寫入對應含批次／效期的 `InventoryEvent`。  
> `GET /inventory/expiring` 以 **InventoryBalance.onHandQty>0** 配合事件上的 `batchCode`／`expiryDate` 聚合為批次餘額。

**成功回應（草案）**

```json
{
  "items": [
    {
      "productId": "uuid-of-product",
      "warehouseId": "uuid-of-warehouse",
      "sku": "FEED-001",
      "productName": "狗飼料 10kg",
      "batchCode": "B202603",
      "expiryDate": "2026-04-15T00:00:00.000Z",
      "onHandQty": 120
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 1
}
```

- `batchCode`：批次代碼；若來源無提供則為 `null`。
- `expiryDate`：效期日；以 ISO 字串回傳。
- `onHandQty`：該批次目前庫存量（與 `InventoryBalance` 對齊）。

**錯誤情境（草案）**

- `400 INVENTORY_INVALID_INPUT`：`daysAhead` 非正整數或超過上限、`from`／`to` 解析失敗或 `from > to`。
- `404 INVENTORY_WAREHOUSE_NOT_FOUND`：帶入的 `warehouseId` 不存在。

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

#### 4.3b 庫存事件 CSV 匯出

- **Method**：`GET`
- **Path**：`/inventory/events/export`
- **Query**：與 §4.3 相同（`productId`、`warehouseId`、`type`、`from`、`to`）；**最多 1 萬筆**，UTF-8 BOM。
- **保護**：與 `POST /inventory/events` 相同，若設 **`ADMIN_API_KEY`** 須 **X-Admin-Key**。
- **回應**：`200` `text/csv`，檔名建議 `inventory-events.csv`。

---

#### 4.3e 滯銷品 `GET /inventory/slow-moving`（stable）

- **Method**：`GET`
- **Path**：`/inventory/slow-moving`
- **用途**：查詢近 N 天銷量小於門檻且庫存大於門檻之商品，供報表與清倉決策。
- **狀態**：**stable**。

**Query 參數**

- `merchantId`（必填）：商家 UUID。
- `warehouseId?`：單一倉庫 UUID；未帶時代表該商家所有倉庫合併評估。
- `lookbackDays?`：回溯天數，預設 `30`。
- `salesThreshold?`：銷量門檻，銷量**小於**此值視為滯銷，預設 `0`。
- `onHandThreshold?`：庫存門檻，庫存**大於**此值才列入（排除已無庫存），預設 `1`。

**成功回應**

```json
{
  "items": [
    {
      "productId": "uuid",
      "sku": "SKU-001",
      "name": "商品名稱",
      "soldQty": 2,
      "onHandQty": 50,
      "warehouseId": "uuid"
    }
  ],
  "from": "2025-02-15",
  "to": "2025-03-17"
}
```

- `soldQty`：區間內 SALE_OUT 彙總數量。
- 篩選條件：`soldQty < salesThreshold` 且 `onHandQty > onHandThreshold`。

---

#### 4.4 補貨建議 `GET /inventory/replenishment-suggestions`（draft）

- **Method**：`GET`
- **Path**：`/inventory/replenishment-suggestions`
- **用途**：根據最近一段時間的實際銷售量與目前庫存，給出各商品的「建議補貨數量」，供後台產生採購單草稿或人工調整。
- **狀態**：`draft`（本輪實作後可標記為 stable）。

**Query 參數**

- `merchantId`（必填）：商家 UUID。
- `warehouseId?`：單一倉庫 UUID；未帶時代表該商家所有倉庫合併評估。
- `daysLookback?`：計算平均銷售量的回溯天數，預設 `30`，建議範圍 `7～90`。
- `daysAhead?`：預計要準備的未來天數，預設 `30`。
- `safetyDays?`：安全天數緩衝，預設 `7`；實作時先採用預設值，未來可改成 per-merchant 設定或 query 覆寫。
- `minSuggestedQty?`：最低建議補貨量（例如 `1`）；小於此值可視為不建議補貨，預設 `0`。
- `page?`（預設 `1`）、`pageSize?`（預設 `50`，上限 `200`）。

**計算概念（供實作參考）**

- 期間內總銷量：`totalSold`（可依 `SALE_OUT` 或 POS 訂單推算）。
- 平均日銷量：`avgDailySales = totalSold / daysLookback`。
- 安全庫存目標：`targetStock = avgDailySales * (daysAhead + safetyDays)`。
- 目前庫存：來自 `InventoryBalance.onHandQty`。
- 建議補貨量：`suggestedQty = max(0, ceil(targetStock - onHandQty))`。

**成功回應（草案）**

```json
{
  "config": {
    "daysLookback": 30,
    "daysAhead": 30,
    "safetyDays": 7
  },
  "items": [
    {
      "productId": "uuid-of-product",
      "warehouseId": "uuid-of-warehouse",
      "sku": "FEED-001",
      "productName": "狗飼料 10kg",
      "onHandQty": 20,
      "avgDailySales": 3.5,
      "targetStock": 133,
      "suggestedQty": 113,
      "reason": "onHand below targetStock"
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 1
}
```

- `config`：實際採用的 `daysLookback`／`daysAhead`／`safetyDays`（即使未在 query 明傳也會回報，方便前端與之後改成設定）。
- `reason`：文字說明（例如 `onHand below targetStock`、`no recent sales` 等；初版可選填）。

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
- **`preset=last30d`**：僅在**未**帶 `from` 且**未**帶 `to` 時生效，自動篩近 30 日（報表預設；不帶 `preset` 時行為與舊版相同＝不篩日期）。
- `page`（預設 `1`）、`pageSize`（預設 `50`，上限 `100`）。

**成功回應** `200` — `PagedResult<FinanceEvent>`（與 POST 成功單筆欄位一致；`amount`／`taxAmount` 為數字）

**錯誤**：`400 FINANCE_LIST_PAGE_INVALID`（page／pageSize 非法）。

#### 5.0c Party（多方關係）抽象（B12，draft）

本專案的 `FinanceEvent.partyId` 代表「金流對象（Party）」的抽象識別，用來支援：

- **單一訂單對多方**：同一筆訂單，同時對「客戶」「電商平台」「客印廠商」「門市／內部」產生不同的應收／應付／費用事件。
- **應收應付彙總**：`GET /finance/balances`／`GET /finance/summary groupBy=partyId` 可依 party 彙總。

#### 5.0d 應收應付餘額 `GET /finance/balances`（stable）

- **Query**：
  - `merchantId`（必填）：商家 UUID（用於多商家資料隔離）
  - `partyId`（可選，精確比對）
  - **`kind`**（可選）：`customer`｜`supplier`，依 partyId 前綴或 Customer/Supplier 表解析後篩選
  - `page`（預設 `1`）、`pageSize`（預設 `50`，上限 `200`）
- **回應**：`{ items, page, pageSize, total, totals }`
  - `items`: `[{ partyId, receivable, payable, displayName?, kind? }]`
  - `totals`: `{ receivable, payable }`（為**篩選後**全集合的加總）
  - `displayName`：依 partyId 對照 Customer.name 或 Supplier.name，無則省略。
  - `kind`：依 partyId 前綴（`customer:`、`supplier:`）解析；無前綴時查 Customer／Supplier 推論，無法推論則省略。

**Party 的概念（設計草案）**

- **PartyKind**（建議）：`CUSTOMER`｜`SUPPLIER`｜`PLATFORM`｜`VENDOR`｜`STORE`｜`MERCHANT`｜`OTHER`
- **PartyRef（建議格式）**：`{ kind, refId, displayName? }`

**落地方式（兩種方案，先採用 A；B 為後續演進）**

- **A（先採用，無需新增表）**：`partyId` 使用字串前綴形成穩定 key  
  - 格式：`${kind}:${refId}`  
  - 例：`CUSTOMER:uuid`、`SUPPLIER:uuid`、`PLATFORM:shopee`、`VENDOR:print-001`
  - 優點：不需 schema 變更即可表達多方；缺點：顯示名稱需另外對照或由 `note` 帶入。
- **B（後續）**：新增 `Party` 表（或 `FinanceParty`）  
  - 欄位：`id`、`merchantId`、`kind`、`refId?`、`name`、`metaJson?`  
  - `FinanceEvent.partyId` 改為 FK（或新增 `partyRefId`），並提供後台對照與查詢。

> **統一規則（Phase 2，stable）**：
> - `FinanceEvent.partyId` 以 **小寫前綴**作為穩定 key：`customer:{customerId}`、`supplier:{supplierId}`（其他 kind 後續擴充）
> - 舊資料若仍為純 UUID（無前綴）仍允許查詢，但新寫入請一律使用前綴格式，以避免不同 kind 撞值與讓前端可穩定顯示 kind。

#### 5.0b 金流事件 CSV 匯出 `GET /finance/events/export`（stable）

- **Query**：與 §5.0 相同（`partyId`、`referenceId`、`type`、`from`、`to`、`preset=last30d`）；**不**使用 `page`／`pageSize`；列數上限 **10_000**（`occurredAt` 降序）。
- **回應**：`200` `text/csv; charset=utf-8`；**UTF-8 BOM**；`Content-Disposition: attachment; filename="finance-events.csv"`。
- **保護**：若 **`ADMIN_API_KEY`** 已設定，須 **X-Admin-Key**（與 inventory export 相同）；未帶或錯誤 → `401` **`ADMIN_API_KEY_REQUIRED`**。
- **錯誤**：`400 FINANCE_LIST_PAGE_INVALID`（`from`／`to` 非法日期）。

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

#### 5.2 多方應收應付：由單一訂單產生多筆 FinanceEvent（B12，draft）

以下示例說明「同一筆訂單」如何拆成多筆 `FinanceEvent`（append-only），以支援電商平台與外部廠商的多方關係。

**情境 A：電商平台代收（平台＋門市＋客戶）**

- 訂單：客戶下單 \(total=1000\)，平台抽成 10%（100），平台代收後 T+7 結算給門市 900。
- 建議事件：
  - `SALE_RECEIVABLE`：party=`CUSTOMER:{customerId}` amount=1000 referenceId=orderId
  - `SALE_PAYMENT`：party=`PLATFORM:shopee` amount=1000 referenceId=orderId note=「平台代收」
  - `ADJUSTMENT`（或新增型別如 `SALE_PLATFORM_FEE`，後續再擴）：
    - party=`PLATFORM:shopee` amount=100 referenceId=orderId note=「平台抽成」
  - `SALE_PAYMENT`（或 `ADJUSTMENT`，視模型）：
    - party=`STORE:{storeId}` amount=900 referenceId=orderId note=「平台結算入帳」

> 若要更精準地表達「費用」與「結算」，建議後續擴充 `FinanceEventType`（例如 `SALE_COMMISSION`／`SALE_SETTLEMENT`），但本輪先以設計草案為主。

**情境 B：客印／代工（客戶＋外部廠商＋門市）**

- 訂單：客戶付款 1500，其中 800 需支付給外部印刷廠，門市毛利 700。
- 建議事件：
  - `SALE_RECEIVABLE`：party=`CUSTOMER:{customerId}` amount=1500 referenceId=orderId
  - `SALE_PAYMENT`：party=`CUSTOMER:{customerId}` amount=1500 referenceId=orderId
  - `PURCHASE_PAYABLE`（或新增型別 `VENDOR_PAYABLE`，後續再擴）：
    - party=`VENDOR:print-001` amount=800 referenceId=orderId note=「客印代工成本」

**查詢與彙總建議**

- `GET /finance/events?partyId=PLATFORM:shopee` 可查平台相關收付與費用。
- `GET /finance/summary?groupBy=partyId` 可得到各 party 的應收／應付維度（需後端彙總邏輯以 type 分組）。

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

