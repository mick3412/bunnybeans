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
| **Promotion（促銷規則 CRUD）** | | | |
| `PROMOTION_NOT_FOUND` | 404 | 規則不存在或 merchant 不符 | 找不到促銷規則 |
| `PROMOTION_BODY_INVALID` | 400 | 缺少 merchantId／name 等 | 請檢查請求欄位 |
| `PROMOTION_REORDER_EMPTY` | 400 | bulk reorder 的 ids 為空 | 請提供規則 id 列表 |
| `PROMOTION_REORDER_DUPLICATE_IDS` | 400 | bulk reorder 的 ids 含重複 | 請移除重複的規則 id |
| **Inventory** | | | |
| `INVENTORY_PRODUCT_NOT_FOUND` | 404 | 商品不存在 | 商品不存在 |
| `INVENTORY_WAREHOUSE_NOT_FOUND` | 404 | 倉庫不存在 | 倉庫不存在 |
| `INVENTORY_INVALID_INPUT` | 400 | 缺 warehouseId 等 | 請檢查參數 |
| `INVENTORY_REFERENCE_ID_DUPLICATE` | 409 | 庫存事件 referenceId 已存在（盤點防呆） | 請換 referenceId 或勿重複送出 |
| `ADMIN_API_KEY_REQUIRED` | 401 | 已設定 ADMIN_API_KEY 但請求未帶或錯誤 | 後台寫入請帶 X-Admin-Key |
| **Finance** | | | |
| `FINANCE_UNSUPPORTED_EVENT_TYPE` | 400 | 不支援的金流事件類型 | 金流類型不支援 |
| `FINANCE_CURRENCY_REQUIRED` | 400 | 未提供幣別 | 請提供幣別 |
| `FINANCE_AMOUNT_INVALID` | 400 | 金額格式錯誤 | 金額必須為數字 |
| `FINANCE_LIST_PAGE_INVALID` | 400 | 分頁參數非法 | page ≥ 1，pageSize 1～100 |
| `FINANCE_PERIOD_CLOSED` | 400 | 寫入金流事件時該時間已屬關帳期間 | 該期間已關帳，無法寫入 |
| `FINANCE_PERIOD_OVERLAP` | 400 | 關帳區間與既有關帳重疊 | 請調整關帳區間 |
| `FINANCE_PERIOD_ALREADY_CLOSED` | 400 | 該區間內已有日期被關帳 | 請選擇未關帳區間 |
| `FINANCE_PERIOD_NOT_FOUND` | 404 | 解鎖時關帳紀錄不存在 | 找不到該關帳紀錄 |
| `CATEGORY_CODE_REQUIRED` | 400 | 未提供分類代碼 | 請提供 code |
| `CATEGORY_NAME_REQUIRED` | 400 | 未提供分類名稱 | 請提供 name |
| `CATEGORY_CODE_CONFLICT` | 409 | code 已存在 | 請使用其他代碼 |
| `CATEGORY_NOT_FOUND` | 404 | 分類不存在 | id 無效 |
| `CATEGORY_IN_USE` | 409 | 分類下仍有商品 | 先改商品分類或刪除商品後再刪 |
| **ProductTag** | | | |
| `PRODUCT_TAG_MERCHANT_REQUIRED` | 400 | GET /product-tags 或 POST body 未帶 merchantId | 請帶 merchantId |
| `PRODUCT_TAG_NAME_REQUIRED` | 400 | name 必填或不得為空 | 請填寫名稱 |
| `PRODUCT_TAG_CODE_REQUIRED` | 400 | code 必填或不得為空 | 請填寫代碼 |
| `PRODUCT_TAG_CODE_CONFLICT` | 409 | 同商家 code 已存在 | 請換標籤代碼 |
| `PRODUCT_TAG_NOT_FOUND` | 404 | 標籤不存在 | 找不到該標籤 |
| **採購 Supplier** | | | |
| `SUPPLIER_NOT_FOUND` | 404 | 供應商不存在或 merchant 不符 | 找不到供應商 |
| `SUPPLIER_MERCHANT_REQUIRED` | 400 | 未帶 merchantId | 請帶 merchantId |
| `SUPPLIER_CODE_CONFLICT` | 409 | 同商家 code 已存在 | 請換供應商代碼 |
| `SUPPLIER_IN_USE` | 409 | 有進行中採購／驗收 | 無法刪除 |
| `PURCHASE_PAYABLE` | （金流） | 驗收 **complete** 後寫入；見 api-design-purchase §5 | 後台應付／報表 |
| **採購 PO** | | | |
| `PO_NOT_FOUND` | 404 | 採購單不存在 | 找不到採購單 |
| `PO_MERCHANT_REQUIRED` | 400 | 未帶 merchantId | 請帶 merchantId |
| `PO_NOT_DRAFT` | 400 | 非草稿不可改明細 | 僅草稿可編輯 |
| `PO_INVALID_STATUS` | 400 | 狀態不允許（建立驗收／送出等） | 請檢查單據狀態 |
| `PO_LINES_REQUIRED` | 400 | 無明細 | 請至少一筆明細 |
| `PO_ORDER_NUMBER_CONFLICT` | 409 | 同商家單號已存在 | 請換採購單號 |
| `PO_MERCHANT_MISMATCH` | 400 | 供應商與倉庫不屬於同一商家 | 請重新選擇供應商或倉庫 |
| **進貨驗收 RN** | | | |
| `RN_NOT_FOUND` | 404 | 驗收單不存在 | 找不到驗收單 |
| `RN_MERCHANT_REQUIRED` | 400 | 未帶 merchantId | 請帶 merchantId |
| `RN_NOT_EDITABLE` | 400 | 已完成／已退回不可改 | 單據已結案 |
| `RN_COMPLETE_INVALID` | 400 | 合格數大於實收或可收上限；或退倉超過合格數（return-to-supplier） | 請檢查數量 |
| `PO_LINE_NOT_FOUND` | 400 | 驗收明細列不屬於本單 | 明細錯誤 |
| **Customer / 會員主檔 2.0** | | | |
| `CUSTOMER_NOT_FOUND` | 404 | 客戶不存在或 merchant 不符 | 找不到該會員 |
| `CUSTOMER_MERGE_INVALID` | 400 | 合併時 primaryId/mergeIds 同筆、或非同 merchant、或缺欄位 | 請檢查合併主檔與併入列表 |
| `CUSTOMER_CONTACT_TYPE_REQUIRED` | 400 | POST /customers/:id/contacts 未帶 type | 請填寫聯絡類型 |
| `SEGMENT_NOT_FOUND` | 404 | GET /crm/segments/:id/preview 或 :id/export 分群不存在 | 找不到該分群 |
| `CRM_MERCHANT_REQUIRED` | 400 | GET /crm/segments 未帶 merchantId | 請帶 merchantId |
| `CRM_JOB_KIND_INVALID` | 400 | POST /crm/jobs/:kind 之 kind 非 segment-coupon｜birthday-coupon｜repurchase-coupon | 請使用有效 job kind |
| `CRM_JOB_MERCHANT_REQUIRED` | 400 | POST /crm/jobs/:kind body 未帶 merchantId | 請帶 merchantId |
| `CRM_JOB_SEGMENT_REQUIRED` | 400 | POST /crm/jobs/:kind body 未帶 segmentId | 請帶 segmentId |
| `CRM_JOB_COUPON_REQUIRED` | 400 | POST /crm/jobs/:kind body 未帶 couponId 或 couponCode | 請帶 couponId 或 couponCode |
| `CRM_JOB_COUPON_NOT_FOUND` | 400 | POST /crm/jobs/:kind 依 couponId／couponCode 查無該商家優惠券 | 找不到該優惠券 |
| `CRM_JOB_NOT_FOUND` | 404 | GET /crm/jobs/:id 查無該 job | 找不到該任務 |
| `CRM_DISPATCH_RULE_NOT_FOUND` | 404 | PATCH/DELETE /crm/dispatch-rules/:id 查無該規則 | 找不到該發券規則 |
| `CRM_DISPATCH_SCHEDULE_INVALID` | 400 | scheduleType 非 manual｜daily｜weekly｜monthly | 請使用有效排程類型 |
| `CRM_RECALC_MERCHANT_REQUIRED` | 400 | POST /crm/recalc-tiers 未帶 merchantId | 請帶 merchantId |
| **Loyalty / Import** | | | |
| `LOYALTY_COUPON_DUPLICATE` | 400 | 同商家 coupon code 已存在 | 請換代碼 |
| `LOYALTY_INSUFFICIENT_POINTS` | 400 | 結帳折抵點數超過餘額 | 點數餘額不足 |
| `IMPORT_JOB_RATE_LIMIT` | 429 | POST /imports/jobs 超過每分鐘次數 | 請稍後再試 |
| `MERCHANT_NOT_FOUND` | 404 | GET /merchant/current 無 DEFAULT_MERCHANT_ID 且 DB 無商家 | 請先建立商家或設定 DEFAULT_MERCHANT_ID |
| `MERCHANT_AMBIGUOUS` | 400 | GET /merchant/current 多筆商家且未設定 DEFAULT_MERCHANT_ID | 請設定 env DEFAULT_MERCHANT_ID |
| **報表（POS / Finance）** | | | |
| `REPORT_INVALID_RANGE` | 400 | 報表查詢 `from`／`to` 非法（例如 from＞to、無法解析為日期） | 請檢查查詢區間 |
| `REPORT_RANGE_TOO_LARGE` | 400 | 報表查詢區間超過上限（例如超過 366 天） | 請縮小查詢區間 |
| `OPS_JOB_KIND_INVALID` | 400 | POST /ops/jobs/run kind 不支援 | 請使用有效的 job kind |
| `OPS_REPORT_CLICK_AUDIT_INVALID` | 400 | POST /ops/reports/click-audit body 缺少 source 等欄位 | 請檢查請求欄位 |

## Request Log

每個 HTTP 請求結束後會寫出一筆 JSON log，欄位包含：

- **traceId**
- **module**：由 path 第一段推導（如 `pos`、`inventory`、`merchants`）。
- **method**、**path**
- **statusCode**
- **durationMs**

前端可於請求時帶上自訂 `X-Trace-Id`，錯誤回應與後端 log 會帶上該值，方便除錯。
