# 後端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。
---

## 1. 本輪必做

> 後端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 014** 追加一筆。

### 本輪任務（依序完成，全部必做）

> 本輪聚焦 **報表穿透（referenceId）E2E 穩定性缺口**：讓 full profile 下 `ReferenceIdLink` 能渲染可點擊按鈕並穩定導向、且與 Admin hub/Scoped Search Params 的 returnTo 行為不再依賴 skip。RBAC 長期 skip（不做）。

| # | 任務 | 說明 |
|---|------|------|
| 1 | **迴歸維護 + commit 檢查** | `pnpm --filter pos-erp-backend test` 全綠；結束前固定檢查 `git status/diff`，有變更必提交 atomic commits 並在 agent-log 列出 sha + message。 |
| 2 | **E2E seed：修正 referenceId 為 UUID-like** | 在 `backend/scripts/e2e-seed.ts`（或相關 e2e seed）把 POS order / receiving note / exchange 對應的 `E2E_*_ID` 調整為符合 `ReferenceIdLink` 的 UUID-like regex（避免含非 hex 字元）。 |
| 3 | **E2E seed：讓 Admin 報表至少有 1 筆可穿透事件** | 確保 `E2E_PROFILE=full` 時 `/admin/reports`（或 finance events 列表）中至少存在 1 筆 referenceId 可被 `ReferenceIdLink` 解析為 `posOrder/receivingNote`，以便 full profile 下不再因按鈕數量為 0 而 skip。 |
| 4 | **Fail-fast 驗證（seed）擴充** | 擴展 `e2e-seed.ts` 的驗證：除了現有 count 邏輯，額外驗證（a）UUID-like 格式符合；（b）存在至少 1 筆可穿透的 finance/報表事件。缺資料必 throw。 |
| 5 | **Ops reference resolve 邊界檢查** | 在 ops resolve 邏輯或 integration-spec 補：對新增/調整後的 referenceId，`GET /ops/references/resolve` 回傳 `posOrder` 或 `receivingNote`（而非 unknown）。 |
| 6 | **E2E：確保 full gate 的金流穿透 smoke 不再跳過** | 讓既有 `e2e/admin-smoke.spec.ts` 在 `E2E_PROFILE=full` 下能成功點擊至少 1 個 `ReferenceIdLink` 按鈕並驗證 `/pos/orders/:id` 導向（不再依賴 skip）。 |
| 7 | **文件對齊** | 更新 `docs/e2e-pos.md`：補充 referenceId UUID-like 契約與 full profile 驗收要點（確保穿透 E2E 不 skip 的前提）。 |

---

