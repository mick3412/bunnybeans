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

## §4 Coupons（B6）

- **GET** `/loyalty/coupons?merchantId=` → `{ items: [{ id, code, name, discountType, value, validFrom, validTo, maxUses, usedCount, active }] }`
- **POST** `/loyalty/coupons?merchantId=` + body `{ code, name, discountType, value, validFrom?, validTo?, maxUses?, active? }`（**Admin**）
- **PATCH** `/loyalty/coupons/:id?merchantId=` + body partial（**Admin**）
- `discountType`：例 `FIXED` | `PERCENT`（POS 折抵邏輯可後續接）

## §5 結帳贈點與促銷次數（後端行為）

- POS **createOrder** 成功且帶 **customerId**（或可解析客戶）時，依 **earnPerNT** 寫入 **EARNED**（`referenceId` = 訂單 id）
- 訂單套用促銷且 **discount &gt; 0** 之規則，**PromotionRule.usageCount** +1

## §6 客戶列表擴充（B3）

- **GET** `/customers?merchantId=` 另含：`memberCode`, `joinDate`, `pointBalance`, `expiringSoon`, `expiringAt`（效期欄位目前可為 false/null，預留 UI）
