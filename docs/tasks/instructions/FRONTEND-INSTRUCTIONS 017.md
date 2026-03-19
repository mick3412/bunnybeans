# 前端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。
---

## 1. 本輪必做

> 前端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 017** 追加一筆。

### 本輪任務（依序完成，全部必做）

| # | 任務 | 說明 |
|---|------|------|
| 1 | **固定 commit 檢查（必做）** | 結束前固定檢查 `git status/diff`，有變更必提交 atomic commits（每個至少 build 綠），並在 agent-log 列出 sha + message。 |
| 2 | **迴歸維護（build + 必要 E2E）** | `pnpm --filter pos-erp-frontend build` 全綠；以 `E2E_PROFILE=full` 依 fixed suite 跑本輪對應的 spec：`admin-categories / admin-customers-import / admin-bulk / admin-replenishment`（若執行環境允許，額外補跑 `admin-receiving-notes-smoke` 與 `admin-expiring-inventory-smoke` 以覆蓋新增 seed fail-fast）。 |
| 3 | **UI：新增/補強 data-testid（對應新增固定 suite 的定位點）** | 對上述至少四個頁面：補強目前 E2E 會用到但容易受字串/多筆影響的元素（例如：分類頁標籤新增 input/新增按鈕；補貨建議頁表格/空態區塊、checkbox、supplier select、建立草稿按鈕；customers-import 預覽區塊與 filehash 區塊）。 |
| 4 | **UI：空態/錯誤態文案一致性（避免 UI 文案漂移造成 E2E 失敗）** | 確保空態文字（例如 `目前沒有需要補貨的商品。`）與錯誤/permission 提示皆使用既有 shared 文案來源或統一 helper；避免未來改文案導致 strict-mode/文字定位 E2E 失敗。 |
| 5 | **錯誤訊息一致性（401/403/5xx）+ 最小 E2E assertions** | 對涉及 API 呼叫的頁面（customers/import preview、inventory export/import、replenishment 建立草稿）：統一到既有 error schema + toast/alert 呈現；補最小 E2E assertions（至少驗證關鍵文字或 testid 存在）。 |
| 6 | **selector 穩定性補強（避免 strict-mode 多筆匹配）** | 若上述頁面存在 `getByText` / `getByRole` 會匹配多個相似元素的情況，優先改 UI 提供唯一 testid，或調整 E2E locator 策略（不破壞 API）。 |
| 7 | **文件對齊：docs/e2e-pos.md 更新** | 更新 `docs/e2e-pos.md`：至少補齊本輪對應的四個 spec 驗收摘要裡「定位用 testid/關鍵文案」欄位，並在新增頁面（若補跑 receiving-notes/expiring）同理補上。 |

---

