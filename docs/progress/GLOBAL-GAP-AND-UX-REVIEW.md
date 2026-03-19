# 全局缺口審查 + UX/UI 優化審查

> 產出日期：2026-03-19  
> 對照：integrated-last-cycle、erp-roadmap、frontend-layout-rules、實際 codebase

---

## 一、全局缺口總覽

### 1.1 依模組／來源

| 來源 | 缺口 | 優先 | 狀態 |
|------|------|------|------|
| **驗收** | E2E 補跑（admin-categories、admin-ops-report-clicks-full、admin-balances、admin-pos-reports） | 中 | 025 已列 |
| **erp-roadmap §0.1** | Product schema 擴充：specCapacity、specStyle、specWeight、expiryDescription | 低 | **已實作**（baseline + product.service/CSV） |
| **erp-roadmap §0.2** | 標籤接 API | — | **已接**（AdminCategoriesPage 已用 listProductTags/createProductTag 等） |
| **erp-roadmap §0.3** | Finance balances 契約 | — | **已對齊**（agent-log 023/024） |
| **erp-roadmap §0.4** | 側欄導覽 | — | **已完成**（會員路由收斂） |
| **erp-roadmap §0.5** | 類別管理三欄 | — | **已完成**（AdminCategoriesPage 已 `grid lg:grid-cols-3`） |
| **erp-roadmap §0.6** | 點數存摺 tab 中文 | — | **已完成**（LoyaltyPointLedgerPage TYPE_LABELS 已中文） |
| **erp-roadmap §0.7** | 倉庫門市對齊 | — | **已完成**（AdminWarehousesStoresPage 雙卡 grid） |
| **frontend-layout-rules** | 硬編碼色值統一為 token | 低 | 見 §二 |
| **StandardListLayout** | 未採用頁面評估 | 低 | 見 §三 |
| **erp-roadmap Phase 5** | RBAC | — | 長期 skip |

---

## 二、UX/UI 優化審查

### 2.1 色值與 token 統一

**frontend-layout-rules** 規定：
- 卡片邊框：`border-brand-surface`（#e2e8f0）
- 主色：`#0ea5e9` → 應改用 `text-brand-primary` / `bg-brand-primary` / `focus:border-brand-primary` 等

**現況**：多數頁面仍使用硬編碼 `border-[#e2e8f0]`、`#0ea5e9`、`focus:border-[#0ea5e9]`。

