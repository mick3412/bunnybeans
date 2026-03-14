# 開發守則（後端／前端 Agent 共用）

> 與 [agent-collab/AGENT-COLLABORATION.md](agent-collab/AGENT-COLLABORATION.md) 併讀。改 API、改行為前先對齊本檔與 api-design。

## 必讀路徑

| 用途 | 路徑 |
|------|------|
| POS／退貨 | [api-design-pos.md](api-design-pos.md) |
| 庫存／金流 | [api-design-inventory-finance.md](api-design-inventory-finance.md) |
| 錯誤碼 | [backend-error-format.md](backend-error-format.md) |
| 後台 UI↔API | [admin-inventory-ui.md](admin-inventory-ui.md) |
| E2E | [e2e-pos.md](e2e-pos.md) |
| Seed／部署 | [db-seed.md](db-seed.md)、[deploy-preview.md](deploy-preview.md) |
| 前後端責任與 endpoint 狀態 | [collaboration-rules-backend-frontend.md](collaboration-rules-backend-frontend.md) |

## 硬規則

- **合約先於程式**：新 endpoint 或變更 stable API → 先改 `docs/api-design-*.md`，再寫碼。
- **後端**：jest 綠燈；**ADMIN_API_KEY** 勿 commit。
- **前端**：受保護寫入帶 **X-Admin-Key**（`VITE_ADMIN_API_KEY`）；E2E 本機僅一後端 **:3003**。
- **POS 前端**不直接呼叫 `/inventory/*`、`/finance/*`（扣庫由建單內部完成）。
- **產品決策**：多 SKU = 多筆 Product；不做 SPU/Variant（除非另專案）；Admin RBAC 細分不做。

## 開發紀錄（步驟 2 必做）

完成本輪實作後，**只追加**對應 log（見 [agent-collab/AGENT-COLLABORATION.md](agent-collab/AGENT-COLLABORATION.md)）：

- 後端 → [agent-collab/agent-log-backend.md](agent-collab/agent-log-backend.md)
- 前端 → [agent-collab/agent-log-frontend.md](agent-collab/agent-log-frontend.md)

行首時間用實際寫入當下 **HH:MM**（或 ISO 日期）。
