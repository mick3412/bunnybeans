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

- **用途**：檢查後端與 DB 連線，供前端與部署驗收。
- **Request**：無參數。
- **Response（範例）**

```json
{
  "status": "ok",
  "timestamp": "2026-03-12T18:12:31.348Z",
  "db": { "ok": true },
  "gitSha": "abc1234"
}
```

- **`status`**：`ok`（DB 可連）或 `degraded`（DB 連線失敗，仍回 200 利於 load balancer）。
- **`db.ok`**：是否成功執行 DB ping。
- **`gitSha`**：可選；部署時注入 **`GIT_SHA`**／**`GITHUB_SHA`**／**`VERCEL_GIT_COMMIT_SHA`** 則回傳，否則省略。

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

> 完整規格與開發階段見 **[api-design-inventory-finance.md](api-design-inventory-finance.md)** §5、**[finance-accounting-roadmap.md](finance-accounting-roadmap.md)**。  
> 多方應收應付（Party 抽象、單一訂單拆多筆 FinanceEvent）之設計草案見 `api-design-inventory-finance.md` **§5.0c / §5.2**（B12）。

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

## 6. 品牌與商品主檔（stable）

### 6.0 `GET /categories`（stable）

- **Response**：`{ id, code, name, sortOrder, createdAt, updatedAt }[]`；依 **`sortOrder`** 升序，同序依 `code` 升序。

### 6.0a `GET /categories/enriched`（stable）

- **用途**：後台報表／篩選；每筆含 **`sortOrder`**、**`productCount`**、**`brandCodes[]`**（該分類下商品品牌 code 去重）、**`tags[]`**（該分類下商品 tags 併集去重）。列表依 **`sortOrder`** 升序。
- **公開 GET**（與 `/categories` 相同，不強制 Admin Key）。

### 6.0c `PATCH /categories/reorder`（stable）

- **用途**：拖曳排序後更新分類順序。需 **X-Admin-Key**。
- **Body**：`{ "ids": string[] }`（依新順序排列的 id 清單，須包含**全部**分類 id）
- **錯誤**：`400 CATEGORY_REORDER_EMPTY`／`CATEGORY_REORDER_DUPLICATE_IDS`／`CATEGORY_REORDER_INVALID`；`404 CATEGORY_NOT_FOUND`

### 6.0b `POST`／`PATCH`／`DELETE /categories`（stable）

- **用途**：後台分類 CRUD；**GET /categories 仍公開**（POS 篩選）。**POST**／**PATCH**／**DELETE** 與 **`POST/PATCH/DELETE /products`** 相同：若設定 **`ADMIN_API_KEY`**，須 **`X-Admin-Key`**；未設定則不擋（CI 相容）。
- **POST** `/categories` body：`{ "code?": "…", "name": "飲料" }`（`code` 選填，未送時由 `name` 自動衍生；`code` 全域唯一）
- **PATCH** `/categories/:id` body：`{ "code?": "…", "name?": "…" }`（未送 `code` 則保留現有）
- **DELETE** `/categories/:id`：若仍有 **`Product.categoryId`** 指向該分類 → **409** **`CATEGORY_IN_USE`**；無引用則 **204** 無 body
- **Code 規則（Category/Brand/ProductTag 共用）**：字元集 `a-z0-9-`（小寫、無前後綴 dash）；中文/特殊字元由 `name` 衍生時用 deterministic hash `x-${base36}`；重複時加 `-2`、`-3`…；手動 `code` 違規 → **400** **`*_CODE_INVALID`**
- **錯誤**：`400 CATEGORY_CODE_INVALID`／`CATEGORY_NAME_REQUIRED`；`409 CATEGORY_CODE_CONFLICT`；`404 CATEGORY_NOT_FOUND`；`409 CATEGORY_IN_USE`（DELETE）

### 6.1 `GET /brands`（stable）

- **Response**：`{ id, code, name, sortOrder, createdAt, updatedAt }[]`；依 **`sortOrder`** 升序，同序依 `code` 升序。

### 6.1c `PATCH /brands/reorder`（stable）

