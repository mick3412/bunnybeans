# 資料庫 Seed 腳本說明

## 用途

本機或 demo 環境一鍵建立最小主檔與庫存，方便前後端開發與手動測試 POS 流程。

## 前置

- 已設定 `DATABASE_URL`（例如在 `backend/.env` 或根目錄 `.env`）。
- 已執行過 migration 或 `pnpm --filter pos-erp-backend prisma:db:push`，使資料表存在。

## 執行方式

在專案根目錄：

```bash
pnpm --filter pos-erp-backend db:seed
```

或在 `backend` 目錄下：

```bash
pnpm db:seed
```

等同執行：`ts-node prisma/seed.ts`（會依 Prisma 連線寫入資料）。

## 建立內容

- **Merchant**：一筆，`code: M001`，名稱「Demo 商家」。
- **Store**：一筆，`code: S001`，名稱「Demo 門市」，隸屬上述 Merchant。
- **Warehouse**：一筆，`code: W001`，名稱「Demo 門市倉」，隸屬同一 Merchant 且 `storeId` 指向上述門市（供 POS 扣庫使用）。
- **Customer（E2E）**：固定 id **`e2e00001-0000-4000-8000-00000000c001`**，`code: E2E`，每次 seed **`upsert`**，與是否已有 `C001` 無關；供 Playwright 掛帳測試與 `POST /pos/orders` 帶 `customerId` 驗證。
- **Customer（Demo）**：若尚無 `code: C001`，則新增一筆「Demo 客戶」（id 由 DB 分配，與 E2E 列分開）。
- **Category**：四筆，與前端 mock 對齊 — `cat-clothes`/衣服、`cat-hay`/牧草、`cat-feed`/飼料、`cat-supplies`/用品。
- **Brand**：三筆 — `brand-house`/自有品牌、`brand-premium`/精選、`brand-feed`/飼料牌；商品會掛 `brandId`。
- **Product**：各分類底下多筆商品，共 14 筆（皆設 `categoryId`、`brandId`，部分設 `tags` 字串陣列，如「熱銷」「新品」「清倉」）：
  - **衣服**：SKU-CLOTH-001（短袖 T 恤）、SKU-CLOTH-002（長袖工作服）、SKU-CLOTH-003（寵物背心）。
  - **牧草**：SKU-HAY-001（提摩西牧草）、SKU-HAY-002（果園草）、SKU-HAY-003（燕麥草）。
  - **飼料**：SKU-A001（商品 A）、SKU-B002（商品 B）、SKU-C003（商品 C）、SKU-FEED-001（成兔飼料）、SKU-FEED-002（幼兔飼料）。
  - **用品**：SKU-SUP-001（水壺）、SKU-SUP-002（食盆）、SKU-SUP-003（便盆）。
- **InventoryEvent + InventoryBalance**：對上述所有商品在 W001 倉庫各建立一筆 `PURCHASE_IN` 事件（若尚無結餘），並設定 `onHandQty: 100`。
- **極端場景**：下列兩樣商品會再被調整庫存，供測試低庫存／缺貨：
  - **庫存 1**：**便盆**（SKU-SUP-003）
  - **庫存 0**：**寵物背心**（SKU-CLOTH-003）

執行完成後，終端會印出 Merchant / Store / Warehouse 的 code、四個分類的 code/name、商品總數、極端場景的兩樣商品，以及部分 Product 的 `id`（可供 `POST /pos/orders` 的 `storeId`、`productId` 使用）。

## E2E（Playwright）前置與固定識別

- **資料庫**：設定 `DATABASE_URL`；`prisma db push`（或 `migrate deploy`）後執行 **`pnpm --filter pos-erp-backend db:seed`**，與 CI／本機一致。
- **後端**：預設 **`PORT=3003`**（見 backend `main.ts` 或 env）；E2E 前可先打 **`GET http://localhost:3003/health`**（若專案有 health）或任一 stable GET（如 `GET /categories`）確認已起。
- **掛帳 E2E 客戶 UUID**：一律為 **`e2e00001-0000-4000-8000-00000000c001`**（seed upsert，重跑 seed 即修復舊庫缺列問題）。
- **固定主檔（seed 不刪時可寫死於腳本）**：
  - **門市**：以 **`GET /stores`** 取第一筆 `id`，或 seed 後由終端輸出對應 **S001** 之 store uuid（每次 upsert 同一 `code` 時 id 穩定）。
  - **商品**：優先使用終端印出的 **SKU-CLOTH-001**（短袖 T 恤）之 `productId`；或 **`GET /products?search=CLOTH-001`** 取第一筆。
- **折扣列 tag**：與 `GET /products?tag=` 一致之字串見 [api-design.md §6 與下方 Seed tags](api-design.md)；前端 E2E 選 tag 時須與 seed 完全一致（例如 `熱銷`、`新品`）。

## 重複執行

Seed 使用 `upsert`（Category 依 `code`、Product 依 `sku`），重複執行不會重複新增同一主檔；庫存部分會略過已存在之 `InventoryBalance`，僅在尚無結餘時寫入初始 100 單位。
