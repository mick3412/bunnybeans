# 上一輪整合（規格 Agent 每輪覆寫）

**最新 agent-log（以 INSTRUCTIONS 編號為準）**：後端 **009** · 前端 **009**  
（路徑：[agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md)、[agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md)）

## 後端（收斂摘要）

- **INSTRUCTIONS 009 已完成（click-audit 可觀測性彙總 + E2E full fixtures/CI + CRM runner 監控欄位）**：\n+  - **Click-audit 進階彙總**：summary 增 `topSources`（NOT_FOUND/MULTI_MATCH 排行）、`trendByDay`、`topReferenceIds`；list 增 `resultCode` filter（整合測試覆蓋）。\n+  - **E2E full profile**：`E2E_PROFILE=full` 的 `e2e:seed` 一次產出 barcode single/multi-match、換貨 settlement（含 SALE_REFUND）、金流報表用 events，並做 fail-fast 驗證。\n+  - **CI E2E**：新增 `.github/workflows/e2e-full.yml`（migrate deploy → db:seed → e2e:seed(full) → playwright）。\n+  - **CRM 常駐規則監控**：`CrmCouponDispatchRule` 新增 `lastRunAt/lastRunCode/lastRunNote`，runner 寫入並可由 ops/jobs 追蹤；補測試。\n+- **回歸**：`pnpm --filter pos-erp-backend test` 全綠；migrations 可 deploy。\n+- **RBAC**：維持長期 skip（客戶不需要）。

## 前端（收斂摘要）

- **INSTRUCTIONS 007 已完成（條碼多筆命中閉環＋click-audit resultCode 上報＋退供 UI 補全）**：\n+  - **條碼多筆命中 UX**：POS/庫存掃碼多筆命中提供選擇列表，並新增最小 E2E 覆蓋多筆命中。\n+  - **退供應商完整 UI**：驗收（COMPLETED）退供區塊補逐列原因輸入、送出後明細回顯。\n+  - **click-audit resultCode**：referenceId 點擊上報 `resultCode`，後台頁補欄位與 filter。\n+  - **commits**：本輪已提交多筆 atomic commits（詳見 agent-log 前端 007 條目）。\n+- **回歸**：`pnpm --filter pos-erp-frontend build` ✅；E2E 依 seed/環境條件 pass/skip（已明確列出 skip 原因）。
- **INSTRUCTIONS 009 已完成（click-audit 視覺化 + full profile E2E 規則）**：\n+  - `/admin/ops/report-clicks` 增 resultCode 排行與趨勢，並在 drill-down 提供可操作導引。\n+  - 行銷常駐規則頁顯示最近一次執行摘要並可跳 `/admin/ops/jobs`。\n+  - E2E 規則：在 full profile 下改為「缺 fixture fail」而非長期 skip，並補 click-audit 視覺化 smoke。\n+- **commits**：本輪已提交 commits（詳見 agent-log 前端 009 條目）。\n+- **回歸**：build 維持全綠；E2E 仍可能因「金流報表資料/後端可連」而 skip（待 full fixtures 覆蓋）。

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
| ops-roadmap / 可觀測性 | **ReportClickAudit 視覺化 v2（可用性指標化）**：既有排行/趨勢已完成；下一步補「門檻告警/健康分數」（例如 NOT_FOUND 比例）與 drill-down 的「修復路徑」（資料缺口/多筆命中/權限）。 | 中 |
| e2e/ci | **E2E 變成可預期的 CI gate**：`e2e-full.yml` 已有；下一步把關鍵 suite（barcode multi-match、換貨 settlement、click-audit 視覺化、金流報表資料集）在 full fixtures 下改為必跑且不得 skip，並把「金流報表需資料」也納入 fixtures。 | 中 |
| crm-member-roadmap（階段 G） | **發券規則常駐化（是否正式上線）**：已補 lastRun 欄位與 UI 摘要；下一步需決定是否上線（排程策略、重複發券防護、失敗重試/告警）並補驗收。 | 低 |

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
- **E2E 環境一致性**：前端 E2E 需 DATABASE_URL、後端 :3003、VITE_ADMIN_API_KEY；建議 CI 或專用聯調環境定期跑完整 suite（admin-smoke、admin-bulk、admin-loyalty-smoke、admin-pos-reports、admin-replenishment、admin-balances、admin-dispatch-rules、admin-categories）。

---

本檔為**實際進度總結**，下一輪具體任務見 [tasks/instructions/](../tasks/instructions/)（開啟最新編號檔案）§1。