- **用途**：拖曳排序後更新品牌順序。需 **X-Admin-Key**。
- **Body**：`{ "ids": string[] }`（依新順序排列的 id 清單，須包含**全部**品牌 id）
- **錯誤**：`400 BRAND_REORDER_EMPTY`／`BRAND_REORDER_DUPLICATE_IDS`／`BRAND_REORDER_INVALID`；`404 BRAND_NOT_FOUND`

### 6.1b `POST`／`PATCH`／`DELETE /brands`（stable）

- **POST** body：`{ "code?": "…", "name": "品牌名" }`（`code` 選填，未送時由 `name` 自動衍生）
- **PATCH** body：`{ "code?": "…", "name?": "…" }`（未送 `code` 則保留現有）
- **DELETE**：若品牌下仍有商品 → **409** **`BRAND_IN_USE`**
- **錯誤**：`400 BRAND_CODE_INVALID`／`BRAND_NAME_REQUIRED`；`409 BRAND_CODE_CONFLICT`；`404 BRAND_NOT_FOUND`；`409 BRAND_IN_USE`（DELETE）

### 6.1a `GET/POST/PATCH/DELETE /product-tags`（stable）

- **用途**：商品標籤 master CRUD；供類別管理頁與商品表單標籤 multi-select 使用。
- **GET** `/product-tags` Query：**`merchantId`**（必填）。Response：`{ id, merchantId, name, code, sortOrder, showInPosDiscount?, autoCondition?, createdAt, updatedAt }[]`；依 **`sortOrder`** 升序，同序依 `code` 升序。
- **showInPosDiscount**（選填，預設 true）：是否顯示於 POS 折扣篩選列。
- **autoCondition**（選填）：自動貼標條件；JSON 格式，`null` 表示僅手動貼標。範例：`{ type: 'SALES_QTY', lookbackDays: 30, minQty: 5 }`、`{ type: 'NEW_ARRIVAL', withinDays: 30 }`、`{ type: 'LOW_STOCK', maxQty: 3 }`。

#### 6.1a-0 `GET /product-tags/for-pos-discount`（stable）

- **用途**：POS 收銀區折扣列篩選選項；僅回傳 `showInPosDiscount: true` 之標籤。
- **Query**：**`merchantId`**（必填）。
- **Response**：`{ id, name, code }[]`；依 sortOrder 升序。
- **錯誤**：`400 PRODUCT_TAG_MERCHANT_REQUIRED`。

- **POST** `/product-tags` Body：`{ "merchantId": "uuid", "name": "熱銷", "code?": "hot", "showInPosDiscount?": true, "autoCondition?": { type, ... } }`（`code` 選填，未送時由 `name` 自動衍生）；需 **X-Admin-Key**。
- **PATCH** `/product-tags/:id` Body：`{ "name?": "…", "code?": "…", "showInPosDiscount?": boolean, "autoCondition?": object | null }`；需 **X-Admin-Key**。
- **DELETE** `/product-tags/:id`：204 無 body；需 **X-Admin-Key**。
- **錯誤**：`400 PRODUCT_TAG_MERCHANT_REQUIRED`／`PRODUCT_TAG_NAME_REQUIRED`／`PRODUCT_TAG_CODE_INVALID`；`409 PRODUCT_TAG_CODE_CONFLICT`；`404 PRODUCT_TAG_NOT_FOUND`。

### 6.1a-1 `PATCH /product-tags/reorder`（stable）

- **用途**：拖曳排序後更新該商家標籤順序。需 **X-Admin-Key**。
- **Body**：`{ "merchantId": "uuid", "ids": string[] }`（`merchantId` 必填；`ids` 依新順序排列，須包含該商家**全部**標籤 id）
- **錯誤**：`400 PRODUCT_TAG_MERCHANT_REQUIRED`／`PRODUCT_TAG_REORDER_EMPTY`／`PRODUCT_TAG_REORDER_DUPLICATE_IDS`／`PRODUCT_TAG_REORDER_INVALID`；`404 PRODUCT_TAG_NOT_FOUND`。

### 6.2 `GET /products`（stable）

- **Query**：`search?`、`sku?`、`categoryId?`、`brandId?`、`tag?`（標籤需與 `tags` 陣列中某一元素**完全相等**，含繁體與空白）。`search` 亦會比對 `description` 與 `barcode`。**`minDaysUntilExpiry?`**（非負整數）：僅回傳有 **`expiryDate`** 且「日曆剩餘天數」**嚴格大於** N 之商品（UTC 日界；供商品總覽「剩餘天數 &gt; N」篩選）。非法值 → **400 `PRODUCT_FILTER_INVALID`**。

