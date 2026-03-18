# 後端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。

---

## 1. 本輪必做

> 後端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 010** 追加一筆。

### 本輪任務（依序完成，全部必做）

> 依 `progress/integrated-last-cycle.md` 最新缺口：本輪以 **CI gate（full fixtures 必跑）+ click-audit 視覺化 v2（健康分數/告警）+ 行銷常駐規則正式化決策** 推進。RBAC 長期 skip（不做）。

| # | 任務 | 說明 |
|---|------|------|
| 1 | **迴歸維護 + commit 檢查** | `pnpm --filter pos-erp-backend test` 全綠；`prisma migrate deploy` 可跑通；結束前固定檢查 `git status/diff`，有變更必提交 commits 並在 agent-log 列出。 |
| 2 | **E2E full fixtures：補金流報表資料集** | 目前 full profile 已有 events；補齊「金流報表必不 skip」所需固定資料（events/partyId/referenceId），讓前端 `admin-smoke` 金流報表段落在 full profile 下可跑。補最小整合測試（seed 後 GET /finance/events 可查）。 |
| 3 | **CI：把 e2e-full 變成可選 gate（非每日也可手動）** | 在 `.github/workflows/e2e-full.yml` 補清楚輸出：缺 fixture/環境不就緒要 fail-fast；並把關鍵 specs 列為固定清單（barcode multi-match、換貨 settlement、click-audit 視覺化、金流報表）。 |
| 4 | **Click-audit：健康分數/門檻 API（v2）** | 在 summary 增 `health`（例如 NOT_FOUND 比例、MULTI_MATCH 比例、NAVIGATED 成功率）與門檻判定（OK/WARN/ALERT）；補整合測試。 |
| 5 | **Click-audit：修復路徑分類（v2）** | 將 resultCode 進一步映射成 `fixHint`（DATA_MISSING / NEEDS_DISAMBIGUATION / PERMISSION / OK）供前端顯示「下一步」。補文件與測試。 |
| 6 | **行銷常駐規則：正式化決策與保護** | 若要上線：補「重複發券防護」（同客戶同券同期間）與「失敗重試策略」最小版；並在 runner 寫入 lastRunCode/Note。補整合測試覆蓋重複防護。 |
| 7 | **文件對齊** | 更新 `docs/e2e-pos.md`（full fixtures 含金流報表）、`docs/ops-roadmap.md`（health/fixHint）、`docs/crm-member-roadmap.md`（常駐規則正式化）。 |

---
