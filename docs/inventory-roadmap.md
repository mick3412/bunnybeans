# 庫存 — 整合型規格與開發計畫

本文件為**庫存管理**的單一總覽：先給出目標、設計原則、API 總覽與階段規劃，最後對照現況。核准後可依此調整 BACKEND/FRONTEND INSTRUCTIONS，並收斂散落於 api-design-inventory-finance、admin-inventory-ui 的重複描述。

> 上一輪整合見 [progress/integrated-last-cycle.md](progress/integrated-last-cycle.md)。API 細部契約見 [api-design-inventory-finance.md](api-design-inventory-finance.md)。

---

## 一、目標與範圍

### 1.1 目標

- **庫存事件為唯一事實來源**：所有入庫、出庫、調撥、盤點皆以 **InventoryEvent** 寫入，不允許 UPDATE/DELETE，僅能 INSERT 新事件。
- **餘額為投影**：`InventoryBalance` 由事件滾算或重算而得，不得手動修改。
- **與業務模組協作**：POS 銷售、採購驗收、退貨、盤點等皆透過 `InventoryService.recordInventoryEvent` 或 `POST /inventory/events` 寫入，不直接改餘額。

### 1.2 範圍

| 範圍 | 說明 |
|------|------|
| **庫存事件** | PURCHASE_IN、SALE_OUT、RETURN_FROM_CUSTOMER、RETURN_TO_SUPPLIER、TRANSFER_OUT/IN、STOCKTAKE_GAIN/LOSS |
| **餘額查詢** | 單倉／多倉、enriched（含 sku/name） |
| **調撥** | 原子雙倉調撥（TRANSFER_OUT + TRANSFER_IN） |
| **盤點** | 手動異動、CSV 匯入（STOCKTAKE_GAIN/LOSS） |
| **批次與效期** | ReceivingNoteLine 帶 batchCode/expiryDate，complete 寫入 InventoryEvent；GET /inventory/expiring 聚合 |
| **補貨建議** | 近 N 天 SALE_OUT 推估、safetyDays、建立採購草稿 |
| **匯出** | 餘額 CSV、事件 CSV |

---

## 二、設計原則（與不可變性設計對齊）

- **事件表 append-only**：InventoryEvent 僅 INSERT；不提供 UPDATE/DELETE API。
- **匯總為投影**：InventoryBalance 僅能由服務依事件滾算或重算，不提供手動改餘額的 API。
- **單一寫入入口**：POS、採購、盤點等模組呼叫 `InventoryService.recordInventoryEvent` 或 `POST /inventory/events`，不直接操作 DB。

詳細原則與雙軌、備援見 [inventory-finance-immutability.md](inventory-finance-immutability.md)。

---

## 三、事件型別與 API 總覽

### 3.1 事件型別（InventoryEventType）

| type | 說明 | 典型寫入來源 |
|------|------|--------------|
| **PURCHASE_IN** | 採購入庫 | ReceivingNote complete |
| **SALE_OUT** | 銷售扣庫 | POS createOrder |
| **RETURN_FROM_CUSTOMER** | 客戶退貨入庫 | POST /pos/orders/:id/return-to-stock |
| **RETURN_TO_SUPPLIER** | 退供應商扣庫 | POST /receiving-notes/:id/return-to-supplier |
| **TRANSFER_OUT** / **TRANSFER_IN** | 倉庫調撥 | POST /inventory/transfer |
| **STOCKTAKE_GAIN** / **STOCKTAKE_LOSS** | 盤盈／盤虧 | POST /inventory/events、POST /inventory/events/import |

### 3.2 API 總覽

| Method | Path | 說明 | 狀態 |
|--------|------|------|------|
| POST | /inventory/events | 新增一筆庫存事件 | **stable** |
| POST | /inventory/events/import | CSV 盤點匯入 | **stable** |
| POST | /inventory/import | 同 events/import（短 path） | **stable** |
| POST | /inventory/transfer | 原子調撥 | **stable** |
| GET | /inventory/balances | 查詢庫存匯總 | **stable** |
| GET | /inventory/balances/enriched | 查詢匯總（附 sku、name） | **stable** |
| GET | /inventory/balances/export | 單倉庫存餘額 CSV | **stable** |
| GET | /inventory/events | 查詢事件歷史（分頁） | **stable** |
| GET | /inventory/events/export | 庫存事件 CSV | **stable** |
| GET | /inventory/expiring | 即將到期批次 | **stable** |
| GET | /inventory/replenishment-suggestions | 補貨建議 | **stable** |

細部契約與欄位見 [api-design-inventory-finance.md](api-design-inventory-finance.md)。

---

## 四、階段總覽

| 階段 | 主題 | 後端核心 | 前端核心 |
|------|------|----------|----------|
| **Phase 1** | 基礎事件與餘額 | events、balances、enriched、transfer、CSV import/export | 庫存頁、倉庫選單、餘額表、盤點匯入、調撥 |
| **Phase 2** | 批次效期與補貨 | batchCode/expiryDate on InventoryEvent、expiring、replenishment-suggestions | 效期查詢、補貨建議頁 |
| **Phase 3** | 補貨閉環 | from-replenishment → DRAFT PO（採購模組） | 補貨建議勾選 → 建立採購草稿 → 導向採購單 |
| **Phase 4** | 選配與進階 | return-to-stock（客戶退貨）、報表穿透 | 退貨流程、與 POS/Finance 連結 |

---

## 五、與現況對照

### 5.1 已實作（截至 agent-log 最新）

| 項目 | 後端 | 前端 | 備註 |
|------|------|------|------|
| 庫存事件寫入 | POST /inventory/events | 手動異動頁、採購驗收、POS 建單 | 完成 |
| 餘額查詢 | GET balances、balances/enriched | 庫存頁、倉庫選單 | 完成 |
| 調撥 | POST /inventory/transfer | 調撥 UI | 完成 |
| 盤點 | POST events、POST events/import | 盤點 CSV 匯入、手動異動 | 完成 |
| 匯出 | balances/export、events/export | 匯出按鈕 | 完成 |
| 批次／效期 | InventoryEvent batchCode/expiryDate、GET /inventory/expiring | 效期顯示、即將到期 | 完成 |
| 補貨建議 | GET /inventory/replenishment-suggestions | 補貨建議頁 | 完成 |
| 補貨→PO | POST /purchase-orders/from-replenishment | 建立採購草稿按鈕 | 完成 |

### 5.2 未實作或選配

| 項目 | 說明 |
|------|------|
| return-to-stock | 客戶退貨入庫（api-design-inventory-finance 列為 Phase 2） |
| 報表穿透 | referenceId 與 POS/Finance 互相連結（erp-roadmap Phase 4） |

### 5.3 相關文件對照

| 文件 | 覆蓋範圍 |
|------|----------|
| [api-design-inventory-finance.md](api-design-inventory-finance.md) | 庫存與金流 API 契約 |
| [admin-inventory-ui.md](admin-inventory-ui.md) | 後台庫存 UI 與 API 對應 |
| [inventory-finance-immutability.md](inventory-finance-immutability.md) | 不可變設計與雙軌備援 |
| [erp-roadmap.md](erp-roadmap.md) | 全站 Phase，引用本檔 |
