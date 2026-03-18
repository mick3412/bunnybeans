# POS-ERP 整體開發 Roadmap

> 本檔為唯一全站 roadmap；各模組細部規格仍保留在 `api-design-*.md`、`finance-accounting-roadmap.md`、`crm-member-roadmap.md` 等，本檔引用而不重複。  
> 上一輪整合見 [progress/integrated-last-cycle.md](progress/integrated-last-cycle.md)。

---

## 零、前期設計問題盤點（必讀）

以下是目前 codebase 中已辨識的設計問題或技術債，應在各 Phase 中一併修正。

### 0.1 Product schema 欄位與前端不符

- **現況**：`Product` 模型只有 `specSize`（規格尺寸）、`specColor`（款式）、`weightGrams`（整數克）三個規格欄位。前端以「規格與效期」為標題展示 `specSize`（標為「規格尺寸」）與 `specColor`（標為「款式」），並有一個 **g/kg 切換**（前端換算成 `weightGrams` 整數寫入）。
- **問題**：
  - 欄位命名不直覺：`specColor` 實際存「款式」而非顏色。
  - 缺少需求中的「容量」與「有效期限」欄位。
  - `weightGrams` 以整數存克數，g/kg 切換為前端行為，後端無單位概念。
  - 沒有獨立的「有效期限」欄位（`expiryDate` 只在 `InventoryEvent` 與 `ReceivingNoteLine` 上，不在 Product）。
- **修正計畫**：Phase 1 新增 migration，將 `Product` 加入 `specCapacity`（String?）、`specStyle`（String?，取代 `specColor`）、`expiryDescription`（String?，如「常溫 1 年」），`weightGrams` 改為 `specWeight`（String?，含單位由使用者自填），同時在 `api-design.md` 產品章節更新欄位說明。`specColor` 保留但棄用（backward compat）。

### 0.2 Product 標籤為 localStorage，無後端 master

- **現況**：商品 `tags` 欄位為 `Json @default("[]")`（`string[]`），但「標籤 master」存在前端 `localStorage`（`adminTagMaster.ts`），類別管理頁的「標籤」區塊讀寫 `localStorage`，與後端完全脫節。
- **問題**：多裝置、多使用者不會同步；標籤選項可輕易遺失。
- **修正計畫**：Phase 1 後端新增 `ProductTag` 模型（`id, merchantId, name, code, createdAt, updatedAt`）與 CRUD API（`GET/POST/PATCH/DELETE /product-tags`），前端類別管理頁的「標籤」欄從 `localStorage` 改接 API；商品表單標籤改為 multi-select 下拉，選項來源為 `GET /product-tags`。

### 0.3 Finance balances 契約不完整

- **現況**：後端 `GET /finance/balances` 已有實作（`finance.repository.ts` 的 `balancesByPartyId`），但 `finance-accounting-roadmap.md` §9.1 仍標「應收應付餘額表／API — **未實作**」，與實際 code 矛盾；`api-design-inventory-finance.md` 對 `GET /finance/balances` 的回傳格式和 `partyId` 查詢參數的說明不夠具體。
- **問題**：前端 `AdminFinanceBalancesPage` 雖然能呼叫並顯示資料，但 API 契約文件與整合測試未對齊。
- **修正計畫**：Phase 1 後端補齊契約文件（`api-design-inventory-finance.md`）與 `finance.integration-spec.ts` 中的 balances 整合測試，確認回傳 `{ items: [{ partyId, receivable, payable }] }` 並支援 `?partyId=` 查詢。

### 0.4 側欄導覽與頁面重複

- **現況**：側欄有「會員管理」（`/admin/loyalty/members`）與「會員列表」（`/admin/customers`）兩個入口，功能高度重疊（都呈現會員 CRUD、篩選、合併等）。
- **問題**：使用者困惑「該從哪裡管會員」；兩套畫面各自維護，E2E 也需覆蓋兩處。
- **修正計畫**：Phase 1 先撰寫整合提案（`member-management-review.md` 新增一節），Phase 3 實施路由收斂（保留 `AdminCustomersPage` 為唯一入口，`LoyaltyMembersPage` 改為 redirect 或薄殼）。

### 0.5 類別管理頁 layout 問題

- **現況**：`AdminCategoriesPage.tsx` 已同時顯示「品項」「品牌」「標籤」三個區塊，但排版仍為上下堆疊，且標籤區使用 localStorage。
- **修正計畫**：Phase 1 前端改為三欄 grid layout，標籤區改接後端 API（見 0.2）。

### 0.6 LoyaltyPointLedgerPage 英文標籤

- **現況**：存摺 tab 已有中文 mapping（`賺取/消耗/鎖定/過期`），但 tab 按鈕上顯示的仍是英文 enum 值（`EARNED/BURNED/LOCKED/EXPIRED`）。
- **修正計畫**：Phase 1 前端修正 tab 文案顯示為中文。

