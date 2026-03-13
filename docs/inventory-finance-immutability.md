## 庫存與金流紀錄不可更改與雙重備援設計

本文件說明 ERP 專案中，如何在**資料模型、資料庫、應用程式與備援機制**上，確保：

- 庫存與金流紀錄「不可隨意更改」，只能透過新事件修正舊狀態。
- 至少有「兩份以上」可驗證的紀錄來源，可用來交叉比對與還原。

本文件為高階設計，實作細節（欄位、SQL、程式碼）會在選定技術棧後補充。

---

## 1. 資料模型：事件 + 匯總雙軌

### 1.1 事件表（Append-only Event Store）

- **庫存事件（InventoryEvent）**
  - 範例事件型別：
    - `PURCHASE_IN`：採購入庫
    - `SALE_OUT`：銷售扣庫
    - `RETURN_FROM_CUSTOMER`：客戶退貨入庫
    - `RETURN_TO_SUPPLIER`：退回供應商扣庫
    - `TRANSFER_OUT` / `TRANSFER_IN`：倉庫調撥
    - `STOCKTAKE_GAIN` / `STOCKTAKE_LOSS`：盤盈 / 盤虧
  - 基本欄位概念（實際欄位待 DB 設計）：
    - 事件 ID、事件時間
    - 商品 / 批號 / 序號
    - 倉庫
    - 數量（正負）
    - 關聯單據（採購單、銷售單、退貨單、盤點單等）

- **金流事件（FinanceEvent）**
  - 範例事件型別：
    - `SALE_RECEIVABLE`：銷售產生應收
    - `SALE_REFUND`：銷售退款
    - `PURCHASE_PAYABLE`：進貨產生應付
    - `PURCHASE_REBATE` / `PURCHASE_RETURN`：退供、折讓
    - `ADJUSTMENT`：人工調整（需特別 Audit）
  - 基本欄位概念：
    - 事件 ID、事件時間
    - 關聯對象（客戶 / 供應商）
    - 金額、幣別、稅額
    - 關聯單據（銷售單、進貨單、退款單等）

> 關鍵原則：**事件表為事實來源，不允許 UPDATE / DELETE，只能 INSERT 新事件。**  
> 所有修正都透過新事件「沖銷 / 調整」來達成。

### 1.2 匯總表（Projection / Snapshot）

為了查詢效能與報表展示，系統會維護以下匯總：

- `InventoryBalance`：各商品 / 倉庫 / 批號當前庫存結餘。
- `AccountBalance` / `ArApSummary`：各客戶 / 供應商應收 / 應付餘額。

原則：

- 匯總表**只是一種投影**，所有數值都可以從事件表重新計算得到。
- 匯總表內容不得手動修改，只能透過系統服務根據新事件「滾算」或「全量重算」。

### 1.3 雙軌紀錄與交叉驗證

任一庫存或金流數字，都可以同時從：

- 事件表（InventoryEvent / FinanceEvent）
- 匯總表（InventoryBalance / ArApSummary）

進行交叉比對，若發現不一致，可用「重新播放事件」方式重建匯總表，這是第一層「雙重紀錄」。

---

## 2. 資料庫層保護機制

### 2.1 權限設計

- 正式環境資料庫：
  - 應用程式帳號：
    - 對事件表：僅開啟 `INSERT` + `SELECT` 權限。
    - 對匯總表：僅透過預先定義的 Stored Procedure 或服務更新，不提供裸露的 `UPDATE` 權限給人工作業。
  - DBA / 管理員帳號：
    - 僅在緊急情況或維運作業下使用，並有額外稽核流程。

### 2.2 Trigger / Constraint

（具體語法待選定 DB，如 PostgreSQL / MySQL）

- 在事件表上加 Trigger：
  - 攔截 `UPDATE` / `DELETE`，若有操作直接 `RAISE ERROR` 並記錄 Audit Log。
- 在匯總表上：
  - 限制某些欄位不可直接更新，或要求只能透過特定 Stored Procedure 修改。

這層保護可以防止誤用工具（例如直接在 SQL Console 下 UPDATE）破壞正式紀錄。

---

## 3. 應用程式層防火牆

### 3.1 統一服務入口

- 在 `Inventory` 模組：
  - 定義統一的庫存服務（例如：`InventoryService`），提供方法：
    - `recordInventoryEvent(...)`
    - `getInventoryBalance(...)`
  - 任何功能（POS、採購、退貨、盤點、補貨演算法）若要異動庫存，都必須呼叫這些方法，**不得直接寫 DB**。

- 在 `Finance` 模組：
  - 定義統一的金流服務（例如：`FinanceService`），提供方法：
    - `recordFinanceEvent(...)`
    - `getAccountBalance(...)`

### 3.2 Repository / DAO 設計

- 事件表的 Repository：
  - 只提供 `append*Event` / `listEvents` / `findEventsBy...` 等方法。
  - **不提供** `updateEvent` / `deleteEvent`。
- 匯總表的 Repository：
  - 僅供讀取與由服務層驅動的更新流程，不給「任意 UPDATE」的便利函式。

### 3.3 關帳與鎖帳機制

- 定義 `ClosingEvent` 或對應表，紀錄：
  - 關帳期間（起訖日）
  - 關帳時間與操作者
- 規則：
  - 關帳後，該期間內的事件不得再新增或調整；
  - 若真的需要調整，必須先「解鎖」並留下明確 Audit Log。

---

## 4. Audit Log：第二層紀錄

除了事件本身，還需要一份「操作紀錄」：

- 每次異動庫存或金流時，紀錄：
  - 操作者（帳號 / 角色）
  - 操作時間
  - 來源（POS、後台、外部 API）
  - 執行的 Use Case 名稱
  - 主要輸入參數概要
  - 關聯的事件 ID（InventoryEventID / FinanceEventID）

這份 Audit Log 不一定在同一資料庫，也可以在獨立的日誌系統（如 Log Server / SIEM），形成**另一份獨立紀錄**。

---

## 5. 備份與多副本策略

### 5.1 資料庫多副本

- 規劃：
  - **主庫 + 同步備庫（Replica）**：用於高可用與讀取分擔。
  - **定期備份**：
    - 每日全量備份（建議在離峰時間執行）。
    - 每 X 小時增量備份。
  - 備份檔儲存位置：
    - 與主庫不同的實體磁區或儲存系統，避免單一硬體故障。

### 5.2 報表快照（選配）

- 針對關鍵時間點（例：每日結帳、月結）：
  - 產出不可變的報表快照檔案，例如：
    - `YYYY-MM-DD-inventory-snapshot.csv`
    - `YYYY-MM-DD-finance-summary.json`
  - 儲存在檔案伺服器或物件儲存，可視需要做版本控管。

這些快照提供一份「人類可讀」的外部參考，有助於稽核與對外溝通。

---

## 6. 開發與流程規範（與 DEVELOPMENT-GUIDELINES.md 對應）

- 在 `DEVELOPMENT-GUIDELINES.md` 中已約定：
  - **庫存異動必須集中控管**，不得在其他模組直接改庫存表。
  - **財務數字的唯一來源**，不可手工修改結果表。
- 本文件補充具體作法：
  - 以事件表作為唯一事實來源（不可改）。
  - 以匯總表作為投影結果（可重建）。
  - 以 Audit Log 與 DB 備份 / 報表快照作為第二層與第三層證據。

實作階段，需依實際選用 DB 與後端技術，為上述概念補上具體：

- 資料表結構（DDL）
- 觸發器 / 權限設定
- 服務 / Repository 介面與測試案例