### 6.2b `GET /products/search-barcode?q=`（stable）

- **用途**：POS／盤點等「掃碼」情境的條碼專用查詢（避免用 `GET /products?search=` 造成誤命中）。
- **Query**：
  - `q`（必填）：barcode 字串（精確比對；大小寫不敏感）
  - `limit?`（預設 20，上限 50）
- **Response**：`{ items: Product[] }`（欄位同 `GET /products` 單筆）
- **唯一性規則（stable）**：目前 **允許重複**（barcode 不保證唯一）；因此同一條碼可能命中 **0～多筆**。前端 UX **必須**在多筆時提供選擇列表（例如以 `sku/name` 顯示）。

### 6.2a `GET /products/:id`（stable）

- **Query**：`includeBalances?`（`true` 或 `1` 時回傳庫存餘額）
- **Response**：與列表單筆欄位相同；若 `includeBalances=true` 則額外含 **`balances`**：`[{ warehouseId, warehouseCode, warehouseName, onHandQty }]`（無庫存則空陣列）

- **Response 單筆欄位**：`id`、`sku`、`barcode?`、`name`、`description?`、`specSize?`、`specCapacity?`（容量，如「500ml」）、`specStyle?`（款式；取代 `specColor`）、`specWeight?`（重量含單位；取代 `weightGrams`）、`expiryDescription?`（有效期限描述，如「常溫 1 年」）、`listPrice`、`salePrice`、`costPrice?`（金額為兩位小數字串）、`categoryId`、`brandId`、`tags[]`、`createdAt`、`updatedAt`

**Seed 與 POS「折扣」列對齊之 `tag` 值**（`pnpm db:seed` 後可查 `GET /products?tag=熱銷` 等）：

| tag 值 | 說明（約定） |
|--------|----------------|
| `熱銷` | 促銷／熱賣列常用 |
| `新品` | 新上架 |
| `清倉` | 出清（與前端「會員價」等並列時，仍以 seed 實際 tags 為準；若需「會員價」請先於 seed 或後台寫入同一字串） |

> 前端 E2E／第三列篩選：呼叫 `getProducts({ tag: '熱銷' })` 等時，字串須與上表及 DB 內 `Product.tags` 一致；選「全部」則不帶 `tag`。

### 6.3 `POST/PATCH /products`

- **Body** 可選：`barcode?`（可選；**不保證唯一**）、`description`、`specSize`、`specColor`（棄用）、`weightGrams`（棄用）、`specCapacity`、`specStyle`、`specWeight`、`expiryDescription`、`listPrice`、`salePrice`、`costPrice`（未送則 `listPrice`/`salePrice` 預設 0）、`categoryId`、`brandId`、`tags`（字串陣列）。
- **POS 建單**：`POST /pos/orders` 仍依 request 的 `unitPrice`；商品主檔 `salePrice` 僅供後台／前端預設帶入，非強制。

### 6.3a `PATCH /products/batch-price`（stable）

- **用途**：商品列表支援多選 → 批次改價；將多個商品的 `salePrice` 設為同一值。
- **Body**：`{ productIds: string[], salePrice: string | number }`
- **Response** `200`：`{ updated: number }`（實際更新筆數）
- **錯誤**：**400** **`PRODUCT_BATCH_EMPTY`**（productIds 空）；**400** **`PRODUCT_BATCH_INVALID`**（salePrice 非法或負數）
- **保護**：需 **X-Admin-Key**（同 PATCH /products/:id）

### 6.3b `PATCH /products/batch-tags`（stable）

- **用途**：批次改標籤；商品列表多選後對多筆商品統一追加或覆寫 tags。
- **Body**：`{ productIds: string[], tags: string[], operation?: 'add' | 'set' }`；`add`（預設）= 將 tags 附加至各商品既有 tags（去重）；`set` = 覆寫為 tags。
- **Response** `200`：`{ updated: number }`（實際更新筆數）
- **錯誤**：**400** **`PRODUCT_BATCH_TAGS_EMPTY_PRODUCTS`**（productIds 空）；**400** **`PRODUCT_BATCH_TAGS_EMPTY_TAGS`**（tags 空）
- **保護**：需 **X-Admin-Key**

