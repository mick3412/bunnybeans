# 前端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。

---

## 1. 本輪必做

> 前端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 060** 追加一筆。

### 前置（必做，快檢查）

- **工作區與依賴檢查**：先看 `git status` / `git diff`，確認本輪起點與未提交項目；同時確認前端驗收所需環境可啟動（dev server、fixture、env）。
- **先做最小可行驗證**：先跑關鍵 smoke（例：`pnpm --filter pos-erp-frontend build`），避免做到一半才發現環境阻塞。

### 本輪任務（059 收斂後）

| # | 任務 | 說明 |
|---|------|------|
| 1 | **售後 E2E 可重現跑通（或明文化 skip）** | 針對 `e2e/pos-refund.spec.ts`、`e2e/pos-return-stock.spec.ts`、`e2e/pos-exchange-settlement-journey.spec.ts`：在 **`E2E_PROFILE=full`** 且已跑 `e2e:seed` 之前提下，於本機或 CI **至少驗證一次非全 skip**；若環境無法滿足，須在 `docs/e2e-pos.md` 與 agent-log 以固定格式註記 skip 條件與解法。 |
| 2 | **Loyalty 存摺 tab 中文顯示** | 依 [erp-roadmap.md](../../erp-roadmap.md) §0.6：點數存摺相關 tab／篩選不得只顯示 `EARNED`/`BURNED` 等英文 enum，需改為使用者可讀中文（與既有 enum mapping 一致）。 |

### 任務執行中（每項必做）

- **最小驗收即時跑**：每完成一個任務就跑對應最小驗收（例如單支 E2E、局部 build），不要全部堆到最後才驗。

### 收尾（必做，完整驗收）

- **完整回歸**：`pnpm --filter pos-erp-frontend build` 全綠；本輪若跑 E2E，需完成或依上表明確註記 skip。
- **E2E skip 紀錄格式（必填）**：若有 skip，於 agent-log 以 `spec 檔名 + skip code + 前置條件 + 解法` 固定格式記錄。
- **提交與紀錄**：再次檢查 `git status` / `git diff`；有變更必提交 atomic commits，並在 agent-log 列出 sha + message；若無變更需註記「無需 commit（無工作區變更）」。

---
