# 後端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。

---

## 1. 本輪必做

> 後端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 062** 追加一筆。

### 前置（必做，快檢查）

- **工作區與依賴檢查**：先看 `git status` / `git diff`，確認本輪起點與未提交項目；同時確認測試所需環境可啟動（DB、env、seed）。
- **先做最小可行驗證**：先跑關鍵 smoke（例：`pnpm --filter pos-erp-backend test -- pos-reports.integration-spec.ts`），避免做到一半才發現環境阻塞。
- **E2E DB 隔離（必做）**：涉及 seed/E2E 時一律使用 `.env.e2e`（或 `./scripts/e2e-one-click-isolated.sh`）指向隔離測試 DB；**禁止**將 seed/E2E 指向 demo DB（`pos_erp`）。

### 本輪任務（061 收斂後）

| # | 任務 | 說明 |
|---|------|------|
| 1 | **售後 E2E 新互動模型後端對齊** | 針對前端已整併之「訂單總覽/退換貨明細 + AfterSalesPanel 新流程」，檢查必要 API 輸出與查詢條件是否足夠支撐 Playwright 重寫（避免前端只能 skip）；缺欄位時以最小變更補 DTO/response。 |
| 2 | **SEED 覆蓋檢查機制（可機器驗證）** | 依 [SEED 全局缺口補強](0e085e74-807a-403d-837b-a91630159665) 整理最小覆蓋規則（報表/KPI/列表至少一筆），新增可重複執行的檢查腳本或測試（可掛在 seed 後 smoke）。 |
| 3 | **食品/飼料/效期欄位一致性守衛** | 針對「剩餘天數由效期推導」建立 seed guard：有 `expiryDescription` 的食品/飼料類別須具備 `expiryDate` 或 `productionDate+shelfLifeMonths`；避免再次出現前端剩餘天數全 `—`。 |
| 4 | **共購分析進階切面規劃與契約預留** | 在既有 market-basket 基礎上，評估並文件化下一步可擴充欄位（如 ruleId 切面、with/without promo 定義細化），先完成契約草案與 TODO，避免後續破壞既有 API。 |
| 5 | **062 後端工作區 atomic 收斂提交** | 本輪所有後端改動按「API/seed/測試/文件」分 commit，且每個 commit 對應可驗收命令與 agent-log 條目。 |

### 任務執行中（每項必做）

- **最小驗收即時跑**：每完成一個任務就跑對應最小測試（例如單一 integration spec），不要全部堆到最後才驗。

### 收尾（必做，完整驗收）

- **完整回歸**：`pnpm --filter pos-erp-backend test` 全綠，並確認 `pnpm ci:backend-with-db`（或 `pnpm ci:backend-with-db-fallback`）可跑通。
- **提交與紀錄**：再次檢查 `git status` / `git diff`；有變更必提交 atomic commits，並在 agent-log 列出 sha + message；若無變更需註記「無需 commit（無工作區變更）」。

---
