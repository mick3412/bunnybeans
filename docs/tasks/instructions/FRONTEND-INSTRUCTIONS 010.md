# 前端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。

---

## 1. 本輪必做

> 前端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 010** 追加一筆。

### 本輪任務（依序完成，全部必做）

> 本輪以 **CI gate（full fixtures 必跑）+ click-audit 視覺化 v2（健康分數/告警/修復路徑）+ 行銷常駐規則正式化** 推進。RBAC 長期 skip（不做）。

| # | 任務 | 說明 |
|---|------|------|
| 1 | **固定 commit 檢查（必做）** | 結束前固定檢查 `git status/diff`；有變更必提交 atomic commits（每個至少 build 綠），並在 agent-log 列出 sha + message。 |
| 2 | **迴歸維護（build + E2E）** | `pnpm --filter pos-erp-frontend build` 全綠；full fixtures 就緒時，`admin-smoke` 的金流報表段落不得 skip。 |
| 3 | **click-audit 視覺化 v2：健康分數 + 告警** | 在 `/admin/ops/report-clicks` 顯示 health（NOT_FOUND 比例、MULTI_MATCH 比例、NAVIGATED 成功率）與 OK/WARN/ALERT；支援依期間切換。 |
| 4 | **click-audit 視覺化 v2：修復路徑** | 在 drill-down 對每個 resultCode 顯示 fixHint（DATA_MISSING / NEEDS_DISAMBIGUATION / PERMISSION / OK）與「下一步」按鈕（導到條碼選擇/補 fixture 指引/權限提示）。 |
| 5 | **E2E：把金流報表從 skip 變必跑** | 在 full fixtures 下新增/調整 1 支 E2E：驗證金流報表能查到固定資料集（至少 1 筆 event + summary）。CI e2e-full 跑這支不得 skip。 |
| 6 | **行銷常駐規則：正式化 UX** | 在行銷規則列表顯示 lastRunCode/Note、提供「查看 run log」捷徑；若後端補重複防護/重試，前端補提示文案與手測清單。 |

---