### 6.3c `GET /products/export`（stable）

- **用途**：匯出商品 CSV；篩選參數與 `GET /products` 一致。
- **Query**（皆選填）：`search`、`sku`、`categoryId`、`brandId`、`tag`、`minDaysUntilExpiry`
- **Response**：`200` `text/csv; charset=utf-8`；**UTF-8 BOM**；`Content-Disposition: attachment; filename="products.csv"`；最多 **1 萬列**
- **保護**：需 **X-Admin-Key**
- **表頭**：`sku,name,description,specSize,specCapacity,specStyle,specWeight,expiryDescription,listPrice,salePrice,costPrice,categoryCode,brandCode,tags`（tags 以 `|` 分隔，對齊 import 格式）

### 6.4 `POST /products/import`（stable）

- **Content-Type**：`multipart/form-data`；欄位名 **`file`**（`.csv`，UTF-8，可含 BOM）。
- **保護**：與 **`POST /products`** 相同 — 若設 **`ADMIN_API_KEY`** 須 **`X-Admin-Key`**。
- **列上限**：最多 **10_000** 筆資料列（不含表頭）；超過 → **400** **`PRODUCT_IMPORT_TOO_MANY_ROWS`**。
- **表頭**：必含 **`sku`**（大小寫不拘）。建議欄位：`sku`（必填）、`name`、`description`、`specSize`、`specColor`（棄用）、`weightGrams`（棄用）、`specCapacity`、`specStyle`、`specWeight`、`expiryDescription`、`listPrice`、`salePrice`、`costPrice`、`categoryCode`、`brandCode`、`tags`（以 **`|`** 分隔多標籤）。
- **行為**：該 **`sku` 已存在** → 更新本列有出現之欄位；**不存在** → 新增（`name` 空則用 `sku`；`listPrice`/`salePrice` 空則 0）。`categoryCode`／`brandCode` 須對應既有 **Category.code**／**Brand.code**，否則該列進 **`failed`**。
- **Response** `200`：

```json
{
  "ok": 2,
  "failed": [{ "row": 4, "reason": "sku required" }]
}
```

- **`row`**：1-based 資料列在檔案中的列號（表頭為第 1 列）。
- **錯誤**：**400** **`PRODUCT_IMPORT_HEADER_SKU`**（無 sku 表頭）；**400** **`PRODUCT_IMPORT_FILE_REQUIRED`**（未上傳 file）。

### 6.5 `POST /customers/import`（stable）

- **multipart** **`file`**（CSV）；Query **`merchantId`**（必填，UUID）。
- **表頭**：**`name`**；選填 **`phone`**, **`memberLevel`**, **`code`**。
- **重複 phone**：同一 merchant 下 **phone 已存在 → 該列 failed**（見 [API-DECISIONS-bulk.md](API-DECISIONS-bulk.md)）。
- **回應**：`{ ok, failed[] }`；列上限 1 萬；**X-Admin-Key** 若已設。

#### 6.5-0 `GET /customers/export`（stable）

- **用途**：匯出客戶 CSV；篩選參數與 `GET /customers` 一致。
- **Query**：**`merchantId`**（必填）；`search`（name/phone/memberCode 模糊）、`status`、`tag`、`memberLevel`（選填）
- **Response**：`200` `text/csv; charset=utf-8`；**UTF-8 BOM**；最多 **1 萬列**；**X-Admin-Key**
- **表頭**：`name,phone,memberLevel,code`（對齊 import 格式）

### 6.5a `POST /customers/import/preview`（stable）

- **用途**：互動匯入預覽，**不寫入**；回傳每列是否需決策 + **`fileHash`**（檔案 sha256 hex）。
- **Request**：同 6.5（multipart **`file`** + Query **`merchantId`**）。
- **同一 CSV 內同 phone 多列**：**每一列各自標為 conflict**（`reasons` 含 **`csv`**），不併成單一筆。
- **DB 已存在同 phone**：該列 **`conflict: true`**，`reasons` 含 **`db`**，並帶 **`existing`**（既有客戶）。
- **Response 範例**：

