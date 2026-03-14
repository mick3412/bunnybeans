# 前端 Agent 工作計劃（整合版 + 整體規劃）

> **現行唯一開跑**：請只讀 **[FRONTEND-INSTRUCTIONS.md](FRONTEND-INSTRUCTIONS.md)** + **[agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)**；完成後追加 **agent-log-frontend.md**。  
> 本檔為歷史計畫表保留；後端對照見 [TASK-backend-agent-plan-integrated.md](TASK-backend-agent-plan-integrated.md)（同為參考）。

> **給前端 Agent（舊慣例）**：可複習 [AGENT-DEV-INSTRUCTIONS.md](../AGENT-DEV-INSTRUCTIONS.md) §0、§1、§3.3、§5。  
> **整體維度**：批量 UI 與後端 API 對照見 [bulk-import-export-plan.md](../bulk-import-export-plan.md)。

---

## 你已交付（本輪在既有上增量；已完成項可視為 baseline）

| 項目 | 說明 |
|------|------|
| POS | Layout、salePreview、previewPromotions、結帳、E2E 主線 |
| 後台 | Dashboard、金流列表、促銷列表／編輯、e2e.yml + VITE_ADMIN_API_KEY |
| UX | Admin toast、商品倉庫摺疊、報表 from/to、enriched（若已接） |
| 促銷 | PosPromosPage API、preview+customerId、訂單明細折讓列（若已接） |

---

## P0 維運（前端）

| 項 | 工作 | 路徑 |
|----|------|------|
| Vercel | **VITE_API_BASE_URL** | [deploy-preview.md](../deploy-preview.md) |
| E2E 環境 | 單一 **3003** + seed | [e2e-pos.md](../e2e-pos.md) |

---

## P1 品質（前端）

| 項 | 工作 | 路徑 |
|----|------|------|
| E2E | 含 **admin-bulk**（E1～E5 批量 smoke）、e2e.yml | [e2e.yml](../../.github/workflows/e2e.yml)、`e2e/admin-bulk.spec.ts` |
| ADMIN_KEY | 受保護寫入帶 **X-Admin-Key** | 勿 commit |
| 可選 | 分類 CRUD smoke | 需 secret |

---

## P2 後台 UX 與報表（前端）

| 序 | 工作 | 接觸點 |
|----|------|--------|
| F1 | Admin **toast** 寫入回饋 | [AdminToastContext](../../frontend/src/pages/admin/AdminToastContext.tsx) |
| F2 | 商品 **倉庫摺疊** | [AdminProductsPage](../../frontend/src/pages/admin/AdminProductsPage.tsx) |
| F3 | 報表 **from/to** + finance events | [AdminReportsPage](../../frontend/src/pages/admin/AdminReportsPage.tsx)、[adminApi](../../frontend/src/modules/admin/adminApi.ts) |
| F4 | 可選 **categories/enriched** | AdminCategoriesPage／Dashboard |

---

## P3 促銷與訂單（前端）

| 序 | 工作 | 接觸點 |
|----|------|--------|
| P1 | **PosPromosPage** `listPromotionRules(active)` + merchantId | [PosPromosPage](../../frontend/src/pages/PosPromosPage.tsx) |
| P2 | **previewPromotions** + **customerId**（UUID） | [PosPage](../../frontend/src/pages/PosPage.tsx)、[posOrdersApi](../../frontend/src/modules/pos/posOrdersApi.ts) |
| P3 | 訂單明細 **subtotal／discount／promotionApplied** | [PosOrderDetailPage](../../frontend/src/pages/PosOrderDetailPage.tsx) |
| P4 | 可選 結帳 Modal 小計／折讓 | [PosCheckoutModal](../../frontend/src/pages/PosCheckoutModal.tsx) |
| P5 | 可選 促銷 E2E smoke | `e2e/` |

---

## P4 批量與選配（前端；匯出／匯入須後端 API merge 後再做）

| 序 | 工作 | 依賴後端 | 接觸點 |
|----|------|----------|--------|
| E1 | **匯出庫存餘額 CSV**（選倉 + 下載） | A1 | [AdminInventoryPage](../../frontend/src/pages/admin/AdminInventoryPage.tsx) |
| E2 | **匯出金流 CSV**（同報表區間） | A2 | [AdminReportsPage](../../frontend/src/pages/admin/AdminReportsPage.tsx) |
| E3 | **匯出訂單 CSV**（區間／門市） | A3 | POS Orders 或後台列表 |
| E4 | **商品 CSV 上傳**、failed 列預覽 | B | [AdminProductsPage](../../frontend/src/pages/admin/AdminProductsPage.tsx) |
| E5 | 可選 盤點上傳 UI | C | Admin 庫存 |
| — | 訂單列表列印 CSS、skeleton、Tunnel 說明 | — | 文件為主 |

**原則**：後端未上的 endpoint **不先做 UI**；匯出可用 fetch + blob + `X-Admin-Key`。

---

## 不做（前端）

- 手動折價碼字串（無碼表 API）
- Admin RBAC、Variant

---

## 完成後

- 追加 **frontend-progress-pos-YYYY-MM-DD.md**（HH:MM）
- 更新 [docs/progress/README.md](../progress/README.md) 前端列

---

## 複製貼上給前端 Agent

```
你是本專案前端 Agent。必讀：
docs/AGENT-DEV-INSTRUCTIONS.md §0、§1、§3.3、§5
docs/tasks/TASK-frontend-agent-plan-integrated.md
docs/bulk-import-export-plan.md（批量與後端對照）

本輪自選：P0+P1 → P2→P3（未完成項）→ P4 僅接已存在之 export／import API（E1～E5）。
完成後：frontend-progress 當日檔 + README 前端列。
```
