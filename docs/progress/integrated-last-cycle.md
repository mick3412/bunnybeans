# 上一輪整合（規格 Agent 每輪覆寫）

**最新 agent-log（以 INSTRUCTIONS 編號為準）**：後端 **014** · 前端 **014**  
（路徑：[agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md)、[agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md)）

## 後端（收斂摘要）

- **INSTRUCTIONS 014 已完成（referenceId UUID-like 修復 + 報表穿透穩定性）**：
  - **E2E seed：UUID-like referenceId + deterministic occurredAt**：調整 POS order / receivingNote / exchange 對應 referenceId 為純 hex UUID-like，並補 deterministic occurredAt 以提升可重放性。
  - **Fail-fast 驗證（seed）擴充**：驗證 UUID-like 格式符合，且存在至少 1 筆 finance/報表事件可解析為 `posOrder/receivingNote`，避免 full profile 在 `ReferenceIdLink` 長期不可點。
  - **Ops reference resolve 邊界**：補 integration 以覆蓋 resolve 不落入 unknown 的邊界。
  - **文件對齊**：更新 `docs/e2e-pos.md` referenceId 契約與 full profile 驗收要點。
- **回歸**：`pnpm --filter pos-erp-backend test` 全綠（含 `e2e:seed` fail-fast）。
- **RBAC**：維持長期 skip（客戶不需要）。

## 前端（收斂摘要）

- **INSTRUCTIONS 014 已完成（dispatch-rules run log + referenceId 穿透 full gate）**：
  - **AdminDispatchRulesPage 驗收導向**：把「查看 run log」導向 `/admin/ops/jobs?kind=crm-run-scheduled`，並在 lastRun 區塊提供穩定 `data-testid`。
  - **referenceId 穿透 full gate**：移除 full profile 對 referenceId==0 的跳過，並修正換貨導引遮罩下「回到來源」的互動順序，確保旅程回跳與導向可穩定驗證。
  - **文件對齊**：更新 `docs/e2e-pos.md` full profile 驗收要點。
- **回歸**：`pnpm --filter pos-erp-frontend build` ✅；full profile 下跑 `e2e/admin-dispatch-rules.spec.ts` 與 `e2e/admin-journey-exchange-loyalty.spec.ts` ✅。
- **RBAC**：維持長期 skip（客戶不需要）。

## 前端：Admin 後台側欄 Hub 化與子頁面結構變更 Log

以下為你補充的結構化紀錄（Admin 後台為主），用於下一輪規格/驗收對齊：

1. SideBar 分層（由多細項 → 3 層架構）
   - Level 1（不可點）：只顯示分組標題，不連結（如：總覽／監控、商品/庫存、採購管理、財務、會員/行銷）
   - Level 2（可點主入口）：只保留「Hub 入口」，點擊會切換到對應 Hub 路由（但不再露出所有 Level 3 細項）
   - Level 3（原本的細項）：從側欄移除，改由 Hub 頁內用 tabs/區塊切換
   - 參考：`frontend/src/pages/admin/AdminLayout.tsx`（側欄三層標註與入口只剩 Hub）

2. 子頁面（Main 區塊）改為「Hub Page + In-page Tabs」
   - 新增/使用 Hub Page 作為 Level 2 的單一容器（同一路由框架內切換內容）
   - Hub 內依 activeTab 條件渲染（Level 3 切換不再跳到新路由）
   - 參考：`frontend/src/shared/utils/useScopedSearchParams.ts`

3. URL query 狀態管理改為「scope 命名避免鍵衝突」
   - scoped key：`finance.hub.tab`、`inventory.query.hub.tab`、`product.hub.tab`、`ops.monitoring.hub.tab`、`member.hub.tab`、`marketing.hub.tab`
   - `useScopedSearchParams(prefix)`：只讀取 prefix.*，更新只改該 scope，避免污染其他 Hub 參數
   - 參考：`frontend/src/shared/utils/useScopedSearchParams.ts` + `frontend/src/pages/admin/AdminLayout.tsx` 的 hubs mapping

4. App Route 改為「Hub 的 thin wrapper + backward compatibility」
   - `App.tsx` 將原本多個 Level 3 直接對應路由改為渲染 Hub 並帶 `initialTab`
   - 針對既有深連結（如 loyalty 子頁）保留 wrapper/redirect，落到對應 Hub + 正確 initialTab
   - 參考：`frontend/src/App.tsx`（大量 initialTab wrapper routes）

