# 前端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。

---

## 1. 本輪必做

> 前端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 058** 追加一筆。

### 前置（必做）

- **迴歸維護**：`pnpm --filter pos-erp-frontend build` 全綠；結束前檢查 `git status` / `git diff`，有變更必提交 atomic commits，並在 agent-log 列出 sha + message。

### 本輪任務（057 收斂後）

| # | 任務 | 說明 |
|---|------|------|
| 1 | **補齊 atomic commits** | 將 056/057 相關前端變更（含訂單明細重構、售後頁、E2E 調整）依功能拆成可追溯 commits，並在 agent-log 列出 sha + message。 |
| 2 | **售後 E2E 穩定驗收** | 在乾淨環境或 `reuseExistingServer` 下跑通 `e2e/pos-refund.spec.ts`、`e2e/pos-return-stock.spec.ts`、`e2e/pos-exchange-settlement-journey.spec.ts`；若本機 port 5173 衝突，於文件或 playwright 設定註明解法。 |
| 3 | **商品總覽：批次操作/匯出可用** | 修復「批次改價／批次改標籤／CSV 匯出」在未內建 `VITE_ADMIN_API_KEY` 的情境無法使用：允許於 UI 輸入 Admin Key（localStorage 暫存），並確保所有請求會帶 `X-Admin-Key`。 |
| 4 | **折扣標籤頁 layout 對齊** | `折扣標籤` 分頁外框與區塊寬度對齊 `商品總覽`、`類別管理`（max width、card 容器 padding/border/shadow 統一）。 |

---
