# 後端本輪 — 先做這些（規格 Agent 僅改 §1）

**協作**：完成本輪後，在 [agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md) 最上方追加一筆（格式見該檔）。流程與角色見 [agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)。執行前請讀 [AGENT-RULES.md](../AGENT-RULES.md)。

---

## 1. 本輪必做

> 後端 Agent **只讀本節**，完成後於 agent-log 以 **INSTRUCTIONS 058** 追加一筆。

### 前置（必做）

- **迴歸維護**：`pnpm --filter pos-erp-backend test` 全綠；結束前檢查 `git status` / `git diff`，有變更必提交 atomic commits，並在 agent-log 列出 sha + message。
- **ci:backend-with-db 驗證**：確認 `pnpm ci:backend-with-db`（或 `pnpm ci:backend-with-db-fallback`）可跑通。

### 本輪任務（057 收斂後）

| # | 任務 | 說明 |
|---|------|------|
| 1 | **迴歸確認** | 確認 057 變更無遺漏、測試全綠；若有未提交變更則補 atomic commits。 |
| 2 | **商品總覽批次操作/匯出支援** | 確認 `PATCH /products/batch-price`、`PATCH /products/batch-tags`、`GET /products/export` 皆受 `AdminApiKeyGuard` 保護且錯誤碼/訊息一致；必要時補 API 文件與回傳形狀。 |
| 3 | **效期/剩餘天數篩選一致** | `GET /products` 回傳需包含 `productionDate/shelfLifeMonths/expiryDate`；`minDaysUntilExpiry` 篩選需與前端推算規則一致（支援推算到期日），避免食品類篩選落差。 |

---
