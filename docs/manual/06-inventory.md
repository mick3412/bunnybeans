## 庫存（查詢/調整/批號效期）

---

## 查詢庫存

## 目的

- 以商品或倉庫維度快速查看現有庫存。

## 前置條件

- 你已建立至少一個倉庫/門市。

## 操作步驟（3–7 步）

1. 進入「庫存 / 庫存查詢」。
2. 用商品名稱/SKU/條碼搜尋商品。
3. 檢查總庫存與各倉庫庫存（若有）。

## 成功判斷

- 查得到正確商品，庫存數量合理。

## 常見錯誤與排除

- **庫存為 0 但應該有量**：確認是否尚未做初始入庫/驗收，或是否看錯倉庫。

## 圖示

- （待補）`docs/manual/assets/06_inventory_search_01.png`

---

## 庫存調整（盤點/報廢/補差）

## 目的

- 直接調整某倉庫的庫存數量並留下原因。

## 前置條件

- 你知道要調整的倉庫與商品。

## 操作步驟（3–7 步）

1. 進入「庫存 / 庫存調整」。
2. 選擇倉庫。
3. 選擇商品，輸入調整數量（增加/減少）或調整後結存（依 UI）。
4. 填寫原因（盤點、報廢、補差等）。
5. 送出。

## 成功判斷

- 庫存查詢頁顯示數量已更新，且調整紀錄可追蹤（若有事件/紀錄頁）。

## 常見錯誤與排除

- **不允許調到負數**：改用正確的調整方式或先確認是否有未入帳出庫。

## 圖示

- （待補）`docs/manual/assets/06_inventory_adjust_01.png`

---

## 盤點（掃碼盤點 / 批次盤點）

## 目的

- 用盤點結果把系統庫存校正為「實際數量」，並留下可追溯紀錄。

## 前置條件

- 你已選定要盤點的倉庫。
- 你有盤點清單（或現場掃碼逐項盤）。

## 操作步驟（3–7 步）

1. 進入「庫存 / 盤點」。
2. 選擇倉庫。
3. 二選一：
   - **掃碼盤點**：用 SKU（後續可能支援條碼）逐項輸入實際數量。
   - **批次盤點**：貼上/上傳盤點列（商品 + 實際數量）。
4. 送出盤點。
5. 抽查幾個品項：庫存查詢顯示已被校正。

## 流程圖（決策）

```mermaid
flowchart TD
  start[Start] --> chooseWarehouse[ChooseWarehouse]
  chooseWarehouse --> chooseMode{StocktakeMode}
  chooseMode -->|Scan| scanSku[ScanSkuAndInputQty]
  chooseMode -->|Batch| batchPaste[PasteOrUploadLines]
  scanSku --> submit[Submit]
  batchPaste --> submit
  submit --> review[ReviewBalances]
```

## 成功判斷

- 盤點完成後，該倉庫的庫存與盤點數一致。

## 常見錯誤與排除

- **SKU 查不到商品**：先回商品主檔確認 SKU 是否正確、是否有多 SKU/重複問題。

## 圖示

- （待補）`docs/manual/assets/06_stocktake_01.png`

---

## 庫存調撥（倉庫 A → 倉庫 B）

## 目的

- 把庫存從一個倉庫移到另一個倉庫（例如總倉補門市倉）。

## 前置條件

- 來源倉庫有足夠庫存。

## 操作步驟（3–7 步）

1. 進入「庫存 / 調撥」。
2. 選擇來源倉庫與目的倉庫。
3. 加入調撥商品與數量。
4. 送出調撥。

## 流程圖（最短 SOP）

```mermaid
flowchart TD
  start[Start] --> fromWh[FromWarehouse]
  fromWh --> toWh[ToWarehouse]
  toWh --> addItems[AddItemsAndQty]
  addItems --> submit[Submit]
  submit --> verify[VerifyBalances]
```

## 成功判斷

- 來源倉庫庫存減少、目的倉庫庫存增加。

## 常見錯誤與排除

- **庫存不足（409）**：降低調撥數量，或先確認來源倉庫是否有未入帳的出入庫。

## 圖示

- （待補）`docs/manual/assets/06_transfer_01.png`

