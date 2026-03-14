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

## 6. 品牌與商品主檔（stable）

### 6.0 `GET /categories`（stable）

- **Response**：`{ id, code, name, createdAt, updatedAt }[]`

### 6.0a `GET /categories/enriched`（stable）

- **用途**：後台報表／篩選；每筆含 **`productCount`**、**`brandCodes[]`**（該分類下商品品牌 code 去重）、**`tags[]`**（該分類下商品 tags 併集去重）。
- **公開 GET**（與 `/categories` 相同，不強制 Admin Key）。

### 6.0b `POST`／`PATCH`／`DELETE /categories`（stable）

- **用途**：後台分類 CRUD；**GET /categories 仍公開**（POS 篩選）。**POST**／**PATCH**／**DELETE** 與 **`POST/PATCH/DELETE /products`** 相同：若設定 **`ADMIN_API_KEY`**，須 **`X-Admin-Key`**；未設定則不擋（CI 相容）。
- **POST** `/categories` body：`{ "code": "CAT01", "name": "飲料" }`（`code` 全域唯一）
- **PATCH** `/categories/:id` body：`{ "code?": "…", "name?": "…" }`
- **DELETE** `/categories/:id`：若仍有 **`Product.categoryId`** 指向該分類 → **409** **`CATEGORY_IN_USE`**；無引用則 **204** 無 body
- **錯誤**：`400 CATEGORY_CODE_REQUIRED`／`CATEGORY_NAME_REQUIRED`；`409 CATEGORY_CODE_CONFLICT`；`404 CATEGORY_NOT_FOUND`；`409 CATEGORY_IN_USE`（DELETE）

### 6.1 `GET /brands`（stable）

- **Response**：`{ id, code, name, createdAt, updatedAt }[]`

### 6.2 `GET /products`（stable）

- **Query**：`search?`、`sku?`、`categoryId?`、`brandId?`、`tag?`（標籤需與 `tags` 陣列中某一元素**完全相等**，含繁體與空白）。`search` 亦會比對 `description`。
- **Response 單筆欄位**：`id`、`sku`、`name`、`description?`、`specSize?`、`specColor?`、`weightGrams?`、`listPrice`、`salePrice`、`costPrice?`（金額為兩位小數字串）、`categoryId`、`brandId`、`tags[]`、`createdAt`、`updatedAt`

**Seed 與 POS「折扣」列對齊之 `tag` 值**（`pnpm db:seed` 後可查 `GET /products?tag=熱銷` 等）：

| tag 值 | 說明（約定） |
|--------|----------------|
| `熱銷` | 促銷／熱賣列常用 |
| `新品` | 新上架 |
| `清倉` | 出清（與前端「會員價」等並列時，仍以 seed 實際 tags 為準；若需「會員價」請先於 seed 或後台寫入同一字串） |

> 前端 E2E／第三列篩選：呼叫 `getProducts({ tag: '熱銷' })` 等時，字串須與上表及 DB 內 `Product.tags` 一致；選「全部」則不帶 `tag`。

### 6.3 `POST/PATCH /products`

- **Body** 可選：`description`、`specSize`、`specColor`、`weightGrams`、`listPrice`、`salePrice`、`costPrice`（未送則 `listPrice`/`salePrice` 預設 0）、`categoryId`、`brandId`、`tags`（字串陣列）。
- **POS 建單**：`POST /pos/orders` 仍依 request 的 `unitPrice`；商品主檔 `salePrice` 僅供後台／前端預設帶入，非強制。

### 6.4 `POST /products/import`（stable）

- **Content-Type**：`multipart/form-data`；欄位名 **`file`**（`.csv`，UTF-8，可含 BOM）。
- **保護**：與 **`POST /products`** 相同 — 若設 **`ADMIN_API_KEY`** 須 **`X-Admin-Key`**。
- **列上限**：最多 **10_000** 筆資料列（不含表頭）；超過 → **400** **`PRODUCT_IMPORT_TOO_MANY_ROWS`**。
- **表頭**：必含 **`sku`**（大小寫不拘）。建議欄位：`sku`（必填）、`name`、`description`、`specSize`、`specColor`、`weightGrams`、`listPrice`、`salePrice`、`costPrice`、`categoryCode`、`brandCode`、`tags`（以 **`|`** 分隔多標籤）。
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