| 檔案 | 硬編碼處 | 建議 |
|------|----------|------|
| AdminInventoryPage | border-[#e2e8f0]、focus:[#0ea5e9] 多處 | 改 border-brand-surface、focus:border-brand-primary |
| AdminCategoriesPage | fieldClass border-[#e2e8f0] | 同上 |
| AdminSegmentExportPage | border-[#e2e8f0] | 改 border-brand-surface |
| AdminOpsJobsPage | border-[#e2e8f0]、#0ea5e9 | 改 token |
| AdminMerchantsPage | 同上 | 同上 |
| AdminCustomerImportPage | 同上 | 同上 |
| AdminProductsPage | 同上 | 同上 |
| AdminWarehousesPage | fieldClass | 同上 |
| AdminWarehousesStoresPage | cardClass | 同上 |
| AdminDispatchRulesPage | — | 已用 StandardListLayout，區塊內仍可能有硬編碼 |
| AdminPromotionEditPage | 多處 | 改 token |
| AdminPromotionsPage | 多處 | 改 token |
| LoyaltyTierRulesPage | border-[#e2e8f0]、text-[#0ea5e9] | 改 token |
| LoyaltyDashboardPage | 同上 | 同上 |
| LoyaltyPointLedgerPage | border-[#e2e8f0] | 改 border-brand-surface |
| LoyaltyReportActivityPage | 同上 | 同上 |
| LoyaltyMembersPage | 同上 | 同上 |
| AdminInventoryAdjustPage | formCard 等 | 同上 |
| AdminReportsPage | 區塊邊框、stroke | 同上 |

**建議**：批次替換 `border-[#e2e8f0]` → `border-brand-surface`、`#0ea5e9` → `brand-primary` 或對應 token，以利主題一致與後續維護。

### 2.2 空狀態／錯誤／載入

**frontend-layout-rules** 規定：
- 空狀態：`EmptyState` 元件
- 錯誤：`Alert variant="error"`
- 載入：統一「載入中…」或 skeleton

**已符合**：AdminSegmentsPage、AdminSuppliersPage、LoyaltyReportActivityPage、AdminDispatchRulesPage、AdminPurchaseOrdersPage、AdminReceivingNotesPage、AdminFinanceBalancesPage 等有 EmptyState 或 Alert。

**待檢查**：AdminInventoryPage、AdminProductsPage、AdminCategoriesPage、AdminQuickReceivingPage、AdminOpsJobsPage、AdminMerchantsPage 等是否所有情境（無資料、載入失敗、載入中）皆有對應 UI。

### 2.3 max-width 收斂

**frontend-layout-rules**：列表／報表類 `max-w-6xl`。

**現況**：多數已 `max-w-6xl`；AdminDashboardPage、AdminInventoryAdjustPage 為 `max-w-7xl`（總覽／表單類可接受）。

### 2.4 StandardListLayout 覆蓋

**已採用**（19 頁）：AdminMarketingRulesPage、AdminSegmentsPage、AdminReceivingNotesPage、AdminPromotionsPage、LoyaltySettingsPage、AdminFinanceBalancesPage、AdminReportsPage、AdminCrmJobsPage、AdminOpsReportClicksPage、AdminFinanceSnapshotsPage、AdminReplenishmentPage、AdminExpiringInventoryPage、AdminCustomersPage、AdminFinanceAuditPage、AdminFinancePeriodsPage、AdminMarketingRuleEditPage、AdminSuppliersPage、LoyaltyReportActivityPage、AdminPurchaseOrdersPage。

**未採用**（具特殊結構，需個別評估）：

| 頁面 | 原因 | 建議 |
|------|------|------|
| AdminCategoriesPage | 三欄 MasterSection，無典型列表 | 維持現狀 |
| AdminInventoryPage | 多 view、CSV 匯入、slow-moving、複雜篩選 | 可選：外殼用 StandardListLayout 包 title/filters，內容自訂 |
| AdminProductsPage | 雙欄表單＋表格、CSV、規格展開 | 維持現狀或僅外殼 |
| AdminDispatchRulesPage | 自訂 layout、job 摘要、表單 drawer | 可選：外殼對齊 |
| AdminOpsJobsPage | Job 列表＋補跑 Modal | 可選：外殼對齊 |
| AdminQuickReceivingPage | 表單為主 | 維持現狀 |
| AdminWarehousesStoresPage | 雙卡嵌 AdminStoresPage/AdminWarehousesPage | 維持現狀 |
| AdminStoresPage / AdminWarehousesPage | embedded 模式 | 維持現狀 |
| AdminMerchantsPage | 簡易列表 | 可改 StandardListLayout |
| AdminCustomerImportPage | 匯入流程 | 可選外殼 |
| AdminInventoryAdjustPage | 表單＋結果 | 維持現狀 |
| AdminDashboardPage | 總覽 KPI＋待辦 | 維持現狀 |
| PosReportsPage、PosOrdersListPage、PosOrderDetailPage、PosPromosPage | POS 流程 | 維持現狀 |
| LoyaltyPointLedgerPage、LoyaltyTierRulesPage、LoyaltyDashboardPage、LoyaltyMembersPage | Loyalty 專用 | 可選外殼 |

---

## 三、缺口清單（可執行任務）

### 高優先

| # | 任務 | 說明 |
|---|------|------|
| 1 | **E2E 補跑** | admin-categories、admin-ops-report-clicks-full、admin-balances、admin-pos-reports；025 已列。 |

### 中優先（UX 一致性）

| # | 任務 | 說明 |
|---|------|------|
| 2 | **色值 token 統一** | 批次替換 `border-[#e2e8f0]` → `border-brand-surface`、`#0ea5e9` / `focus:[#0ea5e9]` → `brand-primary` 相關 token；優先處理高流量頁（庫存、商品、金流報表、促銷）。 |
| 3 | **四組報表 E2E 擴充** | 025 已列；驗證會員營收貢獻、營收趨勢、客單價分布、金流趨勢。 |

### 低優先（Phase 1 設計債）

| # | 任務 | 說明 |
|---|------|------|
| 4 | **Product schema 擴充** | 後端**已實作**（baseline 含欄位；product.service/repository/CSV 已支援）；前端商品表單對應可選。 |
| 5 | **AdminMerchantsPage StandardListLayout** | 若結構允許，改用 StandardListLayout 外殼。 |
| 6 | **空態／錯誤／載入補齊** | AdminInventoryPage、AdminProductsPage 等確認無遺漏情境。 |

---

## 四、erp-roadmap §0 對照結論

| 項目 | 規格 | 現況 |
|------|------|------|
| 0.1 Product schema | 新增欄位 | **已實作**（specCapacity、specStyle、specWeight、expiryDescription；specColor/weightGrams 棄用保留） |
| 0.2 標籤 localStorage | 改接 API | **已接**（ProductTag CRUD + AdminCategoriesPage） |
| 0.3 Finance balances | 契約對齊 | **已完成** |
| 0.4 側欄導覽 | 會員路由收斂 | **已完成** |
| 0.5 類別管理三欄 | grid layout | **已完成**（lg:grid-cols-3） |
| 0.6 點數存摺 tab | 中文 | **已完成**（TYPE_LABELS） |
| 0.7 倉庫門市對齊 | layout 統一 | **已完成** |

---

## 五、建議下一輪納入

- **必做**：E2E 補跑、四組報表 E2E 擴充（025 已有）。
- **選配**：色值 token 統一（可拆多個 small PR）、AdminMerchantsPage StandardListLayout。
- **待產品決策**：Product schema 擴充（影響商品主檔，需與產品規格對齊）。
