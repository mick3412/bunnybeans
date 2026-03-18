# 後端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。

---

## 1. 本輪必做

> 後端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 009** 追加一筆。

### 本輪任務（依序完成，全部必做）

> 本輪聚焦於 **可觀測性視覺化（click-audit）+ E2E/CI 一致性（減少 skip）+ 行銷常駐規則驗收**。RBAC 依 roadmap 長期 skip（不做）。

| # | 任務 | 說明 |
|---|------|------|
| 1 | **迴歸維護 + commit 檢查** | `pnpm --filter pos-erp-backend test` 全綠；`prisma migrate deploy` 可跑通。結束前固定檢查 `git status/diff`，若有變更必提交 commits，並在 agent-log 列出 sha。 |
| 2 | **ReportClickAudit：resultCode 進階彙總 API** | 在 summary 增：`topSources`（NOT_FOUND/MULTI_MATCH 排行）、`trendByDay`（近 N 日趨勢）、`topReferenceIds`（最常失敗 referenceId/欄位）。補 integration-spec（至少 2 組 filter 組合）。 |
| 3 | **ReportClickAudit：drill-down 查詢強化** | click-audit list 補 `resultCode` filter、`source/kind/referenceId` 交叉篩選、排序一致性；補整合測試。 |
| 4 | **E2E_PROFILE=full（建議）** | 讓 `pnpm e2e:seed` 支援 `E2E_PROFILE=full`：一次產出 barcode single/multi-match、換貨 settlement、金流報表 events（reports 可查）的固定資料集；文件寫明 fixture keys。 |
| 5 | **CI：nightly 或手動觸發 E2E（可選）** | 新增/調整 workflow：migrate deploy → e2e:seed(full) → playwright 指定 suite；缺 fixture 直接 fail-fast（不要默默 skip）。 |
| 6 | **行銷常駐規則：runner 驗收補齊（選配但建議）** | 若要正式上線：補「啟用規則掃描→發券 job→寫入 OpsJobRunLog」的整合測試（含失敗原因），並確認可由 ops/jobs 查到。 |
| 7 | **行銷常駐規則：最低監控指標** | 對常駐規則 runner 寫入 `resultCode/summary`（例如 SENT/SKIPPED/FAILED），讓前端可以顯示最近執行結果；補最小測試。 |
| 8 | **文件對齊** | 更新 `docs/e2e-pos.md`（full profile 一鍵指令、必要 env、fixture keys）、`docs/ops-roadmap.md`（resultCode 視覺化/彙總欄位）、`docs/crm-member-roadmap.md`（常駐規則驗收狀態）。 |

---
