# 上一輪整合（規格 Agent 每輪覆寫）

**最新 agent-log（以 INSTRUCTIONS 編號為準）**：後端 **037** · 前端 **037**  
（路徑：[agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md)、[agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md)）

## 後端（收斂摘要）

- **INSTRUCTIONS 037 已完成**：
  - #1 迴歸確認、#2 BACKEND-OPTIMIZATION-REVIEW.md 更新、#3 Promotion DTO、#4 throw 工廠殘留、#5 pos.service L520 型別。
  - #6 其他 as any（測試檔可暫緩）未執行。
- **測試**：jest 152 passed；ci:backend-with-db 通過。

## 前端（收斂摘要）

- **INSTRUCTIONS 037 部分完成**：
  - **formatMoney 全面替換** ✅：12 檔改用 shared formatMoney。
  - **大列表虛擬化**：評估後暫不實作（多數列表已有 server-side 分頁）。
  - **前端單元測試** ✅：vitest、formatMoney.test.ts、EmptyState.test.tsx 共 9 passed。
  - **Design Token**：PosCheckoutModal amber→brand-warning ✅。
- **待補**：E2E 完整驗證、Design Token AdminReceivingNotesPage、Design Token 其餘殘留、loading/error 一致性。
- **測試**：build ✅；unit test 9 passed；E2E 待環境就緒時補跑。

---

## 全局審查缺口清單（037 後剩餘）

> 依 agent-log 037 與 plan 審查。

### 驗收與整合

| 來源 | 缺口 | 說明 |
|------|------|------|
| 037 後續 | **E2E 完整驗證** | DB seed 就緒時執行 `e2e-prepare-db` + `restart-dev-detach` + e2e，確認 5 passed、2 skipped |
| 037 後續 | **Design Token AdminReceivingNotesPage** | 即期／退供應商區塊 amber→brand-warning（約 35 處） |
| 037 後續 | **Design Token 其餘殘留** | PosPage、PosOrderDetailPage、AdminPurchaseOrdersPage、AdminInventoryPage 等 amber/orange/slate/neutral |
| 037 後續 | **loading / error 一致性** | 未用 StandardListLayout 的頁面 loading 統一；AdminReceivingNotesPage、AdminPurchaseOrdersPage 錯誤走 Alert |

### 功能進階（長期 skip）

| 來源 | 缺口 | 說明 |
|------|------|------|
| erp-roadmap Phase 5 | **RBAC** | 依產品決策維持長期 skip |

---

## 已開發模組進度

| 模組 | 後端 | 前端 | 備註 |
|------|------|------|------|
| Merchant | list、current、Guard、DTO | 單一商家 | 完成 |
| Product / Category / Brand / ProductTag | CRUD、barcode、效期、sortOrder、throw 工廠、DTO | 商品總覽、分類/品牌/標籤 | 完成 |
| Inventory | 參數化、N+1 優化、throw 工廠 | 庫存總覽、補貨、即期 | 完成 |
| Purchase | Guard、DTO、throw 工廠 | 採購總覽、驗收、退供 | 完成 |
| POS / Order | Transaction、N+1、並行、Guard、DTO、Logger | POS 收銀、訂單、業績報表 | 完成 |
| Finance | SQL 分頁、throw 工廠、DTO | 金流報表、應收應付 | 完成 |
| Loyalty / CRM / Promotion | throw 工廠、catch 修正、Promotion DTO | 會員、集點、發券、促銷 | 完成 |
| Ops | as any 清理、catch 修正 | Ops jobs、點擊審計 | 完成 |
| Dashboard | integration-spec、Guard、TTL 快取 | 儀表板 | 完成 |

---

## 整合風險／待對齊

- **E2E**：pos-checkout、pos-credit、pos-refund 需 DB seed 就緒。Agent 可執行 `bash scripts/e2e-prepare-db.sh` 後再跑 E2E。

---

本檔為**實際進度總結**，下一輪具體任務見 [tasks/instructions/](../tasks/instructions/)（目前最新為 **INSTRUCTIONS 038**）§1。
