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
| `POS_STORE_NO_WAREHOUSE` | 400 | 門市未設定倉庫 | 門市尚未設定庫存倉庫 |
| `POS_PRODUCT_NOT_FOUND` | 404 | 商品不存在 | 部分商品不存在，請重新整理 |
| `POS_PAYMENT_MISMATCH` | 400 | 付款總額與訂單總額不符 | 付款金額與訂單金額不一致 |
| `INVENTORY_INSUFFICIENT` | 409 | 庫存不足（POS 結帳時） | 庫存不足，請調整數量或稍後再試 |
| `POS_ORDER_NOT_FOUND` | 404 | 訂單不存在 | 找不到此訂單 |
| **Inventory** | | | |
| `INVENTORY_PRODUCT_NOT_FOUND` | 404 | 商品不存在 | 商品不存在 |
| `INVENTORY_WAREHOUSE_NOT_FOUND` | 404 | 倉庫不存在 | 倉庫不存在 |
| **Finance** | | | |
| `FINANCE_UNSUPPORTED_EVENT_TYPE` | 400 | 不支援的金流事件類型 | 金流類型不支援 |
| `FINANCE_CURRENCY_REQUIRED` | 400 | 未提供幣別 | 請提供幣別 |
| `FINANCE_AMOUNT_INVALID` | 400 | 金額格式錯誤 | 金額必須為數字 |

## Request Log

每個 HTTP 請求結束後會寫出一筆 JSON log，欄位包含：

- **traceId**
- **module**：由 path 第一段推導（如 `pos`、`inventory`、`merchants`）。
- **method**、**path**
- **statusCode**
- **durationMs**

前端可於請求時帶上自訂 `X-Trace-Id`，錯誤回應與後端 log 會帶上該值，方便除錯。
