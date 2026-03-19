# 後端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。
---

## 1. 本輪必做

> 後端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 015** 追加一筆。

### 本輪任務（依序完成，全部必做）

| # | 任務 | 說明 |
|---|------|------|
| 1 | **迴歸維護 + commit 檢查** | `pnpm --filter pos-erp-backend test` 全綠；結束前固定檢查 `git status/diff`，有變更必提交 atomic commits 並在 agent-log 列出 sha + message。 |
| 2 | **CI：擴充 `e2e-full.yml` 固定 gate suite** | 將以下 spec 納入 `.github/workflows/e2e-full.yml` 的固定清單（非 grep inputs）：`e2e/admin-categories.spec.ts`、`e2e/admin-customers-import.spec.ts`、`e2e/admin-bulk.spec.ts`、`e2e/admin-replenishment.spec.ts`（若需排序/條件，需確保 fail-fast 邏輯仍有效）。 |
| 3 | **E2E seed：保障新增 spec 的最低驗收不被 long-term skip** | 在 `backend/scripts/e2e-seed.ts`（full profile）針對新增 spec 需要的前置資料做 deterministic 補齊：確保補貨建議頁不是長期空（至少能讓建議列表呈現）；其他頁面所需的基礎 master/關聯資料需存在。缺資料必以 fail-fast throw。 |
| 4 | **Integration / contract：確認必要 API/錯誤碼行為** | 若新增 spec 涉及 API 預覽（如 customers/import preview）或匯出/匯入請求，確保後端回傳與前端 E2E 預期一致（尤其是 401/403 與 5xx 的 error code/message schema）。補最小 integration-spec 覆蓋。 |
| 5 | **文件對齊** | 更新 `docs/e2e-pos.md`：新增 `e2e-full` 指令範例（含新增 spec）與測試檔表格列（四個 spec 的驗收摘要）。 |

---