```json
{
  "fileHash": "…64 hex…",
  "rows": [
    {
      "row": 2,
      "name": "A",
      "phone": "0911",
      "memberLevel": null,
      "code": null,
      "conflict": true,
      "reasons": ["csv"],
      "existing": null
    }
  ],
  "parseErrors": []
}
```

- **`parseErrors`**：`name` 空等無法進入 `rows` 的列（仍建議前端提示）。

### 6.5b `POST /customers/import/apply`（stable）

- **用途**：依 preview 結果與使用者決策寫入；**須與 preview 同一檔**。
- **Request**：multipart **`file`**（與 preview **位元組相同**）+ **`merchantId`**（Query）+ body 欄位：
  - **`fileHash`**（必填）：須等於該檔 sha256；與上傳檔不一致 → **400** **`CUSTOMER_IMPORT_FILE_HASH_MISMATCH`**。
  - **`decisions`**（必填）：JSON 字串，陣列 **`[{ "row": number, "action": "skip"|"create"|"overwrite", "customerId"?: string }]`**。
    - 每一筆在 **`preview.rows`** 的列都要有對應 **`row`** 的決策。
    - **`overwrite`**：僅適用 **`reasons` 含 `db`** 之列，且 **`customerId`** 須等於該列 **`existing.id`**。
    - **CSV 內同 phone**：至多一筆 **`create`**（其餘該 phone 列須 **`skip`** 或對 DB 列 **`overwrite`**）。
- **Response**：`{ created, updated, skipped, failed[] }`。
- **其他 400**：**`CUSTOMER_IMPORT_FILE_HASH_REQUIRED`**（未傳或非法 hex）；**`CUSTOMER_IMPORT_DECISIONS_INVALID`**。

### 6.6 非同步匯入 Job（stable）

- **`POST /imports/jobs/:kind`** — `kind` = **`products_csv`** | **`inventory_csv`**；multipart **`file`**。
- **回傳**：`{ jobId }`。後台以 **`setImmediate`** 執行（單 process；多 pod 各算各的）。
- **`GET /imports/jobs/:id`** — `status`: pending | running | done | failed；**done** 時 **`result`** 同同步 import 之 `{ ok, failed, referenceId? }`；**failed** 時 **`result` 為 null**、**`error`** 為錯誤訊息字串（**前端可直接顯示 `error` 提示使用者**）。
- **Admin Key** 若已設。**決策**：[API-DECISIONS-bulk.md](API-DECISIONS-bulk.md) §5。
- **Rate limit**：**POST /imports/jobs** 目前**未實作**節流；多 pod 時各實例各自佇列，建議後台單一使用者勿並發大量建立 job（可改選項見 API-DECISIONS-bulk §5）。

### 6.7 會員主檔 2.0（階段 A，stable）

> 對齊 [crm-member-roadmap.md](crm-member-roadmap.md) 階段 A；**本輪已實作**。

- **篩選**：`GET /customers?merchantId=` 擴充 query：`phone?`、`name?`、`memberLevel?`、`tag?`（標籤）、`status?`（ACTIVE／BLOCKED）；回傳符合條件之客戶列表（含 `status`、`blockReason`、`tags`）。
- **合併**：`POST /customers/merge`（**Admin**）body `{ primaryId: string, mergeIds: string[] }`；主檔保留，併入檔之 PosOrder／PointLedger／CustomerContactLog 歸戶至主檔；併入檔設為 BLOCKED 並寫入 blockReason；失敗時 400。
- **標籤**：Customer 欄位 `tags`（JSON 陣列）；PATCH /customers/:id 可更新 `status`、`blockReason`、`tags`。
- **黑名單**：Customer 欄位 `status`（ACTIVE | BLOCKED）、`blockReason?`；BLOCKED 時 POS 可拒絕結帳或僅匿名。
- **顧客消費洞察（stable）**：`GET /customers/:id` 追加 `insights`：
  - `lastOrder?`：`{ id, orderNumber, totalAmount, discountAmount, createdAt }`
  - `totalSpend`：累計消費（Σ PosOrder.totalAmount）
  - `ordersCount`：累計筆數
  - `ordersLast30d`：近 30 天筆數
  - `avgDaysBetweenOrders?`：平均回購間隔（天；筆數 < 2 時為 null）
  - `preferredCategories`：偏好品類（Top 5；依購買數量 Σ PosOrderItem.quantity 排序）
