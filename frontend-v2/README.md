# POS ERP 前端 v2（儀表板／數據感）

從零架構的第二套前端，採用儀表板／數據感風格：深色側欄、淺灰主區、KPI 左色條、細邊框表格、懸浮表頭與底列。與現有 `frontend/` 並存，對接同一後端 API。

## 設計原則

- 設計簡潔、排版整齊、善用空間
- 介面以繁體中文為主、無 emoji
- 色系：主內容區 `#f1f5f9`、側欄 `#1e293b`、主色 `#0ea5e9`
- 詳見 [docs/frontend-ui-principles.md](../docs/frontend-ui-principles.md)

## 開發

```bash
npm install
npm run dev
```

開發伺服器：http://127.0.0.1:5174（與現有 frontend 的 5173 錯開）

## 建置

```bash
npm run build
```

## 路由

- `/login` 登入（輸入商家 ID 會寫入 localStorage，供全站 useMerchantId 使用）
- `/admin` 後台總覽（營運摘要＋集點概況）
- `/admin/inventory` 庫存餘額摘要
- `/admin/products` 商品主檔列表
- `/admin/categories` 分類、`/admin/warehouses` 倉庫與門市
- `/admin/reports` 金流報表（本日／本週營收）
- `/admin/promotions` 促銷規則、`/admin/promotions/:id` 編輯
- `/admin/customers` 會員列表、`/admin/customers/import` CSV 匯入（待接軌）
- `/admin/suppliers` 供應商、`/admin/purchase-orders` 採購單、`/admin/receiving-notes` 進貨驗收
- `/admin/loyalty` 集點儀表板、`/admin/loyalty/point-ledger` 點數存摺、`/admin/loyalty/members` 會員管理、`/admin/loyalty/coupons` 優惠券、`/admin/loyalty/settings` 系統設定
- `/pos` 收銀、`/pos/orders` 訂單列表、`/pos/orders/:id` 訂單詳情、`/pos/promos` 促銷、`/pos/reports` 報表

後端 API 透過 Vite proxy 轉發至 `http://127.0.0.1:3003`。入庫／盤點、收銀商品區與結帳流程為後續接軌項目。
