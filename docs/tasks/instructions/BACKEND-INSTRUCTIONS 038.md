# 後端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。

**優化參考**：plan 剩餘項目依 [.cursor/plans/後端全局優化審查_94b472ba.plan.md](../../../.cursor/plans/後端全局優化審查_94b472ba.plan.md)、[BACKEND-OPTIMIZATION-REVIEW.md](../progress/BACKEND-OPTIMIZATION-REVIEW.md)。
---

## 1. 本輪必做

> 後端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 038** 追加一筆。

### 前置（必做）

- **迴歸維護**：`pnpm --filter pos-erp-backend test` 全綠；結束前檢查 `git status/diff`，有變更必提交 atomic commits，並在 agent-log 列出 sha + message。
- **ci:backend-with-db 驗證**：確認 `pnpm ci:backend-with-db`（或 `ci:backend-with-db-fallback`）可跑通。

### 本輪任務（037 收尾 + POS 產品庫存）

| # | 任務 | 說明 |
|---|------|------|
| 1 | **迴歸確認** | 確認 037 變更無遺漏、測試全綠；若有未提交變更則補 atomic commits。 |
| 2 | **POS 產品列表含庫存** | 為 POS 收銀區產品塊顯示庫存，新增或擴充 API：依 `storeId` 取得門市對應倉庫，回傳產品列表含 `onHandQty`（該倉庫 InventoryBalance 彙總）。可為 `GET /pos/products?storeId=` 或擴充既有 `GET /products` 支援 `storeId`＋`onHandQty`；api-design-pos.md 補契約。前端 INSTRUCTIONS 038 #5 需此資料。 |

---
