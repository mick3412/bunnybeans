# Admin Dashboard API

> **GET** `admin/dashboard/summary`  
> 用途：後台首頁 Dashboard 指標（Forge 殼 + Dashboard 階段）。  
> **認證**：不需 `X-Admin-Key`（僅讀）。

## 回應 JSON

| 欄位 | 型別 | 說明 |
|------|------|------|
| `productCount` | number | `Product` 總筆數 |
| `skuOutOfStockCount` | number | 全倉 `InventoryBalance` 依 `productId` 加總後 **等於 0** 的商品數（無餘額列視同 0） |
| `skuLowStockCount` | number | 加總 **大於 0 且小於** `lowStockThreshold` 的商品數 |
| `ordersTodayCount` | number | 本日 00:00（伺服器本地時區）起建立的 `PosOrder` 筆數 |
| `totalOnHandUnits` | number | 所有倉 `onHandQty` 加總 |
| `inventoryValueApprox` | string | 約略庫存金額：`Σ (onHandQty × salePrice)`，以十進位字串回傳 |
| `lowStockThreshold` | number | 低庫存門檻（與環境變數一致，預設 10） |

## 環境變數

- **`DASHBOARD_LOW_STOCK_THRESHOLD`**（選填）：預設 `10`。低庫存 SKU 計數為「全倉加總庫存 ∈ (0, 門檻)」。

## 與範本差異

- 無 `reorderLevel` 時，不以「低於補貨點」定義，而以固定門檻區分低庫存。
- 「今日訂單」對應 POS 已成立單據，非採購待處理單。
