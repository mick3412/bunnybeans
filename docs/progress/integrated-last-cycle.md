# 上一輪整合（規格 Agent 每輪覆寫）

**最新 agent-log（以 INSTRUCTIONS 編號為準）**：後端 **010** · 前端 **010**  
（路徑：[agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md)、[agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md)）

## 後端（收斂摘要）

- **INSTRUCTIONS 010 已完成（E2E full gate 強化 + click-audit v2 健康/修復提示 + 常駐規則保護）**：
  - **CI E2E full gate**：強化 fail-fast 與固定 specs 清單，並確保 full fixtures 下關鍵 suite 不默默 skip。
  - **Click-audit 視覺化 v2**：summary 追加 `health`（門檻判定 OK/WARN/ALERT）與 `fixHints[]`；list 增 `fixHint` 對應可操作修復路徑。
  - **行銷常駐規則正式化保護**：dispatch runner 支援同期間防重 `SKIPPED` 與失敗最小重試（`nextRunAt` 後延）→ `FAILED`，並補對應測試。
- **回歸**：`pnpm --filter pos-erp-backend test` 全綠；migrations 可 deploy。
- **RBAC**：維持長期 skip（客戶不需要）。

## 前端（收斂摘要）

- **INSTRUCTIONS 010 已完成（click-audit v2 健康/告警 + CI gate 強化 + 行銷常駐規則正式化 UX）**：
  - **Click-audit 視覺化 v2**：`/admin/ops/report-clicks` 顯示 `health`（門檻 OK/WARN/ALERT）與對應修復告警。
  - **修復路徑 drill-down**：每個 resultCode 提供 `fixHint` 與「下一步」按鈕導引。
  - **行銷常駐規則 UX**：列表顯示 `lastRunAt/lastRunCode/lastRunNote`，並提供 run log 入口。
- **回歸**：`pnpm --filter pos-erp-frontend build` ✅；E2E 依 full fixtures 設定 pass（缺 fixture 才能 skip）。
- **RBAC**：維持長期 skip（客戶不需要）。

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
| crm-member-roadmap（階段 G） | **發券規則常駐化「驗收」**：截至目前已補 lastRun 欄位與保護邏輯；下一步需要把「full fixtures 下的 dispatch-rules/runner 驗收」納入 E2E/CI（驗證 lastRunCode/lastRunNote、run log 導向一致）。 | 中 |

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