5. Header Title 改為依 hub tab 自動顯示
   - `AdminLayout.tsx` 依 pathname 判斷所屬 Hub，再依 scoped tab 狀態輸出一致頁頭文案
   - 參考：`frontend/src/pages/admin/AdminLayout.tsx` 的 `headerTitle()`

---

## 已開發模組進度

| 模組 | 後端 | 前端 | 備註 |
|------|------|------|------|
| Merchant | list、GET /merchant/current | 單一商家（useDefaultMerchantId） | 完成 |
| Product / Category / Brand / ProductTag | CRUD、import CSV、ProductTag CRUD | 列表、抽屜、import、分類維護、標籤接 API；UI 對齊 | 完成 |
| Inventory | events、balances、批次／效期、replenishment-suggestions | 庫存頁、匯出／盤點匯入、補貨建議 UI | 完成；補貨閉環已接 from-replenishment API |
| Finance | events、export、summary、balances、關帳、Audit、Snapshot | 金流報表、餘額頁、關帳／稽核 | 完成（Party 升級待 Phase 2） |
| POS | createOrder、orders、export、報表（summary／top-items／daily） | POS 介面、結帳、報表、深連結 | 完成 |
| Purchase | Supplier／PO／RN、return-to-supplier、**from-replenishment** | 供應商、採購單、驗收、補貨→PO 閉環 | 完成 |
| Loyalty / Promotion / CRM | settings、ledger、dashboard、TierRule、dispatch-rules、POINTS_MULTIPLIER | 儀表板、存摺、會員、優惠券、發券規則、job 狀態 | 完成 |
| Ops | OpsJobRunLog、GET /ops/jobs/status、**GET /ops/jobs**（分頁、kind 篩選）、**/ops/jobs/run（可追蹤）**、**click-audit list/summary** | Job 監控頁、穿透點擊審計頁（查詢） | 完成 |

---

## 未開發或部分開發項目 + 前期設計問題

> 詳見 [erp-roadmap.md](../erp-roadmap.md)。以下為摘要。

### 全局審查缺口清單（依 roadmap）

> 依 `erp-roadmap.md` 與各模組 roadmap（finance-accounting / crm-member / inventory / order / purchase / product / promotion / ops）交叉盤點。以「可落地的下一步」表述；已完成者不列入缺口。

| 來源 | 缺口 | 優先 |
|------|------|------|
| erp-roadmap / Phase 5 / admin-roles | **RBAC（長期 skip）**：客戶不需要角色/權限；維持現有 `AdminApiKeyGuard`（有/無管理金鑰）即可。本專案不落地 Role/Permission 資料模型與 permissions endpoint。 | 低 |
| frontend-ui-principles / UI Review | **全站 UI/UX 再審視（按鈕/空態/錯誤態行動建議 + loading/disabled 一致性 + selector 穩定性）**：將 shared 元件與 Admin Hub 通用區塊的狀態呈現一致化，並補強 E2E 可定位 selector，避免 strict-mode 多筆匹配與 race condition。 | 高 |
| ops-roadmap / CI E2E coverage | **E2E full gate 擴充：把更多 admin smoke spec 納入固定清單**：將 `admin-categories` / `admin-customers-import` / `admin-bulk` / `admin-replenishment` 納入 `.github/workflows/e2e-full.yml` 固定 suite，並補齊必要 seed/selector，降低 full profile 的 skip。 | 中 |

### 後續 Phase

| Phase | 主題 |
|-------|------|
| Phase 2 | Party 多方視圖、Finance summary 正式化 |
| Phase 3 | 會員頁收斂、行銷工作台 |
| Phase 4 | Ops Job 監控頁、報表穿透 |
| Phase 5 | 多商家、角色權限（選配） |

---

## 整合風險／待對齊

- **migration 可重放性**：歷史 migrations 的「從零建庫」可重放性需持續維持；若依賴 baseline/squash，需明確規範「新環境初始化」與「舊環境升級」兩條路徑，避免 CI/Preview 認知不一致。  
- **E2E 環境一致性**：前端 E2E 需 DATABASE_URL、後端 :3003、VITE_ADMIN_API_KEY；建議 CI 或專用聯調環境定期跑完整 suite（admin-smoke、admin-bulk、admin-customers-import、admin-loyalty-smoke、admin-pos-reports、admin-replenishment、admin-balances、admin-dispatch-rules、admin-categories）。

---

本檔為**實際進度總結**，下一輪具體任務見 [tasks/instructions/](../tasks/instructions/)（開啟最新編號檔案）§1。