### 0.7 倉庫與門市頁面左右不齊

- **現況**：門市和倉庫分在同一路由但兩個表格的寬度、按鈕風格、新增表單位置並不一致。
- **修正計畫**：Phase 1 前端統一 layout、按鈕色與間距。

---

## Phase 1（現在 ~ 1 個月）：打磨後台 + 穩定一鍵綠

> **目標**：修復上述設計問題、完成本輪 INSTRUCTIONS 中指定的 UI 任務、讓 CI 與 seed 穩定。

### 後端

| 順序 | 任務 | 說明 |
|------|------|------|
| 1 | ci:backend-with-db 穩定 | 在乾淨 DB 上實際跑通 `pnpm ci:backend-with-db`（含 P3009 排除文件）。 |
| 2 | B7～B12 迴歸 | 批次效期、補貨建議、TierRule、POINTS_MULTIPLIER、Ops job log 整合測試確認全綠。 |
| 3 | Finance balances 契約 | 確認 `GET /finance/balances` 契約（回傳格式＋ `partyId` 查詢）、補齊 `finance.integration-spec`，修正 `finance-accounting-roadmap.md` §9 狀態。 |
| 4 | Product schema 擴充（新欄位） | Migration：Product 加入 `specCapacity`、`specStyle`（取代 `specColor`）、`specWeight`（取代 `weightGrams`）、`expiryDescription`；更新 `api-design.md` 產品章節。 |
| 5 | ProductTag CRUD | 新增 `ProductTag` 模型與 `GET/POST/PATCH/DELETE /product-tags`，整合測試 1～2 則。 |

### 前端

| 順序 | 任務 | 說明 |
|------|------|------|
| 1 | 應收應付餘額頁完整 | `AdminFinanceBalancesPage`：對齊後端契約、補強空態＋loading＋錯誤 toast。 |
| 2 | 商品規格欄位重構 | 五個選填欄位（尺寸、容量、重量、款式、有效期限）；移除 g/kg 切換。 |
| 3 | 標籤改下拉＋類別管理三欄 | 商品標籤改 multi-select（選項接 `GET /product-tags`，API 未就緒先 stub），類別管理改三欄 grid。 |
| 4 | 倉庫/門市頁對齊 | 側欄名稱「倉庫/門市」、左右表格切齊、按鈕與間距統一。 |
| 5 | 庫存餘額 header 重排 | CSV 匯入區塊縮小放右上角與倉庫選單同列。 |
| 6 | 促銷規則面板 layout | 編輯面板改左右兩欄，預設 1 條件＋1 行動。 |
| 7 | 點數存摺文案 | tab 顯示中文（全部／贈點／扣點／鎖定／已過期），保留查詢 enum。 |
| 8 | 集點設定 UI 對齊 | layout 與其他設定頁一致（大卡、標題底線、儲存按鈕風格）。 |
| 9 | 會員整合方案文件 | 在 `member-management-review.md` 寫下整合提案（本輪不改路由）。 |

---

## Phase 2（1 ~ 3 個月）：Party 多方視圖 + 補貨閉環

### 後端

| 任務 | 說明 |
|------|------|
| Party 模型正式化 | 新增 `Party`（kind: CUSTOMER｜SUPPLIER｜PLATFORM、refId、displayName）或以 DB view 解析 `partyId` 前綴。 |
| Finance balances 升級 | `GET /finance/balances` 支援以 Party kind 為 filter 與 group，回傳含 `displayName`。 |
| Finance summary 實作 | 正式實作 `GET /finance/summary`（groupBy=type｜partyId），與 `finance-accounting-roadmap.md` §4.4 對齊。 |
| 補貨→PO 草稿 | `POST /purchase-orders/from-replenishment`（body: `{ suggestions: [{ productId, warehouseId, qty }] }`），建立 DRAFT PO。 |
| 整合測試 | Party、summary、replenishment→PO 各補 integration-spec。 |

### 前端

| 任務 | 說明 |
|------|------|
| 應收應付餘額頁升級 | 依 Party kind 分頁、顯示 `displayName`、可依「會員／供應商／平台」切換。 |
| 金流報表進階 | 補上圖表（折線或長條）、按期間對比、與 POS 報表 cross-link。 |
| 補貨閉環 UI | `/admin/replenishment` 支援「將勾選內容匯出為草稿 PO」→ 確認後建立 PO → 導到採購單。 |

---

## Phase 3（3 ~ 4 個月）：Loyalty / CRM 收斂 + 行銷工作台

### 後端

| 任務 | 說明 |
|------|------|
| 活動成效報表 | 擴充 `GET /loyalty/reports/activity`：每個 dispatch-rule / coupon 的發送數、使用數、點數成本、帶來營收。 |
| CRM job 監控 | 擴充 `GET /crm/jobs/:id`：可依 kind、期間查歷史 job list。 |

