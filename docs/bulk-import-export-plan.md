# 批量匯入／匯出 — 使用場景與開發計畫

> 對齊 POS／後台正常使用情境；與現有 API 見 [api-design-inventory-finance.md](api-design-inventory-finance.md)、[admin-inventory-ui.md](admin-inventory-ui.md)。

---

## 一、正常使用場景（為何要批量）

| 場景 | 典型角色 | 匯入 | 匯出 | 說明 |
|------|----------|:----:|:----:|------|
| **開店／換系統建檔** | 營運、資訊 | 商品、分類、客戶 | — | 從舊 ERP／Excel 一次灌主檔，避免逐筆 key。 |
| **價格／條碼批次調整** | 採購、店長 | 商品（upsert by SKU） | 商品現況 | 促銷檔期前改 **salePrice**、補 **SKU**。 |
| **盤點／期初庫存** | 倉管 | 庫存餘額（by SKU + 倉） | 餘額底稿 | 盤點後覆寫或調整 **onHand**；需與單筆異動稽核並存。 |
| **進退貨與調撥對帳** | 倉管、會計 | —（多走單筆／單據） | **庫存異動流水** | 與廠商／內部對帳；**已做**：`GET /inventory/events/export`。 |
| **金流／對帳** | 會計、店長 | — | **金流事件** | 交財務或 Excel 透視；目前僅列表 API，可再加 CSV。 |
| **銷售／訂單分析** | 店長、總部 | — | **POS 訂單明細** | 區間銷售、SKU 排行；常要 CSV 給 BI。 |
| **會員／CRM** | 行銷 | 客戶（選配） | 客戶 | 活動前匯入名單；需注意個資與重複合併策略。 |
| **促銷規則備份** | 營運 | JSON／表單（進階） | 規則列表 | 結構複雜，批量匯入風險高；優先 **匯出備份** + 後台複製。 |

**優先級直覺**：營運最常碰到的是 **商品 + 庫存餘額 + 訂單／金流匯出**；匯入以 **商品（SKU upsert）** 與 **盤點庫存** 最剛需。

---

## 二、現況（不必重複開發）

| 能力 | 狀態 |
|------|------|
| **庫存異動流水 CSV** | **已有** `GET /inventory/events/export`（Admin Key；與 events 相同 query；上限 1 萬筆）。 |
| **庫存餘額 CSV（單倉）** | **已有** `GET /inventory/balances/export?warehouseId=`（欄位 sku、name、productId、warehouseId、onHandQty、updatedAt；上限 1 萬列；與 events/export 同保護與 BOM）。 |
| **商品／分類 CRUD** | 單筆 API 完整；**商品 CSV** `POST /products/import`。 |
| **盤點 CSV** | **已有** `POST /inventory/events/import`（quantityDelta、逐列 InventoryEvent）。 |
| **金流列表** | `GET /finance/events`（分頁）；**CSV** `GET /finance/events/export`（同篩選、上限 1 萬列、Admin Key）。 |
| **POS 訂單** | 列表／明細 API；**CSV** `GET /pos/orders/export`（訂單層級、storeId／from／to、1 萬列、Admin Key）。 |

---

## 三、開發計畫（分階段）

### Phase A — 匯出擴充（低風險、快上線）

| 序 | 交付 | 後端 | 前端 |
|----|------|------|------|
| A1 | **庫存餘額 CSV** | `GET /inventory/balances/export?warehouseId=`（**已做**：單倉、sku/name/onHand、上限 1 萬列） | Admin 庫存頁「匯出餘額」 |
| A2 | **金流事件 CSV** | **`GET /finance/events/export`**（**已做**：同 filter、preset、1 萬列、BOM、Admin Key） | Admin 報表頁「匯出 CSV」 |
| A3 | **POS 訂單 CSV** | **`GET /pos/orders/export`**（**已做**：訂單層級欄位、from／to／storeId、1 萬列、BOM、Admin Key）；含明細可下一輪 | POS Orders 或後台「匯出」 |

**共通**：Admin Key 或既有 POS 權限模型、**api-design** 先寫、與現有 export 同一套 CSV escape。

### Phase B — 商品批量匯入（中風險、剛需）

| 序 | 交付 | 說明 |
|----|------|------|
| B1 | **CSV 範本 + 說明** | 欄位：sku（必填）、name、categoryCode、brandCode、listPrice、salePrice、costPrice… |
| B2 | **POST /products/import**（**已做**：multipart `file`、ok/failed、categoryCode／brandCode 列錯） | 列級驗證；SKU 存在 → update；不存在 → create |
| B3 | **匯入結果** | 同步回傳 `{ ok: n, failed: [...] }`；大量時改 **job + 輪詢**（Phase D） |
| B4 | **Admin UI** | 上傳、預覽前 20 列錯誤、確認寫入 |

### Phase C — 庫存批量調整（高風險、需稽核）

| 序 | 交付 | 說明 |
|----|------|------|
| C1 | **盤點匯入** | **已做**：**`POST /inventory/events/import`** — CSV：**sku**、**warehouseCode**（或 **warehouseId**）、**quantityDelta**（正 GAIN／負 LOSS）；每列 = 一筆事件 |
| C2 | **權限** | 僅 Admin Key；可選「草稿預覽」再確認 |
| C3 | **與單筆 API 一致** | 不重寫餘額表邏輯，一律走既有入庫事件模型 |

### Phase D — 選配（已部分落地）

| 項 | 說明 |
|----|------|
| **客戶 CSV 匯入** | **已有** `POST /customers/import`；重複 phone 策略見 [API-DECISIONS-bulk.md](API-DECISIONS-bulk.md) |
| **非同步大檔** | **已有** `POST /imports/jobs/{products_csv|inventory_csv}` + `GET /imports/jobs/:id`（DB `BulkImportJob`；單 process setImmediate） |
| **Excel** | 若堅持 .xlsx，後端可後做；MVP 建議 **CSV + UTF-8 BOM** 即可 |

---

## 四、建議實作順序（給排程）

```mermaid
flowchart LR
  A[A1 餘額CSV]
  A2[A2 金流CSV]
  A3[A3 訂單CSV]
  B[B 商品匯入]
  C[C 盤點匯入]
  A --> A2 --> A3
  A3 --> B
  B --> C
```

1. **A1 → A2 → A3**（只讀、好測、立刻減輕人工抄表）  
2. **B**（開店／改價剛需）  
3. **C**（與倉儲流程對齊後再做）  
4. **D** 依商業需求接續  

---

## 五、文件與分派

| 事項 | 路徑 |
|------|------|
| API 契約 | 新增章節於 `api-design-inventory-finance.md`；訂單匯出可寫入 `api-design-pos.md` |
| 後端指令 | 規格 Agent 覆寫 `docs/tasks/BACKEND-INSTRUCTIONS.md`（P4 對齊 Phase A～B） |
| 前端指令 | 覆寫 `docs/tasks/FRONTEND-INSTRUCTIONS.md`（P4 匯出／匯入 UI） |

---

## 六、刻意延後（除非產品堅持）

- **促銷規則 CSV 匯入**（條件／actions 為 JSON，錯誤成本高）  
- **訂單匯入**（與金流、庫存已結帳狀態衝突大）  
- **全庫 Excel 範本多 sheet**（維護成本高，CSV 分檔即可）
