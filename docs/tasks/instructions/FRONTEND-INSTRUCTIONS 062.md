# 前端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。

---

## 1. 本輪必做

> 前端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 062** 追加一筆。

### 前置（必做，快檢查）

- **工作區與依賴檢查**：先看 `git status` / `git diff`，確認本輪起點與未提交項目；同時確認前端驗收所需環境可啟動（dev server、fixture、env）。
- **先做最小可行驗證**：先跑關鍵 smoke（例：`pnpm --filter pos-erp-frontend build`），避免做到一半才發現環境阻塞。
- **E2E DB 隔離（必做）**：跑 E2E 時一律使用 `.env.e2e`（或 `./scripts/e2e-one-click-isolated.sh`）指向隔離測試 DB；**禁止**將 seed/E2E 指向 demo DB（`pos_erp`）。

### 本輪任務（061 收斂後）

| # | 任務 | 說明 |
|---|------|------|
| 1 | **售後 E2E 重寫（移除 legacy skip 依賴）** | 針對 `pos-refund.spec.ts`、`pos-return-stock.spec.ts`，改寫成對齊「訂單整併 + 新 AfterSalesPanel」互動流程的斷言；目標是減少 `POS_*_LEGACY_UI_REMOVED` 類 skip，轉為可執行驗收。 |
| 2 | **全局頁面/報表資料完整度驗收 UI** | 依 [SEED 全局缺口補強](0e085e74-807a-403d-837b-a91630159665) 逐頁驗證（Ops Jobs、CRM Jobs、Loyalty、POS 報表、退換貨明細）是否有可測試資料；若仍空白，補前端提示文案與排查指引。 |
| 3 | **效期/剩餘天數顯示一致性** | 針對食品與飼料頁面檢查 `productDaysUntilExpiry` 顯示與排序/篩選一致；避免存在資料但 UI 顯示 `—` 或算式不一致。 |
| 4 | **共購分析頁 UX 二次收斂** | `PosMarketBasketPage` 補強空態/錯誤態/載入態、篩選互動回饋與文案一致性，並確認由 `PosReportsPage` 導航往返體驗。 |
| 5 | **共購分析 E2E 穩定化** | `e2e/pos-market-basket.spec.ts` 補最小穩定斷言（table/chart/filter 切換），若受 seed 波動影響需記錄前置條件與 fallback 驗收。 |
| 6 | **062 前端工作區 atomic 收斂提交** | 本輪前端改動按「E2E 重寫 / UX 修整 / 文件」拆 commit，並在 agent-log 對照任務與測試結果。 |

### 任務執行中（每項必做）

- **最小驗收即時跑**：每完成一個任務就跑對應最小驗收（例如局部 build、單支 E2E），不要全部堆到最後才驗。

### 收尾（必做，完整驗收）

- **完整回歸**：`pnpm --filter pos-erp-frontend build` 全綠；本輪若跑 E2E，需完成或依上表明確註記 skip。
- **E2E skip 紀錄格式（必填）**：若有 skip，於 agent-log 以 `spec 檔名 + skip code + 前置條件 + 解法` 固定格式記錄。
- **提交與紀錄**：再次檢查 `git status` / `git diff`；有變更必提交 atomic commits，並在 agent-log 列出 sha + message；若無變更需註記「無需 commit（無工作區變更）」。

---