### 前端

| 任務 | 說明 |
|------|------|
| 會員管理路由收斂 | `AdminCustomersPage` 為唯一入口；`/admin/loyalty/members` redirect；修正 E2E。 |
| 行銷活動總覽 | dispatch-rules 列表上方加「最近 job 結果」摘要；點擊可查看歷史。 |
| 活動報表進階 | 每條 dispatch-rule / coupon 的成效卡片。 |

---

## Phase 4（4 ~ 6 個月）：Ops / 監控 + 進階報表穿透

### 後端

| 任務 | 說明 |
|------|------|
| Job Dashboard API | `GET /ops/jobs`（分頁、kind 篩選、status、from/to），支援錯誤訊息摘要。 |
| 報表穿透 API | 各模組報表支援 `referenceId` 互相連結（Finance ↔ POS ↔ Loyalty）。 |

### 前端

| 任務 | 說明 |
|------|------|
| Job 監控頁 | `/admin/ops/jobs`：job list、成功／失敗、手動補跑建議。 |
| 報表穿透 | Finance 報表 → 點擊 referenceId 跳到 POS 訂單；Loyalty 活動 → 點擊券號跳到用券明細。 |

---

## Phase 5（長期選配）：多商家 / 權限

| 任務 | 說明 |
|------|------|
| 多商家切換 | 從 `useDefaultMerchantId` 演進到真正的「商家選取器」。 |
| 角色與權限 | 店長 / 店員 / 財務角色，UI 依權限顯示或隱藏操作按鈕。 |
| RBAC API | 後端 middleware 依角色控制 API scope。（**本專案目前長期 skip**；本輪未落地） |

> 此 Phase 獨立規劃，不與前面綁定。

---

## 本輪落地補充（INSTRUCTIONS-005）

- **Inventory 即期庫存 summary**：`GET /inventory/expiring?groupBy=product`（搭配 `warehouseId`、`daysAhead`、分頁）供面板使用。
- **Promotion 拖曳排序限制**：`PATCH /promotion-rules/reorder/bulk` **必須包含該 merchant 全部規則 ids**；partial reorder 會回 `PROMOTION_REORDER_INVALID`（前端可一次送完整列表）。
- **條碼 fixture（E2E）**：`pnpm e2e:seed` 會確保存在可查條碼 `q=E2E-BC-0001`（供 `GET /products/search-barcode`）。

## 本輪狀態補充（INSTRUCTIONS-006）

- **RBAC**：雖 `BACKEND-INSTRUCTIONS 006.md` 要求落地，但依目前產品決策仍 **暫不實作**（避免反覆漂移，後續若要做請先定認證方式與角色來源）。
- **Barcode**：維持「允許重複 + 多筆命中回 items[]」的契約，前端需在多筆時提供選擇列表。
- **換貨 Phase 2**：訂單明細回 `exchangeSettlement`，包含退款事件摘要（SALE_REFUND），供驗收與導引。

---

## 各 Phase 與現有文件對照

| 文件 | 覆蓋範圍 |
|------|----------|
| [finance-accounting-roadmap.md](finance-accounting-roadmap.md) | Finance 事件、查詢、匯出、關帳、Audit、快照（Phase 1～2 金流細部） |
| [crm-member-roadmap.md](crm-member-roadmap.md) | CRM 階段 A～G（Phase 1～3 會員與 Loyalty 細部） |
| [inventory-roadmap.md](inventory-roadmap.md) | 庫存事件、餘額、調撥、盤點、批次效期、補貨建議（Phase 1～4） |
| [order-roadmap.md](order-roadmap.md) | POS 訂單、賒帳、補款／退款、退貨入庫、匯出與報表 |
| [purchase-roadmap.md](purchase-roadmap.md) | 採購、供應商、進貨驗收、補貨→PO、退供應商 |
| [product-roadmap.md](product-roadmap.md) | 商品、分類、品牌、標籤、CSV 匯入 |
| [promotion-roadmap.md](promotion-roadmap.md) | 促銷規則、POS 試算、與 Loyalty 整合 |
| [ops-roadmap.md](ops-roadmap.md) | Job 監控、OpsJobRunLog、getStatus、listJobs |
| [api-design-inventory-finance.md](api-design-inventory-finance.md) | 庫存與金流 API 契約 |
| [api-design-loyalty.md](api-design-loyalty.md) | Loyalty API 契約 |
| [api-design-purchase.md](api-design-purchase.md) | 採購 API 契約 |
| [api-design.md](api-design.md) | 全站 API 總索引 |
| [frontend-ui-principles.md](frontend-ui-principles.md) | 前端視覺原則（全 Phase 適用） |
| [member-management-review.md](member-management-review.md) | 會員頁面整合方案（Phase 1 撰寫、Phase 3 實施） |

---

**文件版本**：初版 2026-03-17；對照現有實作以 agent-log 最新條目為準。
