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

| # | 任務 | 說明 | INSTRUCTIONS |
|---|------|------|--------------|
| 2 | **色值 token 統一** | 批次替換 `border-[#e2e8f0]` → `border-brand-surface`、`#0ea5e9` / slate/neutral → brand token；詳見 §6。 | 030 #3 |
| 3 | **四組報表 E2E 擴充** | 025 已列；驗證會員營收貢獻、營收趨勢、客單價分布、金流趨勢。 | 030 #1 |
| 4 | **錯誤區塊統一 Alert** | 自訂 amber/red 改為 `<Alert variant="error">`；詳見 §6.7。 | 030 #4 |
| 5 | **表格 overflow 修正** | AdminMerchantsPage、AdminSuppliersPage overflow-hidden → overflow-x-auto。 | 030 #5 |
| 6 | **空態統一 EmptyState** | 自訂空態 div 改為 `<EmptyState message="…" />`；詳見 §6.7。 | 030 #6 |

### 低優先（Phase 1 設計債）

| # | 任務 | 說明 |
|---|------|------|
| 7 | **Product schema 擴充** | 後端**已實作**（baseline 含欄位；product.service/repository/CSV 已支援）；前端商品表單對應可選。 |
| 8 | **AdminMerchantsPage StandardListLayout** | 若結構允許，改用 StandardListLayout 外殼。 |
| 9 | **空態／錯誤／載入補齊** | AdminInventoryPage、AdminProductsPage 等確認無遺漏情境。 |

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

---

## 六、逐頁 UX/UI 優化審查（補充）

> 產出日期：2026-03-19  
> 審查維度：色值 token、空態／錯誤／載入、max-width、StandardListLayout、可及性、響應式、一致性

### 6.1 審查維度總覽

| 維度 | 規定／目標 |
|------|-----------|
| **色值 token** | 使用 `border-brand-surface`、`text-muted`、`text-content`、`brand-primary`，避免硬編碼 gray/slate/neutral |
| **空態／錯誤／載入** | EmptyState、`Alert variant="error"`、skeleton 或「載入中…」 |
| **max-width** | 列表／報表 `max-w-6xl`；總覽 `max-w-6xl`～`max-w-7xl`；表單 `max-w-2xl`～`max-w-4xl` |
| **StandardListLayout** | 列表／報表類頁面採用，提供 title、actions、filters、loading、error、empty |
| **可及性** | 表單 label、按鈕 focus ring、role/aria |
| **響應式** | 表格 `overflow-x-auto`、行動裝置可讀性 |
| **一致性** | actions 右上、filter 標題下方、卡片樣式統一 |

### 6.2 Login

| 頁面 | 問題 | 優化建議 |
|------|------|----------|
| LoginPage | 健康狀態 `text-emerald-600`/`text-red-700`；無 loading；`shadow-neutral-900/5` | 改 token；表單提交加 loading；錯誤改 Alert |

### 6.3 POS

| 頁面 | 問題 | 優化建議 |
|------|------|----------|
| PosPage | `shadow-slate-200`、`bg-slate-50`、`hover:bg-slate-100` | 改用 brand-surface、text-muted、bg-table-head |
| PosCheckoutModal | `bg-slate-900/40`、`hover:bg-slate-100`；可能缺 role/aria | 改 backdrop token；補 role="dialog"、aria-modal |
| PosOrderDetailPage | `bg-slate-50/90`、`border-slate-100`；自訂 loading；無 EmptyState | 改 token；統一 skeleton；空訂單用 EmptyState |
| PosOrdersListPage | `border-slate-300`；無 StandardListLayout | 改 border-brand-surface；評估 StandardListLayout |
| PosPromosPage | 錯誤用 amber 自訂樣式；空態自訂 div | **改 Alert variant="error"**；**改 EmptyState** |
| PosReportsPage | skeleton `bg-slate-200`；錯誤 inline | 改 token；錯誤改 Alert |

### 6.4 Admin

