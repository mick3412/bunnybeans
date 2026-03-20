# 前端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。

**優化參考**：plan 剩餘項目依 [.cursor/plans/前端全局優化審查_b643f752.plan.md](../../../.cursor/plans/前端全局優化審查_b643f752.plan.md)。
---

## 1. 本輪必做

> 前端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 038** 追加一筆。

### 前置（必做）

- **迴歸維護**：`pnpm --filter pos-erp-frontend build` 全綠；結束前檢查 `git status/diff`，有變更必提交 atomic commits，並在 agent-log 列出 sha + message。

### 本輪任務（037 剩餘 + 驗收）

| # | 任務 | 對應 plan | 說明 |
|---|------|----------|------|
| 1 | **E2E 完整驗證** | — | 需 DB seed 就緒時：先執行 `bash scripts/e2e-prepare-db.sh`，再執行 `bash scripts/restart-dev-detach.sh`，等約 4 秒後跑 `pnpm e2e`。確認 5 passed、2 skipped。若 port/DATABASE_URL 不可用則在 agent-log 註記環境限制。 |
| 2 | **Design Token AdminReceivingNotesPage** | §二 | 即期／退供應商區塊 `amber-*`（約 35 處）改為 `brand-warning`、`border-brand-warning`、`bg-brand-warning` 等 token。 |
| 3 | **Design Token 其餘殘留** | §二 | PosPage、PosOrderDetailPage、AdminPurchaseOrdersPage、AdminInventoryPage 等殘留 amber/orange/slate/neutral 分批改為 brand token。 |
| 4 | **loading / error 一致性** | §八 | 未使用 StandardListLayout 的頁面 loading 統一為「載入中…」或骨架；AdminReceivingNotesPage、AdminPurchaseOrdersPage 錯誤回饋統一走 Alert。 |
| 5 | **POS 收銀區產品塊重構** | — | ① 取消展示 SKU。② 新增展示庫存數量（須後端 BACKEND-INSTRUCTIONS 038 #2 提供產品含 onHandQty 之 API 後串接）。③ 依 UX 最佳實踐重新設計產品塊：資訊層級（品名優先、規格次之、價格醒目）、庫存視覺提示（如低庫存標示）、選取狀態、掃描友善、卡牌佈局與視覺密度。 |

---
