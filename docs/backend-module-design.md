## Backend 模組與 Service 介面設計

> 狀態：反映 2026-03 目前實作現況與下一步規劃。  
> 讀者：後端 Agent、前端 Agent（理解後端邊界）、人類開發者。

---

### 1. 模組總覽（Domain 為中心）

系統依 `DEVELOPMENT-GUIDELINES.md` 採用 Domain / Application / Interface / Infrastructure 四層，並以業務領域切分模組。

目前後端主要模組：

| 模組        | 說明                         | 目前狀態             |
|-------------|------------------------------|----------------------|
| Merchant    | 商家 / 門市 / 倉庫主檔       | **已實作 CRUD API** |
| Category    | 商品分類主檔                 | **已實作** `GET/POST/PATCH/DELETE /categories`（寫入同 products；DELETE 有商品引用 → `CATEGORY_IN_USE`） |
| Product     | 商品主檔                     | **已實作 CRUD API**（含描述／規格／定價售價成本、categoryId 篩選） |
| Inventory   | 庫存事件與匯總               | **已實作**           |
| Finance     | 金流事件                     | **已實作**           |
| Pos         | POS 銷售單                   | **已實作**           |

檔案結構（簡化）：

```text
backend/src/
  app.module.ts
  shared/
    database/
      database.module.ts
      prisma.service.ts
  modules/
    merchant/
      merchant.module.ts
      application/...
      interface/...
      infrastructure/...
    category/
      category.module.ts
      application/...
      interface/...
      infrastructure/...
    product/
      product.module.ts
      application/...
      interface/...
      infrastructure/...
    inventory/
      inventory.module.ts
      (預計新增 application/interface/infrastructure)
    finance/
      finance.module.ts
      (預計新增 application/interface/infrastructure)
    pos/
      pos.module.ts
      (預計新增 application/interface/infrastructure)
```

---

### 2. 已實作模組：Merchant / Product

#### 2.1 MerchantModule（已實作）

- **Application 層**
  - `MerchantService`（`modules/merchant/application/merchant.service.ts`）
    - 提供：
      - `listMerchants()`
      - `getMerchant(id: string)`
      - `createMerchant(input)`
      - `updateMerchant(id, input)`
      - `deleteMerchant(id)`
      - `listStores()`
      - `getStore(id: string)`
      - `createStore(input)`
      - `updateStore(id, input)`
      - `deleteStore(id)`
      - `listWarehouses()`
      - `getWarehouse(id: string)`
      - `createWarehouse(input)`
      - `updateWarehouse(id, input)`
      - `deleteWarehouse(id)`
- **Interface 層（HTTP API）**
  - `MerchantController`（`modules/merchant/interface/merchant.controller.ts`）
    - 暴露：
      - `GET /merchants` / `GET /merchants/:id` / `POST /merchants` / `PATCH /merchants/:id` / `DELETE /merchants/:id`
      - `GET /stores` / `GET /stores/:id` / `POST /stores` / `PATCH /stores/:id` / `DELETE /stores/:id`
      - `GET /warehouses` / `GET /warehouses/:id` / `POST /warehouses` / `PATCH /warehouses/:id` / `DELETE /warehouses/:id`
- **Infrastructure 層**
  - `MerchantRepository`（`modules/merchant/infrastructure/merchant.repository.ts`）
    - 使用 `PrismaService` 存取 `Merchant`, `Store`, `Warehouse` 三個 Prisma model。

#### 2.2 CategoryModule（已實作）

- **Application 層**
  - `CategoryService`
    - `listCategories()` — 回傳全部分類。
- **Interface 層**
  - `CategoryController`
    - `GET /categories` — 回傳 `{ id, code, name }[]`，供前端 POS 三列篩選（品項）使用。
- **Infrastructure 層**
  - `CategoryRepository` — 基於 Prisma 操作 `Category` model。

#### 2.3 BrandModule（已實作）

- **Application 層**：`BrandService.listBrands()`
- **Interface 層**：`GET /brands` — 回傳 `{ id, code, name, createdAt, updatedAt }[]`（與 Category 相同排序 `code` asc）
- **Infrastructure 層**：`BrandRepository` — Prisma `Brand`

#### 2.4 ProductModule（已實作）

- **Application 層**
  - `ProductService`
    - `listProducts(filter?: { search?, sku?, categoryId?, brandId?, tag? })`
    - `getProduct(id)` — 回傳含描述、規格、價格、`brandId`、`tags: string[]`
    - `createProduct` / `updateProduct` / `deleteProduct` — 可選上述欄位與 `brandId`、`tags`
- **Interface 層**
  - `ProductController`
    - `GET /products` — 可選 query：`search`、`sku`、`categoryId`、`brandId`、`tag`（`tag` 為單一標籤，JSON 陣列 **包含** 該字串則命中；可與其他條件 **AND**）。
    - 其餘 CRUD 同前；回傳欄位含價格與 `categoryId`、`brandId`、`tags`。
- **Infrastructure 層**
  - `ProductRepository` — `Product` 含 `description`、`specSize`、`specColor`、`weightGrams`、`listPrice`/`salePrice`/`costPrice`、`brandId`、`tags`（Json，預設 `[]`）。

#### Brand / Tag（已落地）

- **Brand**：`id`、`code`、`name`；`Product.brandId` 可選。
- **Tag**：`Product.tags` 為字串陣列（JSON）；`GET /products?tag=熱銷` 篩選含該標籤之商品。

---

### 3. Inventory 模組設計（待實作）

#### 3.1 Application 層介面草稿

