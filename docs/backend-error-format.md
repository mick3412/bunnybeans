# 後端統一錯誤格式與 Request Log

## 錯誤回應格式

所有 API 錯誤（4xx / 5xx）皆由全域 `HttpExceptionFilter` 統一成下列 JSON 結構：

```json
{
  "statusCode": 400,
  "message": "Human-readable message",
  "error": "Bad Request",
  "code": "POS_PAYMENT_MISMATCH",
  "traceId": "uuid-or-client-provided"
}
```

- **code**（選填）：業務錯誤碼，見下方對照表；非業務錯誤或未設定時不帶此欄位。

- **statusCode**：HTTP 狀態碼。
- **message**：給前端／人員閱讀的訊息（來自 NestJS `HttpException` 或預設 `Internal server error`）。
- **error**：對應 HTTP 狀態的預設說明（如 `Bad Request`、`Not Found`、`Conflict`）。
- **traceId**（選填）：若請求帶入 `X-Trace-Id` header 或由後端自動產生，會回傳同一值，供前端與後端 log 對應。

業務錯誤會帶上 **code** 欄位（見下方對照表），前端可依 `code` 做文案 mapping。

### 業務錯誤碼對照表

| code | HTTP 狀態 | 說明 | 建議前端文案（可自訂） |
|------|-----------|------|------------------------|
| **POS** | | | |
| `POS_ITEMS_EMPTY` | 400 | 訂單品項為空 | 請至少加入一項商品 |
| `POS_STORE_NOT_FOUND` | 404 | 門市不存在 | 找不到門市，請重新選擇 |
| `POS_CUSTOMER_NOT_FOUND` | 404 | 客戶不存在或不屬於該門市商家 | 找不到客戶，請重新選擇 |
| `POS_STORE_NO_WAREHOUSE` | 400 | 門市未設定倉庫 | 門市尚未設定庫存倉庫 |
| `POS_PRODUCT_NOT_FOUND` | 404 | 商品不存在 | 部分商品不存在，請重新整理 |
| `POS_PAYMENT_MISMATCH` | 400 | 付款總額與訂單總額不符（未開賒帳時須全額付清） | 付款金額與訂單金額不一致 |
| `POS_CREDIT_REQUIRES_CUSTOMER` | 400 | 賒帳時未帶可解析客戶（須 customerId 或唯一 phone/email） | 掛帳請輸入 UUID／手機／Email |
| `POS_CREDIT_CUSTOMER_NOT_FOUND` | 404 | 賒帳依手機／Email 查無客戶 | 查無客戶，請建立客戶或改用 UUID |
| `POS_CREDIT_CUSTOMER_LOOKUP_AMBIGUOUS` | 400 | 同商號多筆客戶同手機或同 Email | 請改用會員 ID（UUID） |
| `POS_PAYMENT_EXCEEDS_TOTAL` | 400 | 賒帳時實收超過應收 | 實收金額不可超過訂單總額 |
| `POS_PAYMENT_AMOUNT_INVALID` | 400 | 付款列金額非法（負數或非數字） | 請檢查付款金額 |
| `INVENTORY_INSUFFICIENT` | 409 | 庫存不足（POS 結帳時） | 庫存不足，請調整數量或稍後再試 |
| `POS_ORDER_NOT_FOUND` | 404 | 訂單不存在 | 找不到此訂單 |
| `POS_ORDER_ALREADY_SETTLED` | 400 | 訂單已結清，不可再補款 | 此單已收齊，無需補款 |
| `POS_PAYMENT_EXCEEDS_REMAINING` | 400 | 補款金額超過未收餘額 | 補款金額不可超過未收金額 |
| `POS_CREDIT_NO_RECEIVABLE` | 400 | 無對應 SALE_RECEIVABLE，無法補款（舊資料） | 無法對此單補款，請聯繫管理員 |
| `POS_REFUND_NO_PAYMENT` | 400 | 訂單無任何實收（PosOrderPayment 合計為 0），不可退款 | 此單尚未收款，無法退款 |
| `POS_REFUND_EXCEEDS_PAID` | 400 | 退款金額超過可退餘額（實收 − 已退） | 退款金額不可超過已收金額 |
| `POS_RETURN_ITEMS_EMPTY` | 400 | 退貨入庫 items 為空 | 請至少選擇一項退貨 |
| `POS_RETURN_PRODUCT_NOT_ON_ORDER` | 400 | productId 不在該訂單明細 | 僅能退原單商品 |
| `POS_RETURN_EXCEEDS_SOLD` | 400 | 退貨數量超過原銷量減已退 | 退貨數量不可超過原賣出量 |
| **Inventory** | | | |
| `INVENTORY_PRODUCT_NOT_FOUND` | 404 | 商品不存在 | 商品不存在 |
| `INVENTORY_WAREHOUSE_NOT_FOUND` | 404 | 倉庫不存在 | 倉庫不存在 |
| `INVENTORY_INVALID_INPUT` | 400 | 缺 warehouseId 等 | 請檢查參數 |
| `ADMIN_API_KEY_REQUIRED` | 401 | 已設定 ADMIN_API_KEY 但請求未帶或錯誤 | 後台寫入請帶 X-Admin-Key |
| **Finance** | | | |
| `FINANCE_UNSUPPORTED_EVENT_TYPE` | 400 | 不支援的金流事件類型 | 金流類型不支援 |
| `FINANCE_CURRENCY_REQUIRED` | 400 | 未提供幣別 | 請提供幣別 |
| `FINANCE_AMOUNT_INVALID` | 400 | 金額格式錯誤 | 金額必須為數字 |
| `FINANCE_LIST_PAGE_INVALID` | 400 | 分頁參數非法 | page ≥ 1，pageSize 1～100 |
| `CATEGORY_CODE_REQUIRED` | 400 | 未提供分類代碼 | 請提供 code |
| `CATEGORY_NAME_REQUIRED` | 400 | 未提供分類名稱 | 請提供 name |
| `CATEGORY_CODE_CONFLICT` | 409 | code 已存在 | 請使用其他代碼 |
| `CATEGORY_NOT_FOUND` | 404 | 分類不存在 | id 無效 |
| `CATEGORY_IN_USE` | 409 | 分類下仍有商品 | 先改商品分類或刪除商品後再刪 |

## Request Log

每個 HTTP 請求結束後會寫出一筆 JSON log，欄位包含：

- **traceId**
- **module**：由 path 第一段推導（如 `pos`、`inventory`、`merchants`）。
- **method**、**path**
- **statusCode**
- **durationMs**

前端可於請求時帶上自訂 `X-Trace-Id`，錯誤回應與後端 log 會帶上該值，方便除錯。
