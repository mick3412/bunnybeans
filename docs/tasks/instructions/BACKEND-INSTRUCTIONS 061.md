# 後端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。

---

## 1. 本輪必做

> 後端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 061** 追加一筆。

### 前置（必做，快檢查）

- **工作區與依賴檢查**：先看 `git status` / `git diff`，確認本輪起點與未提交項目；同時確認測試所需環境可啟動（DB、env、seed）。
- **先做最小可行驗證**：先跑關鍵 smoke（例：`pnpm --filter pos-erp-backend test -- pos-reports.integration-spec.ts`），避免做到一半才發現環境阻塞。
- **E2E DB 隔離（必做）**：涉及 seed/E2E 時一律使用 `.env.e2e`（或 `./scripts/e2e-one-click-isolated.sh`）指向隔離測試 DB；**禁止**將 seed/E2E 指向 demo DB（`pos_erp`）。

### 本輪任務（060 收斂後）

| # | 任務 | 說明 |
|---|------|------|
| 1 | **共購分析 API 正式收斂（Market Basket）** | 依 [共購分析開發實作](14f5c10d-0865-4a19-82e1-1900b5883e6b) 收斂 `GET /pos/reports/market-basket`：查詢參數（含 `promoFilter`）、回傳 DTO（support/confidence/lift）、邊界（空單/單品單）與排序行為需固定；補齊或修正 integration-spec。 |
| 2 | **共購分析契約文件對齊** | 將 market basket endpoint 及參數/回傳結構補入對應 API 設計文件（`api-design-pos.md` 或專章），並在 roadmap/整合文檔註明狀態，避免「已實作未文件化」。 |
| 3 | **售後 E2E fixture 後端前置穩定化** | 針對 `INVENTORY_INSUFFICIENT` 的常見 skip，補強 e2e seed 中 store↔warehouse 可售庫存 fixture 一致性（至少讓 full profile 下可重現非全 skip）；必要時補最小驗證腳本或明確錯誤訊息。 |

### 任務執行中（每項必做）

- **最小驗收即時跑**：每完成一個任務就跑對應最小測試（例如單一 integration spec），不要全部堆到最後才驗。

### 收尾（必做，完整驗收）

- **完整回歸**：`pnpm --filter pos-erp-backend test` 全綠，並確認 `pnpm ci:backend-with-db`（或 `pnpm ci:backend-with-db-fallback`）可跑通。
- **提交與紀錄**：再次檢查 `git status` / `git diff`；有變更必提交 atomic commits，並在 agent-log 列出 sha + message；若無變更需註記「無需 commit（無工作區變更）」。

---
