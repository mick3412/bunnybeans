# 前端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。
---

## 1. 本輪必做

> 前端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 015** 追加一筆。

### 本輪任務（依序完成，全部必做）

| # | 任務 | 說明 |
|---|------|------|
| 1 | **固定 commit 檢查（必做）** | 結束前固定檢查 `git status/diff`，有變更必提交 atomic commits（每個至少 build 綠），並在 agent-log 列出 sha + message。 |
| 2 | **迴歸維護（build + 必要 E2E）** | `pnpm --filter pos-erp-frontend build` 全綠；以 `E2E_PROFILE=full` 下跑本輪新增到 full gate 的 spec：`admin-categories` / `admin-customers-import` / `admin-bulk` / `admin-replenishment`（若因缺 Key 或資料，E2E 需在訊息中明確說明 skip 條件）。 |
| 3 | **UI/UX：全站再審視（本輪聚焦 shared 狀態一致性）** | 針對所有 admin/pos 常用狀態：loading/disabled、empty state、error/permission toast/alert 文案、以及「下一步建議」一致化；優先修 shared 元件與 Admin Hub 通用區塊，避免同一語意在不同頁出現不一致。 |
| 4 | **UI/UX：補強 E2E 可定位 selector** | 對 full gate 新增 spec 相關頁面的關鍵按鈕/輸入/空態區塊增加或修正 `data-testid`（或唯一文字/角色），避免 strict-mode 多筆匹配與 race condition。 |
| 5 | **錯誤訊息一致性（全站範圍）** | 將 customers/import preview、inventory export/import、replenishment 建立草稿等涉及 API 呼叫的頁面，統一到既有 error code/message schema（401/403/5xx），並補/調整最小 E2E assertions。 |
| 6 | **文件對齊** | 若新增/調整 selector、或修正文案/skip 條件，確保 `docs/e2e-pos.md` 的表格摘要與之對齊（至少更新該四個 spec 的驗收摘要）。 |

---

