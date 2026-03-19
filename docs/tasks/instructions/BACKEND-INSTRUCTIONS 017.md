# 後端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。
---

## 1. 本輪必做

> 後端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 017** 追加一筆。

### 本輪任務（依序完成，全部必做）

| # | 任務 | 說明 |
|---|------|------|
| 1 | **迴歸維護 + commit 檢查** | `pnpm --filter pos-erp-backend test` 全綠；結束前固定檢查 `git status/diff`，有變更必提交 atomic commits，並在 agent-log 列出 sha + message。 |
| 2 | **CI：擴充 e2e-full.yml fail-fast Expected fixture keys（完整對齊 seed fail-fast 驗證輸出）** | `.github/workflows/e2e-full.yml` 的 `echo "Expected fixture keys:"` 改為包含所有固定 suite 會依賴的 deterministic identifiers（dispatch、barcode、exchange、referenceId、replenishment、expiring、receiving note、finance report refs）。同時補上「負向」fixtures（disabled/future 等）對應 keys，讓失敗時能直接判斷缺的是哪一類。 |
| 3 | **Seed：加強 e2e-seed.ts 的可讀性 console.log（CI triage 用）** | `backend/scripts/e2e-seed.ts`：除了既有 log，再加入一段統一格式的 `E2E_SEED_SUMMARY`（單行或固定多行），明確列出：replenishment sale ref、expiring inventory batch code、receiving note receipt number、report refs、dispatch rule names/ids。 |
| 4 | **Seed：fail-fast 擴充 — Expiring inventory 可被 UI 查到** | 在 `e2e-seed.ts` full profile fail-fast 中，新增檢查：`E2E-EXP-BATCH-0001` 對應的 `InventoryEvent`（PURCHASE_IN）存在且 `SUM(quantity) > 0`，並且該資料落在 expiring 頁查詢的有效期邏輯區間（避免 full gate 期望非空但實際空）。 |
| 5 | **Seed：fail-fast 擴充 — ReceivingNote return-to-supplier 可完成最小動作** | 在 `e2e-seed.ts` fail-fast 中新增檢查：`E2E-RN-0001` 的 `ReceivingNoteLine.qualifiedQty`（或可退貨的可退量）至少為 1，並確保對應關聯資料（purchaseOrder/warehouse/product）存在，避免 `admin-receiving-notes-smoke` 在 full gate 執行 return 流程時因資料不足而失敗。 |
| 6 | **Seed：fail-fast 擴充 — barcode / exchange / report refs 以更具體的錯誤訊息定位** | 將現有 `throw new Error('...')` 訊息補強為更具體（例如提到對應 fixture key 與實際 count），確保 CI 失敗訊息能直接定位哪個資料缺失或不符預期。 |
| 7 | **文件對齊：docs/e2e-pos.md 增加「CI triage checklist」** | 更新 `docs/e2e-pos.md`：在 `Expected fixture keys` 附上「對應 seed fail-fast 檢查/console.log 欄位 → 應檢查的原因」；同時補充 expiring inventory / receiving note return 相關驗收對應的 fixture keys。 |

---

