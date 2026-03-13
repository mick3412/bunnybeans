# 後台／庫存 Admin UI 說明

> 與 POS 共用同一 SPA、`VITE_API_BASE_URL`。路由前綴 `/admin/*`。

## 身分與權限（MVP — 已定案）

- **Phase A（目前）**：與 POS 相同 API Base URL，**無後台專用 JWT**。依賴內網／Tunnel／部署隔離；任何人可開 `/admin` 即見畫面（與登入頁「暫不驗證」一致）。語意上等同 **擁有者** 使用情境。
- **角色編制**（名義上兩種，開發不拆權限）：見 **[docs/admin-roles.md](admin-roles.md)**  
  - **擁有者（Owner）**：全部權限。  
  - **Admin**：編制保留，**權限矩陣未訂**；開發階段**一律按擁有者**實作與測試；待客戶真的要 Admin 細分再實作。  
- **Phase B（後續可選）**：環境變數 **`ADMIN_API_KEY`** 若設定，後台寫入 API 須帶 **`X-Admin-Key`**（或 **`X-Api-Key`**、`Authorization: Bearer <key>`）：`POST /inventory/events`、`POST/PATCH/DELETE /products`。前端於 build 注入 **`VITE_ADMIN_API_KEY`**（與後端同值），`adminApi` 會自動帶 header。未設定時不擋（CI／本機與 POS 不變）。Admin 細粒度 RBAC **仍非必做**。

## 與 POS 邊界

| 應用 | 可呼叫 API |
|------|------------|
| **POS 收銀** | `GET /stores`, `GET /products`, `GET /categories`, `GET /brands`, `POST /pos/orders`、補款／退款等；**不**直接呼叫 `/inventory/*`（扣庫由後端建單時內部完成）。 |
| **Admin 後台** | `GET/POST/PATCH/DELETE /products`、`GET /warehouses`、`GET /inventory/balances`、`GET /inventory/balances/enriched`、`GET /inventory/events`、`POST /inventory/events`（入庫／盤點等）、Merchant CRUD（Phase 3 畫面可選）。 |

## 前端路由

| 路徑 | 說明 |
|------|------|
| `/admin` | 導向 `/admin/inventory` |
| `/admin/inventory` | 倉庫選擇、庫存餘額（enriched）、異動明細分頁 |
| `/admin/products` | 商品列表與新增／編輯／刪除 |
| `/admin/inventory/adjust` | 手動庫存事件（入庫 PURCHASE_IN、盤點增減等） |
| `/admin/warehouses` | 倉庫列表（唯讀 MVP；CRUD 可 Phase 3） |

## API 對照（Admin）

| UI | Method | Path |
|----|--------|------|
| 倉庫下拉 | GET | `/warehouses` |
| 餘額表（含 sku/name） | GET | `/inventory/balances/enriched?warehouseId=` |
| 異動明細 | GET | `/inventory/events?warehouseId=&page=&pageSize=` |
| 手動異動 | POST | `/inventory/events` |
| 商品列表 | GET | `/products` |
| 新增商品 | POST | `/products` |
| 更新商品 | PATCH | `/products/:id` |
| 刪除商品 | DELETE | `/products/:id` |
| 分類／品牌下拉 | GET | `/categories`, `/brands` |
| 分類維護（後台） | POST/PATCH | `/categories`、`/categories/:id`（若設 `ADMIN_API_KEY` 須 **X-Admin-Key**） |

## 進度紀錄

後端／前端完成階段後，於當日進度檔「本日變更紀錄」以**實際寫入時間** HH:MM 追加（見 `docs/daily-progress-format.md`）。
