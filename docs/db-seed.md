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
- **Category**：四筆，與前端 mock 對齊 — `cat-clothes`/衣服、`cat-hay`/牧草、`cat-feed`/飼料、`cat-supplies`/用品。
- **Product**：各分類底下多筆商品，共 14 筆（皆設 `categoryId`）：
  - **衣服**：SKU-CLOTH-001（短袖 T 恤）、SKU-CLOTH-002（長袖工作服）、SKU-CLOTH-003（寵物背心）。
  - **牧草**：SKU-HAY-001（提摩西牧草）、SKU-HAY-002（果園草）、SKU-HAY-003（燕麥草）。
  - **飼料**：SKU-A001（商品 A）、SKU-B002（商品 B）、SKU-C003（商品 C）、SKU-FEED-001（成兔飼料）、SKU-FEED-002（幼兔飼料）。
  - **用品**：SKU-SUP-001（水壺）、SKU-SUP-002（食盆）、SKU-SUP-003（便盆）。
- **InventoryEvent + InventoryBalance**：對上述所有商品在 W001 倉庫各建立一筆 `PURCHASE_IN` 事件（若尚無結餘），並設定 `onHandQty: 100`。
- **極端場景**：下列兩樣商品會再被調整庫存，供測試低庫存／缺貨：
  - **庫存 1**：**便盆**（SKU-SUP-003）
  - **庫存 0**：**寵物背心**（SKU-CLOTH-003）

執行完成後，終端會印出 Merchant / Store / Warehouse 的 code、四個分類的 code/name、商品總數、極端場景的兩樣商品，以及部分 Product 的 `id`（可供 `POST /pos/orders` 的 `storeId`、`productId` 使用）。

## 重複執行

Seed 使用 `upsert`（Category 依 `code`、Product 依 `sku`），重複執行不會重複新增同一主檔；庫存部分會略過已存在之 `InventoryBalance`，僅在尚無結餘時寫入初始 100 單位。