| 頁面 | 問題 | 優化建議 |
|------|------|----------|
| AdminDashboardPage | 錯誤 `border-red-200 bg-red-50`；無 loading skeleton | **改 Alert**；載入加 skeleton |
| AdminProductsPage | `border-slate-100`；側欄 shadow 硬編碼 | 改 token；陰影共用 |
| AdminInventoryAdjustPage | max-w-7xl；成功／錯誤非 Alert | 對照規格調 max-width；改 Alert |
| AdminQuickReceivingPage | `border-neutral-50` 表格列 | 改 border-brand-surface |
| AdminReplenishmentPage | `border-slate-100`、`border-neutral-100`；空態自訂 | 改 token；**改 EmptyState** |
| AdminPurchaseOrdersPage | 大量 `border-neutral-*`、`text-neutral-*` | 收斂為 token |
| AdminReceivingNotesPage | `border-neutral-100`、`border-neutral-200` | 改 token |
| AdminSuppliersPage | `border-neutral-*`；**overflow-hidden** | 改 token；**overflow-x-auto** |
| AdminReportsPage | `border-slate-100`；錯誤 inline | 改 token；改 Alert |
| AdminDispatchRulesPage | `border-slate-100`；無 StandardListLayout | 改 token；評估 StandardListLayout |
| AdminOpsJobsPage | 自訂 spinner 與 StandardListLayout 並存；`border-neutral-50` | 統一 loading；改 token |
| AdminMerchantsPage | **overflow-hidden**；`border-slate-100`；部分 input 缺 focus ring | **overflow-x-auto**；改 token；補 focus ring |
| AdminCustomerImportPage | `border-slate-100` | 改 token |
| AdminPromotionEditPage | max-w-6xl（表單類可縮窄） | 評估 max-w-2xl～4xl |

### 6.5 Loyalty

| 頁面 | 問題 | 優化建議 |
|------|------|----------|
| LoyaltyDashboardPage | 錯誤 `border-red-200 bg-red-50`；`divide-neutral-100`；空態自訂 | **改 Alert**；改 token；**改 EmptyState** |
| LoyaltyPointLedgerPage | Tab `bg-slate-900`；`divide-neutral-100`；無 EmptyState | 改 token；補 EmptyState |
| LoyaltyCouponsPage | 錯誤 amber/red 自訂；select `border-neutral-300`；無 focus ring | **改 Alert**；改 token；補 focus ring |
| LoyaltyTierRulesPage | `border-slate-100`；無 Alert、EmptyState | 改 token；關鍵錯誤改 Alert；補 EmptyState |

### 6.6 跨頁一致性摘要

| 項目 | 現況 | 建議 |
|------|------|------|
| **錯誤顯示** | 混用 Alert、inline div、amber/red 自訂 | 統一 `<Alert variant="error">` |
| **空態** | 混用 EmptyState、自訂 div、表格內文字 | 統一 `<EmptyState message="…" />` |
| **載入** | 混用「載入中…」、spinner、skeleton | 列表用 StandardListLayout loading，圖表用 skeleton |
| **表格邊框** | slate-100、neutral-50/100/200 混用 | 統一 `border-brand-surface` |
| **表單 focus** | 部分 select/textarea 缺 | 全表單 `focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20` |
| **表格 overflow** | AdminMerchantsPage、AdminSuppliersPage 用 overflow-hidden | 改為 `overflow-x-auto` |

### 6.7 優先修復（對應 INSTRUCTIONS）

| 優先 | 任務 | 影響頁面 |
|------|------|----------|
| **高** | 錯誤區塊統一 Alert | PosPromosPage、AdminDashboardPage、LoyaltyDashboardPage、LoyaltyCouponsPage |
| **高** | 表格 overflow-hidden → overflow-x-auto | AdminMerchantsPage、AdminSuppliersPage |
| **中** | 硬編碼 gray/slate/neutral → token | 多數 Admin、Loyalty、POS 頁面 |
| **中** | 空態統一 EmptyState | PosPromosPage、AdminReplenishmentPage、LoyaltyDashboardPage、LoyaltyPointLedgerPage、LoyaltyTierRulesPage |
| **低** | 表單 focus ring、max-width、StandardListLayout 評估 | 見各頁詳表 |