- **錯誤碼**：`CUSTOMER_MERGE_INVALID`、`CUSTOMER_NOT_FOUND`；見 [backend-error-format.md](backend-error-format.md)。

### 6.8 分群／互動紀錄（階段 E、F、G）

> 對齊 [crm-member-roadmap.md](crm-member-roadmap.md) 階段 E、F、G。

- **階段 E 分級／分群**：**分群已具** — Schema **Segment**；**GET /crm/segments**（draft，見 §6.8.0）列表分群；**GET /crm/segments/:id/preview** 回傳 `{ customerIds, count }`（conditions 可篩 **memberLevel**、**tag**）；**GET /crm/segments/:id/export** 分群名單 CSV（Admin Key）。**TierRule** 表與 **GET/POST/PATCH/DELETE /crm/tier-rules**（Admin）已具；**POST /crm/recalc-tiers**（Admin）body **merchantId** 必填，依 TierRule **SPEND_SUM** 區間內訂單總額達門檻則更新 Customer.memberLevel，回傳 `{ updated: number }`。錯誤碼 **SEGMENT_NOT_FOUND**、**CRM_RECALC_MERCHANT_REQUIRED**；手調 **PATCH /customers/:id** 已支援 memberLevel。  
  - **Rolling window 定義（stable）**：TierRule 的 `lookbackDays` 表示「以執行重算當下 now 為基準，往前回溯 `lookbackDays` 天」的區間（含邊界），使用 POS 訂單 `createdAt` 作為消費發生日。  
    - `SPEND_SUM`：以該區間內每位客戶所有 `PosOrder.totalAmount` 加總（僅同 merchant 之門市訂單、且 `customerId != null`）作為累計消費。  
    - 多條 TierRule 同時符合時，**以門檻（threshold）較高者優先**（避免高等級被較低規則覆蓋）。  
    - `POST /crm/recalc-tiers` 只做批次重算（不自動降級）；若需要降級策略，另以規則定義與 UI 決策補充。

#### 6.8.0 分群列表 GET /crm/segments（stable）

供後台「分群列表」頁列出該商家的所有分群，並可連結至 preview／export。

- **GET /crm/segments**（stable）
  - **Query**：`merchantId`（必填）、`page?`（預設 1）、`pageSize?`（預設 20，上限 100）。
  - **Response**：`{ items: SegmentRow[], total: number }`。  
    **SegmentRow**：`id`、`name`、`merchantId`、`conditions`（JSON，與 Schema 一致）、`createdAt`（ISO 8601）、`updatedAt?`。  
    可選：`previewCount?`（該分群目前符合人數，需額外查 preview 或快取，實作時擇一）。
  - **權限**：建議 Admin Key 或與 preview/export 一致；若僅讀取列表可放寬為同 merchant 即可。
  - **錯誤碼**：缺 merchantId → 400（可訂 `CRM_MERCHANT_REQUIRED` 或沿用既有）。

實作後將本段標為 stable，並於 backend-error-format 補齊錯誤碼（若新增）。
- **階段 F 互動紀錄（stable，已實作）**：Schema `CustomerContactLog`（type、note、nextFollowUpAt、createdBy）；**GET /customers/:id/contacts** 回傳分頁列表；**POST /customers/:id/contacts** body `{ type, note?, nextFollowUpAt?, createdBy? }`，`type` 必填。錯誤碼：`CUSTOMER_NOT_FOUND`、`CUSTOMER_CONTACT_TYPE_REQUIRED`；見 [backend-error-format.md](backend-error-format.md)。
- **階段 G 行銷整合（stub 已具，實作規格見下方 §6.8.1）**：**POST /crm/jobs/:kind**（Admin）kind＝**birthday-coupon**｜**repurchase-coupon**，回傳 **202** `{ jobId }`（stub 不執行）；無效 kind → 400 **CRM_JOB_KIND_INVALID**。報表 API（活動參與、用券數、點數成本）契約 draft，見 §6.8.2。

#### 6.8.1 階段 G — 行銷 Job 實作規格（draft）

