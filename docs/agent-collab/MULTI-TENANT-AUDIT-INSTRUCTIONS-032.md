# Multi-tenant 稽核清單（INSTRUCTIONS 032）

檢視所有「依 merchant 查詢」的 API；確認 merchantId/storeId 隔離完整。

## 已符合（merchantId/storeId 隔離完整）

| API | 隔離方式 | 備註 |
|-----|----------|------|
| GET /promotion-rules | merchantId query 必填；list 過濾 | ✅ |
| GET /promotion-rules/effectiveness | merchantId query | ✅ |
| PATCH /promotion-rules/reorder/bulk | body.merchantId | ✅ |
| POST /promotion-rules | body.merchantId | ✅ |
| PATCH /promotion-rules/:id | body.merchantId | ✅ |
| DELETE /promotion-rules/:id | merchantId query | ✅ |
| GET /pos/reports/* | merchantId query 或 resolveMerchantId | ✅ |
| GET /pos/orders | storeId（store → merchant FK） | ✅ |
| GET /suppliers | merchantId query | ✅ |
| GET /suppliers/:id | merchantId 驗證（getById） | ✅ |
| POST /purchase-orders | merchantId in body | ✅ |
| GET /receiving-notes | merchantId query | ✅ |
| GET /finance/events | merchantId（透過 Party view） | ✅ |
| GET /finance/balances | merchantId 必填；Party 子查詢隔離 | ✅ |
| GET /finance/summary | merchantId（groupBy=partyId 時） | ✅ |
| GET /loyalty/* | merchantId query | ✅ |
| GET /customers | merchantId query | ✅ |
| GET /crm/segments | merchantId query | ✅ |
| GET /crm/jobs | merchantId in params | ✅ |
| GET /product-tags | merchantId query | ✅ |
| GET /inventory/* | merchantId + warehouseId（warehouse→merchant FK） | ✅ |
| GET /purchase/reports/supplier-rankings | merchantId query | ✅ |

## 需補強／注意

- **PosOrder 依 storeId**：storeId 經 Store.merchantId FK 間接隔離；list 若未強制 storeId 可能回傳跨 merchant 資料 → **pos.listOrders 已要求 storeId 或依呼叫端傳入**；若未帶 storeId 則回全 store（需確認業務是否允許）。
- **Party view**：Finance 模組依 Party view（Customer/Supplier）解析 merchantId；Party 不存在時 fallback 至 prefix 解析，legacy partyId 可能無 merchant 綁定。
