# 前端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。
---

## 1. 本輪必做

> 前端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 012** 追加一筆。

### 本輪任務（依序完成，全部必做）

> 本輪以 **AdminDispatchRulesPage run log 導向可驗收 + UI 渲染穩定性 + dispatch-rules full gate E2E 不得 skip** 推進。RBAC 長期 skip（不做）。

| # | 任務 | 說明 |
|---|------|------|
| 1 | **固定 commit 檢查（必做）** | 結束前固定檢查 `git status/diff`，有變更必提交 atomic commits（每個至少 build 綠），並在 agent-log 列出 sha + message。 |
| 2 | **迴歸維護（build + E2E）** | `pnpm --filter pos-erp-frontend build` 全綠；`E2E_PROFILE=full` 下需跑 `e2e/admin-dispatch-rules.spec.ts`，不得長期 skip。 |
| 3 | **AdminDispatchRulesPage：把「查看 run log」按鈕改成導向可驗收** | 由目前 toast 改為實際導向 `/admin/ops/jobs?kind=crm-run-scheduled`；若 row 有 `lastRunAt` 且能用 UI 查詢，則可選擇帶 `from/to` 以縮小結果集（不影響功能）。 |
| 4 | **UI：新增 E2E 可用的穩定 selector** | 對每筆規則的 `lastRunAt/lastRunCode/lastRunNote` 與「查看 run log」入口增加 `data-testid`（或明確可被 locator 選到的角色/文字），避免 strict mode/多筆匹配問題。 |
| 5 | **UI：空態/邊界行為** | 若沒有 dispatch-rules（或 lastRun 欄位全為空），確認頁面仍可載入且不會因 null 值導致渲染錯誤；「查看 run log」在無 lastRun 資訊時要有合理處理（例如 disabled/提示）。 |
| 6 | **E2E：dispatch-rules full gate 驗收（正向）** | 擴展 `e2e/admin-dispatch-rules.spec.ts`：在 full profile 觸發 runner 後驗證 lastRun 欄位非空，並點「查看 run log」後確認 `/admin/ops/jobs` 篩選到 `crm-run-scheduled` 且列表中有對應結果（允許時間差，但不可空）。 |
| 7 | **E2E：導向驗收（負向容錯）** | 若 Op job 尚未完全刷新，E2E 需有合理等待/重試（而非固定 sleep），確保不因 race condition 間歇失敗。 |
| 8 | **E2E：非 full profile 行為** | 當非 `E2E_PROFILE=full` 時，仍保證 smoke 可載入並顯示列表/空態；runner 驗收部分可以 skip，但要在 skip 條件與訊息中清楚說明「需要 full fixtures」。 |
| 9 | **文件對齊** | 更新 `docs/e2e-pos.md`：補上 dispatch-rules full gate 驗收步驟（從 dispatch-rules → 查看 run log → ops jobs filter）。 |
| 10 | **文件/UX：錯誤訊息一致性** | 若 `VITE_ADMIN_API_KEY` 缺失或後端回 401，前端需提供一致提示並確保 E2E 能預期 skip/報告（不假成功）。 |
| 11 | **全站 UI/UX 再審視：所有頁面與各細項/按鈕逐項打點** | 針對全站所有頁面與互動（Admin 後台：側欄/列表/抽屜/表單/分頁/匯入匯出/空態與錯誤態；POS 前台：結帳/報表/訂單列表/促銷試算與導向；Login/共用元件）做 UI/UX 巡檢：按鈕文案是否清楚、disabled/loading 狀態是否一致、tooltip/提示是否可理解、空態/錯誤態是否有行動建議；必要時補強 e2e selector/斷言策略，且修改以不破壞現有 API 契約為原則。 |

---