以下為 **POST /crm/jobs/:kind** 由 stub 改為實際發券時的契約與決策點；實作前請依產品需求擇一並寫入本檔。

**共通**

- **觸發**：手動＝後台呼叫 **POST /crm/jobs/:kind**（Admin Key）。Cron 由部署側排程（同一 API 或內部 service），不另訂 API。
- **Response**：**202** `{ jobId: string }`；查詢進度見下方「Job 狀態查詢」決策。
- **錯誤碼**：`CRM_JOB_KIND_INVALID`（kind 不合法）、`CRM_JOB_MERCHANT_REQUIRED`（若 body 必填 merchantId 未帶）。

**決策一：Job 狀態查詢** — **已採用 B**

| 選項 | 說明 | 優點 | 缺點 |
|------|------|------|------|
| **A** | 沿用 **GET /imports/jobs/:id**，擴充 `BulkImportJob` 或共用 job 表，kind 含 `birthday-coupon`／`repurchase-coupon` | 前端已有輪詢與 UI 模式可複用；單一 job 來源 | imports 與 crm 語意混在同一 API；需擴充既有表或遷移 |
| **B** ✓ | 新增 **GET /crm/jobs/:id**，crm 專用 job 表（如 `CrmMarketingJob`） | 語意清晰、crm 與批量解耦；後端可獨立演進 | 前端需另一套輪詢或共用元件 |

- **採用**：**B**。實作時新增 **GET /crm/jobs/:id**，response 同類 imports job：`status`（pending｜running｜done｜failed）、`result?`（done 時 `{ sent, skipped, errors? }`）、`error?`（failed 時字串）。
  - **歷史列表（Phase 3）**：新增 **GET /crm/jobs**（Admin）支援 `merchantId`（必填）、`kind?`、`from?`、`to?`、`page?`、`pageSize?`，回傳 `{ items, total, page, pageSize }`，items 含 `{ id, merchantId, kind, status, segmentId, couponId, createdAt }`。

**決策二：生日券 job（birthday-coupon）** — **已採用 B2**

- **發送對象**：該 merchant 下「當月生日」且狀態為 ACTIVE 的會員。  
  **前提**：Customer 需有生日欄位；目前 schema 無。  

| 選項 | 說明 | 優點 | 缺點 |
|------|------|------|------|
| **B1** | 先做 **migration 新增 `Customer.dateOfBirth`（Date?）**，再實作 job；無 dateOfBirth 者不發 | 資料一致、可擴充其他生日邏輯 | 需遷移與後台／會員主檔可編輯生日 |
| **B2** ✓ | 不新增欄位；job 改為「手動上傳名單」或「依分群 ID」發券（生日邏輯後置） | 不需改 schema、可先上線發券流程 | 非真正「生日當月自動對象」 |

- **採用**：**B2**。生日券／回購券皆改為**依分群發券**（入參 **segmentId** + **couponId**／**couponCode**）；「生日當月」可由營運事先建立分群（如每月更新「當月生日」名單）或由外部名單匯入後對該分群發券。
- **Request body（採用後）**：**merchantId**（必填）、**segmentId**（必填）、**couponId** 或 **couponCode**（必填其一）。kind 可保留 `birthday-coupon`（語意為「生日檔期用分群發券」）或統一為 `segment-coupon`（見下方發券規則）。
- **發券規則常駐（選配）**：產品建議「發券規則是否維持啟用、變成常駐，像設定促銷活動那樣」。**評估：合適**。做法：新增「行銷發券規則」實體（如 **CrmCouponDispatchRule** 或納入既有設定），欄位含 merchantId、name、kind（segment-coupon）、segmentId、couponId、**enabled**（boolean）、**scheduleType**（manual｜daily｜weekly｜monthly）、**cronExpr** 或 nextRunAt；後台可啟用／停用、設定排程；cron 或排程 worker 掃「enabled=true」的規則並呼叫既有發券邏輯（等同 POST /crm/jobs/:kind + body）。與促銷活動的「草稿／啟用／排程」模式一致，實作時可列為選配或 Phase 2。
- **Job 結果**：done 時 `result: { sent: number, skipped: number, errors?: string[] }`。

**決策三：回購券 job（repurchase-coupon）** — **已採用 R3**

