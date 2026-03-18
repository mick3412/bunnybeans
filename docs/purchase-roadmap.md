# 採購 — 整合型規格與開發計畫

本文件為**採購／供應商／進貨驗收**的單一總覽：先給出目標、設計原則、API 總覽與階段規劃，最後對照現況。核准後可依此調整 BACKEND/FRONTEND INSTRUCTIONS。

> 上一輪整合見 [progress/integrated-last-cycle.md](progress/integrated-last-cycle.md)。API 細部契約見 [api-design-purchase.md](api-design-purchase.md)。

---

## 一、目標與範圍

### 1.1 目標

- **入庫唯一管道**：僅透過 **ReceivingNote complete** 寫入 PURCHASE_IN；合格數入庫，退回數不進庫。
- **與 Inventory / Finance 協作**：complete 後寫入 InventoryEvent（PURCHASE_IN）、FinanceEvent（PURCHASE_PAYABLE）；return-to-supplier 寫入 RETURN_TO_SUPPLIER、PURCHASE_RETURN。
- **流程簡化**：草稿 → 已下單（無核准步驟）；驗收人僅 inspectorName 字串，不綁 User。

### 1.2 範圍

| 範圍 | 說明 |
|------|------|
| **供應商** | CRUD、啟用／停用、搜尋 |
| **採購單** | 草稿、下單、取消、狀態（DRAFT／ORDERED／PARTIALLY_RECEIVED／RECEIVED／CANCELLED） |
| **進貨驗收** | 建立 RN、填寫實收／合格／退回、complete 入庫、reject |
| **退供應商** | 已驗收 RN 的合格品退倉，寫 RETURN_TO_SUPPLIER、PURCHASE_RETURN |
| **補貨→PO 草稿** | 依補貨建議建立 DRAFT 採購單 |

---

## 二、設計原則

- **入庫只對合格數**：qualifiedQty → PURCHASE_IN；returnedQty 僅紀錄，不進庫。
- **採購單流程**：無「已核准」步驟；DRAFT → ORDERED 單一 submit 即可。
- **驗收人**：inspectorName 字串，不綁定 User／員工表。
- **批次效期**：RN line 可填 batchCode、expiryDate，complete 時寫入 InventoryEvent。

---

## 三、API 總覽

### 3.1 Supplier

| Method | Path | 說明 | 狀態 |
|--------|------|------|------|
| GET | /suppliers | 列表、q 模糊搜尋 | **stable** |
| GET | /suppliers/:id | 單筆 | **stable** |
| POST | /suppliers | 建立 | **stable** |
| PATCH | /suppliers/:id | 更新 | **stable** |
| DELETE | /suppliers/:id | 刪除（進行中採購可 409） | **stable** |

### 3.2 PurchaseOrder

| Method | Path | 說明 | 狀態 |
|--------|------|------|------|
| GET | /purchase-orders | 列表、status、q 篩選 | **stable** |
| GET | /purchase-orders/:id | 含 lines、qtyReceived | **stable** |
| POST | /purchase-orders | 建立 DRAFT | **stable** |
| PATCH | /purchase-orders/:id | 僅 DRAFT 可改 | **stable** |
| POST | /purchase-orders/:id/submit | DRAFT → ORDERED | **stable** |
| POST | /purchase-orders/:id/cancel | → CANCELLED | **stable** |
| POST | /purchase-orders/from-replenishment | 依補貨建議建立 DRAFT | **stable** |

### 3.3 ReceivingNote

| Method | Path | 說明 | 狀態 |
|--------|------|------|------|
| GET | /receiving-notes | 列表、status、q 篩選 | **stable** |
| GET | /receiving-notes/:id | 詳情含 lines | **stable** |
| POST | /receiving-notes | 建立（PO 須 ORDERED／PARTIALLY_RECEIVED） | **stable** |
| PATCH | /receiving-notes/:id/lines | 實收／合格／退回、batchCode、expiryDate | **stable** |
| POST | /receiving-notes/:id/complete | 合格數 PURCHASE_IN、寫 PURCHASE_PAYABLE | **stable** |
| POST | /receiving-notes/:id/reject | 設為 RETURNED | **stable** |
| POST | /receiving-notes/:id/return-to-supplier | 已 complete RN 退供應商 | **stable** |

---

## 四、階段總覽

| 階段 | 主題 | 後端核心 | 前端核心 |
|------|------|----------|----------|
| **Phase 1** | 供應商與採購單 | Supplier CRUD、PO CRUD、submit、cancel | 供應商頁、採購單列表、下單 |
| **Phase 2** | 驗收與入庫 | RN 建立、lines、complete、PURCHASE_IN、PURCHASE_PAYABLE | 驗收單、完成驗收、入庫 |
| **Phase 3** | 批次效期與補貨閉環 | RN batchCode/expiryDate、from-replenishment | 效期輸入、補貨→採購草稿 |
| **Phase 4** | 退供應商 | return-to-supplier、RETURN_TO_SUPPLIER、PURCHASE_RETURN | 退供應商 UI |

---

## 五、與現況對照

### 5.1 已實作

| 項目 | 後端 | 前端 | 備註 |
|------|------|------|------|
| 供應商 | CRUD、q 搜尋 | AdminSuppliersPage | 完成 |
| 採購單 | CRUD、submit、cancel | AdminPurchaseOrdersPage | 完成 |
| 驗收單 | 建立、lines、complete | AdminReceivingNotesPage | 完成 |
| 補貨→PO | POST from-replenishment | 補貨建議頁建立採購草稿 | 完成 |
| 退供應商 | return-to-supplier | — | 後端完成；前端可補 |

### 5.2 未實作或選配

| 項目 | 說明 |
|------|------|
| 退供應商 UI | 後端 API 已就緒，前端入口可補 |

### 5.3 相關文件對照

| 文件 | 覆蓋範圍 |
|------|----------|
| [api-design-purchase.md](api-design-purchase.md) | 採購 API 契約 |
| [inventory-roadmap.md](inventory-roadmap.md) | 入庫（PURCHASE_IN）協作 |
| [erp-roadmap.md](erp-roadmap.md) | 全站 Phase |
