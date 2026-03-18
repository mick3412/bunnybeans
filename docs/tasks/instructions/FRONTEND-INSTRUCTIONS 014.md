# 前端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。
---

## 1. 本輪必做

> 前端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 014** 追加一筆。

### 本輪任務（依序完成，全部必做）

> 本輪包含：`dispatch-rules` run log 導向驗收（前端 gap）+ 報表穿透 E2E 穩定性（referenceId 可點擊）+ 全站 UI/UX 再審視（按鈕/空態/錯誤態行動建議）+ Admin hub/Scoped Search Params returnTo 行為驗收。RBAC 長期 skip（不做）。

| # | 任務 | 說明 |
|---|------|------|
| 1 | **固定 commit 檢查（必做）** | 結束前固定檢查 `git status/diff`，有變更必提交 atomic commits（每個至少 build 綠），並在 agent-log 列出 sha + message。 |
| 2 | **迴歸維護（build + 必要 E2E）** | `pnpm --filter pos-erp-frontend build` 全綠；以 `E2E_PROFILE=full` 下跑受影響的 e2e 至少包含：`admin-dispatch-rules.spec.ts`、報表穿透相關（例如 admin-smoke/旅程 spec）。 |
| 3 | **AdminDispatchRulesPage：Run log 按鈕改為導向驗收** | 確保「查看 run log」不是 toast，而是實際導向 `/admin/ops/jobs?kind=crm-run-scheduled`；必要時帶 from/to 以縮小結果集。 |
| 4 | **E2E：dispatch-rules full gate 驗收不得 skip** | 更新/擴展 `e2e/admin-dispatch-rules.spec.ts`：觸發 runner 後驗證規則 `lastRunAt/lastRunCode/lastRunNote` 非空，並點 run log 後確認 `/admin/ops/jobs` 篩選到 `crm-run-scheduled` 且有對應結果。 |
| 5 | **UI：dispatch-rules/ops jobs 的 selector 穩定性補強** | 對 run log 導向按鈕、lastRun 顯示區塊增加 `data-testid`（或明確可定位的文字/角色），避免 strict mode/多筆匹配。 |
| 6 | **報表穿透 E2E：移除 full profile 對 referenceId 的 skip** | 修改 `e2e/admin-journey-exchange-loyalty.spec.ts`（以及任何與 referenceId 穿透相關的 spec）：在 `E2E_PROFILE=full` 時不得因 referenceId 按鈕數量為 0 而 skip；要驗證導向 `/pos/orders/:id` 且頁面元素可見，再回到來源並檢查後續旅程頁。 |
| 7 | **報表穿透 E2E：驗證互動、導向與 returnTo（hub/Scoped Search Params）** | 補/強化 assertions：`ReferenceIdLink` 點擊後導向 `/pos/orders/:id`（或 receiving note 對應頁）載入成功；返回來源時可見「回到來源」並且頁面標題/關鍵區塊顯示正常（同時避免 scoped query key 衝突導致回程狀態遺失）。 |
| 8 | **錯誤訊息一致性（全站範圍）** | 針對本輪影響到的頁面：API 401/非 401 錯誤的 toast/alert 文案與 disabled loading 狀態要一致，並讓 E2E 能預期 skip/錯誤態（不假成功）。 |
| 9 | **全站 UI/UX 再審視：所有頁面與各細項/按鈕逐項打點** | 針對全站所有頁面與互動做 UI/UX 巡檢：按鈕文案清楚、disabled/loading 一致、tooltip/提示可理解、空態/錯誤態有行動建議；必要時補 e2e selector/斷言策略，且修改以不破壞現有 API 契約為原則。 |
| 10 | **文件對齊** | 更新 `docs/e2e-pos.md`：補上「報表穿透 E2E 不再 skip 的前置條件（referenceId UUID-like 契約）」與「returnTo/hub 下仍可回到正確頁面」的驗收要點。 |

---