- **發送對象**：該 merchant 下「N 天內未消費」且符合其他條件的 ACTIVE 會員。  

| 選項 | 說明 | 優點 | 缺點 |
|------|------|------|------|
| **R1** | 固定「超過 30 天未消費」即發一張指定回購券 | 規則簡單、易實作 | 彈性低 |
| **R2** | Request 可帶 **daysSinceLastOrder**（預設 30）、**couponId**／**couponCode**；僅對「最後一筆訂單距今 ≥ N 天」者發券 | 可調參數、可 A/B 測試 | 需查訂單表、稍複雜 |
| **R3** ✓ | 與分群綁定：入參為 **segmentId**，對該分群預覽名單發券（等同「分群發券」） | 最彈性、可與 Segment 條件一致 | 與「回購」語意需在 UI 上說明（分群=回購未達標名單） |

- **採用**：**R3**。回購券與生日券統一為**分群發券**；request body 同 B2：**merchantId**、**segmentId**、**couponId**／**couponCode**。kind 可保留 `repurchase-coupon`（語意為「回購檔期用分群發券」）或統一 `segment-coupon`。
- **發放規則選項（與 B2 常駐一致）**：可新增**發放規則**設定，供後台設定「哪個分群、發哪張券、是否啟用、排程（手動／每日／每週／每月）」；實作時可為同一「行銷發券規則」表，欄位含 segmentId、couponId、enabled、scheduleType、cronExpr／nextRunAt 等，與上方「發券規則常駐」同一實體即可，回購與生日僅差在規則名稱／kind 標示。
- **Job 結果**：同生日券，`result: { sent, skipped, errors? }`。

**實作時**：一 B、二 B2、三 R3 已採用；可新增 **CrmMarketingJob** 表與 **GET /crm/jobs/:id**；request body 統一為 merchantId + segmentId + couponId|couponCode。選配：發券規則表（常駐／發放規則）與排程執行。

#### 6.8.2 階段 G — 報表 API（stable）

供後台「活動／用券／點數成本」與「會員彙總」報表使用。

- **GET /loyalty/reports/activity**（stable，Admin Key）
  - **Query**：`merchantId`（必填）、`from`、`to`（ISO 日期）、`preset?`（today｜last7d｜last30d｜currentMonth｜last60d｜lastHalfYear，未帶 from/to 時生效）、`groupBy?`（couponId 則回傳 couponUsageByCoupon）。
  - **Response**：`from`、`to`、`period?`、`participations`、`couponUsage`、`pointsCostEstimate`、`couponUsageByCoupon?`、**`byDispatchRule?`**、**`byCoupon?`**、**`revenueFromPointRedemption?`**。
  - **byDispatchRule**：每條 CrmCouponDispatchRule 的 `ruleId`、`ruleName`、`couponId`、`jobRunsCount`（區間內成功執行的 job 數）、`sentCount`（該 rule 對應 job 發出的券數，若有資料）。
  - **byCoupon**：每張 LoyaltyCoupon 的 `couponId`、`couponCode`、`name`、`sentCount`（區間內發送數）、`usedCount`（該券總核銷數）、`revenueAttributed`（該券核銷對應訂單營收，若有追蹤）。

- **GET /loyalty/reports/members**（stable，Admin Key）— 會員報表進階  
  - **Query**：`merchantId`（必填）、`from`、`to`、`preset?`（同上）。  
  - **Response**：`from`、`to`、`period?`、`newMembersCount`（區間內新客戶數）、`pointsEarned`、`pointsBurned`（區間內點數）、`couponIssuedCount`（區間內發券數）、`membersWithPointsCount`（目前有餘額的會員數）、`byMemberLevel`（`{ memberLevel, count }[]`）。

---

## 7. 規則與流程備註

- 新增 API 前，請先在本文件增加對應小節，標註為 `draft`。
- API 一旦被前端或外部系統使用，請：
  - 將狀態改為 `stable`；
  - 若未來需要大改，優先考慮新增版本（例如 `/v2/...`）或向下相容調整。
- 變更任何 API 合約時，需同步更新：
  - `shared` 中的 DTO 型別；
  - 相關前端呼叫程式碼；
  - 測試案例（單元 / E2E）。

