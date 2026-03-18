# 訂單 — 整合型規格與開發計畫

本文件為 **POS 訂單管理** 的單一總覽：先給出目標、設計原則、API 總覽與階段規劃，最後對照現況。核准後可依此調整 BACKEND/FRONTEND INSTRUCTIONS，並收斂散落於 api-design-pos 的重複描述。

> 上一輪整合見 [progress/integrated-last-cycle.md](progress/integrated-last-cycle.md)。API 細部契約見 [api-design-pos.md](api-design-pos.md)。

---

## 一、目標與範圍

### 1.1 目標

- **訂單為不可刪改**：PosOrder 建立後不提供 DELETE；修正僅能透過退款、補款等新事件。
- **金流與庫存透過事件**：建單時寫入 InventoryEvent（SALE_OUT）、FinanceEvent（SALE_RECEIVABLE、SALE_PAYMENT）；補款寫 SALE_PAYMENT、退款寫 SALE_REFUND；退貨寫 RETURN_FROM_CUSTOMER。
- **單一銷售單流程**：Phase 1～2 涵蓋建單、查詢、賒帳、補款、退款、退貨入庫、匯出與報表。

### 1.2 範圍

| 範圍 | 說明 |
|------|------|
| **訂單建立** | 建單（含促銷試算）、賒帳（allowCredit）、會員關聯（customerId） |
| **訂單查詢** | 列表（分頁、storeId、日期篩選）、單筆明細 |
| **補款** | 賒帳單追加收款，寫 SALE_PAYMENT |
| **退款** | 已實收範圍內登記 SALE_REFUND（不自動退庫） |
| **退貨入庫** | 依訂單明細寫 RETURN_FROM_CUSTOMER |
| **匯出** | 訂單 CSV（訂單層級或含明細） |
| **報表** | summary、top-items、daily（見 POS 報表） |

---

## 二、設計原則

- **訂單不 DELETE**：PosOrder 建立後僅能透過補款／退款／退貨等流程調整狀態。
- **金流寫入**：建單時 SALE_RECEIVABLE；補款時 SALE_PAYMENT；退款時 SALE_REFUND。皆透過 FinanceService，不直接改 DB。
- **庫存寫入**：建單時 SALE_OUT；退貨時 RETURN_FROM_CUSTOMER。皆透過 InventoryService，不直接改 InventoryBalance。
- **促銷試算**：可先呼叫 `POST /pos/promotions/preview` 取得 subtotal/discount/total，再以相同金額建單。

---

## 三、API 總覽

| Method | Path | 說明 | 狀態 |
|--------|------|------|------|
| POST | /pos/orders | 建立 POS 銷售單 | **stable** |
| GET | /pos/orders | 訂單列表（分頁、storeId、from/to） | **stable** |
| GET | /pos/orders/:id | 單筆訂單明細 | **stable** |
| POST | /pos/orders/:id/payments | 補款（追加收款） | **stable** |
| POST | /pos/orders/:id/refunds | 退款（SALE_REFUND） | **stable** |
| POST | /pos/orders/:id/return-to-stock | 退貨入庫（RETURN_FROM_CUSTOMER） | **stable** |
| GET | /pos/orders/export | 訂單 CSV 匯出 | **stable** |
| POST | /pos/promotions/preview | 促銷試算 | **stable** |

細部契約見 [api-design-pos.md](api-design-pos.md)。

---

## 四、階段總覽

| 階段 | 主題 | 後端核心 | 前端核心 |
|------|------|----------|----------|
| **Phase 1** | 建單與查詢 | createOrder、list、get、促銷試算 | POS 結帳、訂單列表、訂單明細 |
| **Phase 2** | 賒帳與補款 | allowCredit、payments 補款 | 結帳賒帳、會員選取、補款 UI |
| **Phase 3** | 退款與退貨 | refunds、return-to-stock | 退款登記、退貨入庫 UI |
| **Phase 4** | 匯出與報表 | export、reports（summary/top-items/daily） | 匯出按鈕、POS 報表頁 |

---

## 五、與現況對照

### 5.1 已實作（截至 agent-log 最新）

