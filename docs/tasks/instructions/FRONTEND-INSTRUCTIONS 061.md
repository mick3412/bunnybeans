# 前端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。

---

## 1. 本輪必做

> 前端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 061** 追加一筆。

### 前置（必做，快檢查）

- **工作區與依賴檢查**：先看 `git status` / `git diff`，確認本輪起點與未提交項目；同時確認前端驗收所需環境可啟動（dev server、fixture、env）。
- **先做最小可行驗證**：先跑關鍵 smoke（例：`pnpm --filter pos-erp-frontend build`），避免做到一半才發現環境阻塞。
- **E2E DB 隔離（必做）**：跑 E2E 時一律使用 `.env.e2e`（或 `./scripts/e2e-one-click-isolated.sh`）指向隔離測試 DB；**禁止**將 seed/E2E 指向 demo DB（`pos_erp`）。

### 本輪任務（060 收斂後）

| # | 任務 | 說明 |
|---|------|------|
| 1 | **060 任務收斂提交（atomic）** | 針對 060 已完成但尚未正式收斂的 UI/互動調整（POS 篩選列、購物車穩定、訂單/退換貨整併、欄位文案、明細補強等），整理成可驗收的 atomic commits，並在 log 明確對照每項任務完成狀態。 |
| 2 | **售後 E2E full profile 可重現** | 以 `.env.e2e` + `E2E_PROFILE=full` 重新驗證 `pos-refund` / `pos-return-stock` / `pos-exchange-settlement-journey`；若仍有 skip，需在 `docs/e2e-pos.md` 與 agent-log 以固定格式更新「skip code + 條件 + 解法」。 |
| 3 | **共購分析頁（Market Basket）前端收斂** | 依 [共購分析開發實作](14f5c10d-0865-4a19-82e1-1900b5883e6b) 收斂頁面、路由、API 串接與可用性（篩選/空態/錯誤態）；確認 `/pos/reports/market-basket` 從報表入口可到達且互動穩定。 |
| 4 | **共購分析 E2E/驗收補齊** | 補最小可用驗收（至少 1 支 page-load + promoFilter 切換）；若受 fixture 限制，需明文化前置條件與 fallback 驗收方式。 |

### 任務執行中（每項必做）

- **最小驗收即時跑**：每完成一個任務就跑對應最小驗收（例如局部 build、單支 E2E），不要全部堆到最後才驗。

### 收尾（必做，完整驗收）

- **完整回歸**：`pnpm --filter pos-erp-frontend build` 全綠；本輪若跑 E2E，需完成或依上表明確註記 skip。
- **E2E skip 紀錄格式（必填）**：若有 skip，於 agent-log 以 `spec 檔名 + skip code + 前置條件 + 解法` 固定格式記錄。
- **提交與紀錄**：再次檢查 `git status` / `git diff`；有變更必提交 atomic commits，並在 agent-log 列出 sha + message；若無變更需註記「無需 commit（無工作區變更）」。

---
