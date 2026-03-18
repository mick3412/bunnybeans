# 後端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。
---

## 1. 本輪必做

> 後端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 012** 追加一筆。

### 本輪任務（依序完成，全部必做）

> 本輪以 **發券規則常駐化（dispatch-rules）E2E/CI 驗收 + seed 可定位性 + Ops job 導向一致性** 推進。RBAC 長期 skip（不做）。

| # | 任務 | 說明 |
|---|------|------|
| 1 | **迴歸維護 + commit 檢查** | `pnpm --filter pos-erp-backend test` 全綠；結束前固定檢查 `git status/diff`，有變更必提交 atomic commits 並在 agent-log 列出 sha + message。 |
| 2 | **E2E full fixtures：新增 dispatch-rules runner 所需固定資料（可重放）** | 在 `backend/scripts/e2e-seed.ts` full profile 新增：分群（segment）、優惠券（coupon）與一筆 `CrmCouponDispatchRule`（`enabled=true` 且 `nextRunAt <= now`）。要求：**命名/代碼固定**（例如 `E2E-SEGMENT-*` / `E2E-COUPON-*` / `E2E-RULE-*`）+ **先刪後建**（teardown/deleteMany），確保可重複執行且不依賴歷史資料。 |
| 3 | **E2E fixtures：保障 runner 作用範圍（只掃 enabled & nextRunAt <= now）** | 針對 seed 至少保證：存在 1 筆「應該會跑」的規則 + 1 筆「不應該會跑」的規則（例如 `enabled=false` 或 `nextRunAt > now`），用於驗收正/負向邊界（不需要前端馬上驗，但後端測試必有）。 |
| 4 | **OpsJobRunLog 對應驗收（crm-run-scheduled）** | 執行 runner 後，確保 Ops job 記錄 `jobType=crm-run-scheduled`，且其中能反映本次規則更新（例如 message 含 rule 名稱/至少表示 jobId）。至少在 integration-spec 或 E2E 前置檢查中驗證。 |
| 5 | **Integration：dispatch runner 邏輯邊界補全（正/負向）** | 擴展 `backend/src/modules/crm/crm.integration-spec.ts`（或對應 integration）增加：disabled 規則不觸發（lastRunCode/lastRunNote 行為符合設計）、nextRunAt 在未到時間不觸發、同期間重複觸發必為 `SKIPPED` 且 lastRunNote 包含 `duplicate-protection`，失敗時 `lastRunCode=FAILED` 且 `nextRunAt` 後延約 +30min。 |
| 6 | **API 合約：dispatch-rules list 回傳 lastRun 欄位** | 確保 `GET /crm/dispatch-rules`（列表）包含 `lastRunAt/lastRunCode/lastRunNote` 的回傳（即使為 null 也要欄位一致），並補最小 integration-spec 保證前端可依此渲染。 |
| 7 | **E2E：dispatch-rules full gate 驗收不得 skip** | 擴展/新增 `e2e/admin-dispatch-rules.spec.ts`：在 `E2E_PROFILE=full` 下觸發 runner（UI 或 `POST /crm/jobs/run-scheduled`，以專案實際可用入口為準），驗證規則列的 `lastRunAt/lastRunCode/lastRunNote` 非空，且顯示的內容合理（例如 lastRunCode = SENT/SKIPPED/FAILED 之一）。 |
| 8 | **E2E：run log 對應到 /admin/ops/jobs** | 擴展 E2E：從 dispatch-rules 頁進入「查看 run log」後，Ops job 表格能看到 `crm-run-scheduled` 且對應到同一輪 lastRunAt（允許時間差但不可空）。 |
| 9 | **CI：把 dispatch-rules spec 納入 `e2e-full.yml` 固定清單（fail-fast）** | 在 `.github/workflows/e2e-full.yml` 固定加入 `e2e/admin-dispatch-rules.spec.ts`，並確保如果 fixtures/env/seed 未就緒要 fail-fast（不要默默 skip）。同時在 step 輸出列出預期 fixture keys（對人好 debug）。 |
| 10 | **文件對齊** | 更新 `docs/e2e-pos.md`：dispatch-rules full gate 驗收流程與必要 env；更新 `docs/crm-member-roadmap.md`：常駐驗收狀態（重複防護/失敗重試）及「如何在 full profile 驗證」。 |

---