> 下列為建議的 TypeScript 介面，用於描述 Application 層服務。  
> 實際實作時會以 NestJS service class 形式存在，但方法簽名應盡量對齊。

```ts
interface RecordInventoryEventInput {
  productId: string;
  warehouseId: string;
  type: InventoryEventType;
  quantity: number;
  occurredAt: string; // ISO datetime
  referenceId?: string;
  note?: string;
}

interface InventoryEventFilter {
  productId?: string;
  warehouseId?: string;
  type?: InventoryEventType;
  from?: string; // ISO datetime
  to?: string;   // ISO datetime
  page: number;
  pageSize: number;
}

interface InventoryBalanceFilter {
  productIds?: string[];
  warehouseIds?: string[];
}

interface InventoryService {
  recordInventoryEvent(
    input: RecordInventoryEventInput,
  ): Promise<{ event: InventoryEvent; balance: InventoryBalance }>;

  getInventoryBalances(
    filter: InventoryBalanceFilter,
  ): Promise<InventoryBalance[]>;

  getInventoryEvents(
    filter: InventoryEventFilter,
  ): Promise<PagedResult<InventoryEvent>>;
}
```

#### 3.2 Repository 介面草稿

```ts
interface InventoryEventRepository {
  append(data: {
    productId: string;
    warehouseId: string;
    type: InventoryEventType;
    quantity: number;
    occurredAt: string;
    referenceId?: string;
    note?: string;
  }): Promise<InventoryEvent>;

  findByFilter(
    filter: InventoryEventFilter,
  ): Promise<PagedResult<InventoryEvent>>;
}

interface InventoryBalanceRepository {
  getByProductAndWarehouse(
    productId: string,
    warehouseId: string,
  ): Promise<InventoryBalance | null>;

  upsertBalance(data: {
    productId: string;
    warehouseId: string;
    onHandQty: number;
  }): Promise<InventoryBalance>;

  findByFilter(
    filter: InventoryBalanceFilter,
  ): Promise<InventoryBalance[]>;
}
```

> 實作時，`InventoryService.recordInventoryEvent` 會在同一 transaction 中：  
> 1. 透過 `InventoryEventRepository.append` 寫入事件。  
> 2. 透過 `InventoryBalanceRepository` 讀取並更新對應匯總。

---

### 4. Finance 模組設計（待實作）

#### 4.1 Application 層介面草稿

```ts
interface RecordFinanceEventInput {
  type: FinanceEventType;
  partyId: string | null;
  currency: string;
  amount: number;
  taxAmount?: number;
  occurredAt: string; // ISO datetime
  referenceId?: string;
  note?: string;
}

interface FinanceService {
  recordFinanceEvent(input: RecordFinanceEventInput): Promise<FinanceEvent>;
}
```

#### 4.2 Repository 介面草稿

```ts
interface FinanceEventRepository {
  append(data: RecordFinanceEventInput): Promise<FinanceEvent>;
}
```

> Phase 1 僅需「寫入 FinanceEvent」；未來若要實作 AR/AP 匯總與報表，可在此基礎上擴充 Query 介面。

---

### 5. POS 模組設計（待實作）

#### 5.1 Application 層介面草稿

```ts
interface PosOrderItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

interface PosPaymentInput {
  method: string;
  amount: number;
}

interface CreatePosOrderInput {
  storeId: string;
  occurredAt: string; // ISO datetime
  items: PosOrderItemInput[];
  payments: PosPaymentInput[];
  customerId?: string | null;
}

interface PosOrderListFilter {
  storeId?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

interface PosService {
  createOrder(input: CreatePosOrderInput): Promise<PosOrderDetail>;

  getOrderById(id: string): Promise<PosOrderDetail>;

  listOrders(filter: PosOrderListFilter): Promise<PagedResult<PosOrderSummary>>;
}
```

> 具體型別 `PosOrderDetail` / `PosOrderSummary` 的欄位，請以 `docs/api-design-pos.md` 為準。

#### 5.2 跨模組協作關係

- `PosService.createOrder` 在單一 transaction 中：
  1. 透過 `PosOrderRepository` 建立 `PosOrder`、`PosOrderItem` 與 **`PosOrderPayment`**（與請求 `payments[]` 對應）。
  2. 呼叫 `InventoryService.recordInventoryEvent`（`SALE_OUT`）扣減庫存。
  3. 呼叫 `FinanceService.recordFinanceEvent`（`SALE_RECEIVABLE`）記錄應收。
- `GET /pos/orders/:id` 與建單成功回應之 **`PosOrderDetail`** 含 `payments: { method, amount }[]`（見 `docs/api-design-pos.md`）；舊訂單無列時為 `[]`。
- POS 模組 **不得** 直接操作 Inventory / Finance 的資料表，只能透過上述服務。

---

### 6. 共用與基礎設施（Shared / Database）

- `DatabaseModule`（全域）
  - 提供 `PrismaService`，供各模組的 Infrastructure 層注入使用。
- 日後若加入：
  - 全域錯誤處理（Exception Filter）
  - Request logging middleware
  - 這些會放在 `shared/` 下，並在 `app.module.ts` 或 main bootstrap 中掛載。

---

### 7. 下一步實作建議（對後端 Agent）

1. 依本文件介面，在 `InventoryModule` / `FinanceModule` / `PosModule` 中建立對應的 service 與 repository 實作，並讓 controller 僅調用 Application 層。
2. 實作時若需要新增共用 DTO / 型別：
   - 優先更新此文件與 `docs/api-design-*.md`。
   - 確認穩定後，再把型別加入 `shared/src/index.ts`，供前端共用。