| 項目 | 後端 | 前端 | 備註 |
|------|------|------|------|
| 建單 | POST /pos/orders | POS 結帳介面 | 完成；含促銷、賒帳、會員 |
| 列表與明細 | GET orders、GET :id | 訂單列表、訂單明細頁 | 完成 |
| 促銷試算 | POST /pos/promotions/preview | 結帳前試算 | 完成 |
| 補款 | POST /pos/orders/:id/payments | 補款流程 | 完成 |
| 退款 | POST /pos/orders/:id/refunds | 退款登記 | 完成 |
| 退貨入庫 | POST /pos/orders/:id/return-to-stock | return-to-stock | 完成 |
| 匯出 | GET /pos/orders/export | 匯出訂單 CSV | 完成 |
| 報表 | summary、top-items、daily | POS 報表頁 | 完成 |

### 5.2 未實作或選配

| 項目 | 說明 |
|------|------|
| 報表穿透 | referenceId 與 Finance/Loyalty 互相連結（erp-roadmap Phase 4） |
| 換貨流程 | 退貨＋新單組合（目前僅退貨入庫） |

#### 5.2a 換貨 MVP（draft）

> 目標：支援門市「換貨」最小流程（MVP）：**先退貨入庫**（沖回庫存）＋**建立新單**（再次扣庫）＝以「兩筆既有能力」組合完成，不新增後端 exchange 資料表。

- **入口**：在 POS 訂單明細（舊單）觸發「換貨」。
- **流程（建議）**（前端導引式，多步驟）
  - Step 1：對原訂單做「退貨入庫」  
    - 使用既有 `POST /pos/orders/:id/return-to-stock`  
    - 僅寫入 `InventoryEvent(RETURN_FROM_CUSTOMER)`；**不**自動退款（退款仍走 `POST /pos/orders/:id/refunds`）
  - Step 2：建立一張「新訂單」  
    - 使用既有 `POST /pos/orders`（可套用促銷）  
    - 若需要補差額：優先沿用既有結帳能力（現金/刷卡/轉帳）；若採「先出新單再處理差額」，則以「補款／退款」兩段完成（依門市規則）。
  - Step 3（選配，依門市規則）：差額處理  
    - **新單金額 > 舊單可退金額**：舊單先不退款（或少退），新單照正常收款；若新單允許賒帳則可部分收款 + allowCredit。  
    - **新單金額 < 舊單可退金額**：舊單走退款（`POST /pos/orders/:id/refunds`），不影響已退貨入庫結果。

- **限制與決策（先採用最小可行）**
  - **同一客戶**：不強制；但若原單有 `customerId`，前端 **預設帶入**新單 `customerId`（可手動改/清除）。  
  - **是否可跨商品**：可（換不同商品，本質是退貨入庫 + 新單）。  
  - **是否可跨門市/倉庫**：MVP 先限制同門市（沿用原單 `storeId`；退貨入庫需回原扣庫倉）。  
  - **reference 關聯（Phase 2）**：新單可在 `POST /pos/orders` body 帶 `exchangeFromOrderId=原單PosOrder.id`；後端會在 `GET /pos/orders/:id` 回傳 `exchangeFromOrderId`，供對帳與追溯「此單由哪張原單換貨而來」。

- **錯誤碼與防呆（沿用既有）**
  - 退貨入庫：
    - `POS_RETURN_ITEMS_EMPTY`：未選擇任何退貨品項或未填數量  
    - `POS_RETURN_PRODUCT_NOT_ON_ORDER`：退貨品項不在原訂單  
    - `POS_RETURN_EXCEEDS_SOLD`：退貨數量超過原銷售  
  - 建新單：
    - `POS_PAYMENT_MISMATCH`：付款金額與訂單金額不一致  
    - `INVENTORY_INSUFFICIENT`：庫存不足  
    - `POS_STORE_NO_WAREHOUSE`：門市未綁定庫存倉庫  
  - 文案原則：錯誤提示以繁中顯示、避免技術字串；必要時附「如何修正」一句話。

### 5.3 相關文件對照

| 文件 | 覆蓋範圍 |
|------|----------|
| [api-design-pos.md](api-design-pos.md) | POS 訂單 API 契約 |
| [api-design-inventory-finance.md](api-design-inventory-finance.md) | 庫存／金流事件（SALE_OUT、SALE_RECEIVABLE 等） |
| [erp-roadmap.md](erp-roadmap.md) | 全站 Phase，引用本檔 |
