# 前端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。

---

## 1. 本輪必做

> 前端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 009** 追加一筆。

### 本輪任務（依序完成，全部必做）

> 本輪聚焦於 **click-audit 視覺化 + drill-down** 與 **E2E/CI 一致性（減少 skip）**，並把「行銷常駐規則」補到可驗收狀態。RBAC 長期 skip（不做）。

| # | 任務 | 說明 |
|---|------|------|
| 1 | **固定 commit 檢查（必做）** | 結束前固定檢查 `git status/diff`，若有變更必提交 4～10 個 atomic commits（每個至少 build 綠）；在 agent-log 列出 sha + message。 |
| 2 | **迴歸維護（build + E2E）** | `pnpm --filter pos-erp-frontend build` 全綠；E2E 至少跑 `admin-smoke` + `admin-barcode-min`（full profile 就緒時不得 skip）。 |
| 3 | **click-audit 視覺化：resultCode 排行 + 趨勢** | 在 `/admin/ops/report-clicks` 增加：NOT_FOUND/MULTI_MATCH 排行（source/kind）、近 7/14/30 天趨勢（按 resultCode）。 |
| 4 | **click-audit drill-down：可操作導引** | 在 list 中針對 NOT_FOUND/MULTI_MATCH 提供「下一步」導引（例如 MULTI_MATCH 連到條碼選擇入口；NOT_FOUND 提示可能原因/如何補 fixture）。 |
| 5 | **E2E：full profile 下不再長期 skip** | 若後端提供 `E2E_PROFILE=full`：新增/調整 2～4 支 E2E（barcode multi-match、換貨 settlement、金流報表資料集、click-audit 視覺化），在 full profile 下不得 skip。 |
| 6 | **行銷常駐規則：最近執行結果 UI** | 在行銷規則頁（列表）顯示「最近一次執行」摘要（SENT/SKIPPED/FAILED + messageSummary），並連到 `/admin/ops/jobs` 篩選該 runLog。 |
| 7 | **測試/驗收文件化** | 更新 `docs/e2e-pos.md`：本機/CI 一鍵指令、必要 env、skip 規則（只有環境不就緒才可 skip）。 |

---
