# 促銷規則 API（Admin + POS 預覽）

## 認證

- `GET`：公開（與 categories 相同）
- `POST` / `PATCH` / `DELETE`：若設定 `ADMIN_API_KEY`，須 `X-Admin-Key`

## PromotionRule 欄位

| 欄位 | 說明 |
|------|------|
| merchantId | 商家 |
| name | 名稱 |
| priority | 數字越小越先評估 |
| draft | true 不套用、僅後台草稿 |
| startsAt / endsAt | 可 null；非草稿時在時間窗內才套用 |
| exclusive | 套用後不再疊加後續規則 |
| firstPurchaseOnly | 僅首購（該客戶尚無訂單） |
| memberLevels | string[]；空＝不限；有值則客戶 memberLevel 須命中其一 |
| conditions | 見下 |
| actions | 見下 |

### conditions[]

- `SPEND`：`{ type, op, value }` — 購物車小計（折前）與 value 比較
- `QTY`：`{ type, op, value }` — 總件數
- `TAG_COMBO`：`{ type, op, value, tags[] }` — 帶任一所列標籤之商品金額合計

`op`: `>=` `>` `=` `<=` `<`

### actions[]

- `WHOLE_PERCENT`：
  - **僅單一折扣**：只設 `discountPercent`（例如 10 代表全單減收 10%，即約 9 折）。
  - **階梯**（選用）：設 `tiers: [{ threshold, discountPercent }, ...]`  
    - **`threshold`**：購物車**折前小計**（與 POS 試算相同口徑）須 **≥** 此金額，該列才算「達標」。  
    - **`discountPercent`**：達標時，**全單**套用此**減收百分比**（與上方單一 `discountPercent` 同義，為扣掉售價的 %）。  
    - **多列時**：後端將門檻**由高到低**排序，從最高門檻開始比對，**只套用第一個達標的那一列**（滿額愈高、折數可愈大）。  
    - **小計未達任一門檻**：折讓為 0（若需「無門檻也有折」，請加一列 `threshold: 0`）。  
    - 有任一階梯列時，**不再**使用頂層的 `discountPercent`（以階梯為準）。
- `WHOLE_FIXED`：`fixedOff`
- `LINE_PERCENT`：`discountPercent`, `selectionRule`: LOWEST_PRICE | HIGHEST_PRICE | ALL, `targetTags?`
- `GIFT_OR_UPSELL`：`productName`, `upsellAmount`（0＝贈品敘述，不折現）

## Endpoints

### GET /promotion-rules?merchantId=&status=&q=

- status: `all` | `draft` | `scheduled` | `active` | `ended`
- q: 名稱搜尋

### GET /promotion-rules/:id

### POST /promotion-rules

Body: `merchantId`, `name`, 其餘選填。

### PATCH /promotion-rules/:id

Body: `merchantId`（必填，與所屬商家比對）+ 欲更新欄位。

### DELETE /promotion-rules/:id?merchantId=

### PATCH /promotion-rules/reorder/bulk

Body: `{ merchantId, ids: string[] }` — 依陣列順序重寫 priority 1..n

## POS 預覽

### POST /pos/promotions/preview

Body:

```json
{
  "storeId": "uuid",
  "customerId": null,
  "items": [{ "productId": "uuid", "quantity": 1, "unitPrice": 100 }]
}
```

Response: `subtotal`（折前小計）、`discount`（促銷折讓合計）、`total`（**折後應收**＝subtotal − discount）、`applied[]`、`messages[]`（與引擎 `previewLines` 對齊）。

建單 **`POST /pos/orders`**：`totalAmount` **必須**與本接口之 **`total`** 一致（後端重算驗證）；**`sum(payments)`**（非賒帳）**須等於該 `total`**。見 [api-design-pos.md](api-design-pos.md) §1.1。

## 錯誤碼

| code | 說明 |
|------|------|
| PROMOTION_NOT_FOUND | 規則不存在或 merchant 不符 |
| PROMOTION_BODY_INVALID | 缺少 merchantId / name |
| PROMOTION_REORDER_EMPTY | ids 空 |
