# 後端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。

---

## 1. 本輪必做

> 後端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 059** 追加一筆。

### 前置（必做，快檢查）

- **工作區與依賴檢查**：先看 `git status` / `git diff`，確認本輪起點與未提交項目；同時確認測試所需環境可啟動（DB、env、seed）。
- **先做最小可行驗證**：先跑關鍵 smoke 測試（例：`pnpm --filter pos-erp-backend test -- pos-create-order.integration-spec.ts`），避免做到一半才發現環境阻塞。

### 本輪任務（058 收斂後）

| # | 任務 | 說明 |
|---|------|------|
| 1 | **補齊 058 待提交 commit** | 針對 `agent-log-backend` 最新 058 條目中「commits：待提交」部分，補齊 atomic commits（若最終無工作區變更，需在 agent-log 明確註記「無需 commit（無工作區變更）」）；僅提交與本輪確認範圍直接相關檔案，不得混入無關變更。 |
| 2 | **商品列表契約凍結驗收** | 鎖定 `GET /products` 分頁契約為 `{ items, total, page, pageSize }`，並確認 `productionDate/shelfLifeMonths/expiryDate` 在列表輸出可用；必要時補整合測試或契約文件。 |
| 3 | **效期篩選與分頁回歸測試** | 針對 `minDaysUntilExpiry`（`expiryDate` 與推算到期日兩路徑）補回歸驗收，確認先篩選後分頁行為一致，避免「有資料但被分頁切掉」誤判。 |

### 任務執行中（每項必做）

- **最小驗收即時跑**：每完成一個任務就跑對應最小測試（例如單一 integration spec 或特定模組測試），不要全部堆到最後才驗。

### 收尾（必做，完整驗收）

- **完整回歸**：`pnpm --filter pos-erp-backend test` 全綠，並確認 `pnpm ci:backend-with-db`（或 `pnpm ci:backend-with-db-fallback`）可跑通。
- **提交與紀錄**：再次檢查 `git status` / `git diff`；有變更必提交 atomic commits，並在 agent-log 列出 sha + message；若無變更需註記「無需 commit（無工作區變更）」。

---
