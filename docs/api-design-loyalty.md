# Loyalty CRM API（契約）

> 與 [crm-loyalty-ui-plan.md](crm-loyalty-ui-plan.md) 對齊；Admin 寫入須 **X-Admin-Key**。錯誤碼見 [backend-error-format.md](backend-error-format.md)。

## §1 Settings

- **GET** `/loyalty/settings?merchantId=` → `{ merchantId, earnPerNT, pointValueNT, birthdayMultiplier, rollingDays, notifyDaysBefore }`（無則建立預設）
- **PATCH** `/loyalty/settings?merchantId=` + body partial → 同上

## §2 Point ledger

- **GET** `/loyalty/point-ledger?merchantId=&customerId=&limit=`（別名 **GET** `/loyalty/ledger?...`）→ `{ items: [{ id, type, amount, balanceAfter, txnCode, referenceId, note, createdAt }] }`
- 類型：`EARNED` | `BURNED` | `LOCKED` | `EXPIRED`

## §3 Dashboard

- **GET** `/loyalty/dashboard?merchantId=` → 至少：`pointsIssued30d`, `pointsRedeemed30d`, `activeMembersWithPoints`  
- **擴充（與範本對齊）**：`circulatingPointsTotal`, `newMembersThisMonth`, `totalPointsBurnedLifetime`, `ongoingPromotionsCount`, `recentLedger[]`, `activePromotions[]`

## §3.1 活動成效報表（v2）

- **GET** `/loyalty/reports/activity?merchantId=&from=&to=&preset=&groupBy=`  
- **用途**：彙總區間內的活動參與（發券任務）、用券、點數成本估算，供前端做活動成效看板。
- **回應**：至少包含
  - `participations`：區間內已完成的行銷 job 次數（`CrmMarketingJob.status=done`）
  - `couponUsage`：區間內發券張數（`LoyaltyCouponIssue`）
  - `pointsCostEstimate`：區間內贈點成本估算（EARNED 點數 * pointValueNT）
  - `avgCouponUsagePerParticipation`：\(couponUsage / participations\)（participations=0 時為 0）
  - `avgPointsCostPerParticipation`：\(pointsCostEstimate / participations\)（participations=0 時為 0）
  - （選配）`byDispatchRule`、`byCoupon`、`revenueFromPointRedemption`

## §4 Coupons（B6）

- **GET** `/loyalty/coupons?merchantId=` → `{ items: [{ id, code, name, discountType, value, validFrom, validTo, maxUses, usedCount, active }] }`
- **POST** `/loyalty/coupons?merchantId=` + body `{ code, name, discountType, value, validFrom?, validTo?, maxUses?, active? }`（**Admin**）
- **PATCH** `/loyalty/coupons/:id?merchantId=` + body partial（**Admin**）
- `discountType`：例 `FIXED` | `PERCENT`（POS 折抵邏輯可後續接）
- **usedCount** 更新時機：POS 核銷後置（優惠券於 POS 結帳折抵成功後，後端再更新該筆 coupon 的 usedCount）。

## §5 結帳贈點與促銷次數（後端行為）

- POS **createOrder** 成功且帶 **customerId**（或可解析客戶）時，依 **earnPerNT** 寫入 **EARNED**（`referenceId` = 訂單 id）
- 訂單套用促銷且 **discount &gt; 0** 之規則，**PromotionRule.usageCount** +1
- **加倍點數（B11）**：若套用之促銷規則 actions 含 `POINTS_MULTIPLIER`（例如 2x），則該筆訂單贈點以倍率計算（`points = floor(floor(totalAmount/earnPerNT) * multiplier)`）；倍率預設 1，若多條規則同時套用則取最大倍率。
- **createOrder** body 可帶 **pointsToRedeem**（正整數）：有客戶時扣點並寫入 **PointLedger BURNED**（`referenceId` = 訂單 id）；餘額不足回 **400 LOYALTY_INSUFFICIENT_POINTS**

## §6 客戶列表擴充（B3）

- **GET** `/customers?merchantId=` 另含：`memberCode`, `joinDate`, `pointBalance`, `expiringSoon`, `expiringAt`（效期欄位：依 **LoyaltySettings.rollingDays** 與 PointLedger 計算；見 [member-management-review.md](member-management-review.md)）

## §7 會員單筆 CRUD（後台用）

- **POST** `/customers` + body `{ merchantId, name, phone?, email?, memberLevel?, code?, memberCode? }`（**Admin**，X-Admin-Key）→ 回傳建立之 customer（含 id）。
- **GET** `/customers/:id`（**Admin** 或同 merchant 唯讀）→ 單筆詳情（含 pointBalance、expiringSoon、expiringAt）。
- **PATCH** `/customers/:id` + body partial（**Admin**）→ 可更新 name、phone、email、memberLevel、code、memberCode、joinDate；不可改 merchantId。

## §8 會員搜尋（POS 快速選客）

- **GET** `/customers/search?merchantId=&q=` → 模糊搜尋 **phone**／**name**／**memberCode**；回傳 `{ items: [{ id, name, phone, memberLevel, memberCode }] }`，最多 20 筆。`q` 空白回傳空陣列。

## 報表穿透（referenceId 跨模組連結）

- **PointLedger.referenceId**：EARNED／BURNED 之 referenceId = **PosOrder.id**；前端可依此跳至 `GET /pos/orders/:id` 訂單明細。
- **GET /loyalty/point-ledger** 回傳 `referenceId`，活動成效報表可從 Loyalty 穿透回 POS 訂單。
- 反之，從 POS 訂單 id 可打 `GET /finance/events?referenceId={orderId}` 查金流、`GET /loyalty/point-ledger?customerId=...` 以客戶 filter 查該單相關點數異動（referenceId 比對）。

> **統一規則（stable）**：PointLedger.referenceId **僅**使用 **PosOrder.id（UUID）**。

> **來源保證（stable）**：`GET /loyalty/point-ledger` 回傳的 `items[].referenceId` 若非 null，必為 `PosOrder.id`（UUID）。

## §9 單一商家（選配）

- **GET** `/merchant/current` → 回傳**單一** Merchant（`{ id, code, name }`）。供前端「單一商家、不顯示選單」情境。
- **邏輯**：優先讀 env **DEFAULT_MERCHANT_ID**，有值則回傳該 id 之 Merchant（不存在則 404）；未設定時以 DB **唯一一筆** Merchant 回傳；若 DB 為 0 筆或大於 1 筆則 **404**（無預設）或 **400**（多筆無法決定）。
- 錯誤碼可為 `MERCHANT_NOT_FOUND`、`MERCHANT_AMBIGUOUS`（多筆時）。
