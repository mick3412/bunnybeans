# 前後端整合進度報告與開發計畫 2026-03-13

> 整合自 `docs/progress/backend/backend-progress-2026-03-13.md` 與 `docs/progress/frontend/frontend-progress-pos-2026-03-13.md`。  
> **最後彙整**：2026-03-13（後端：Brand／Tag、`GET /brands`、賒帳 `allowCredit` + `SALE_PAYMENT`、明細 `paidAmount`／`remainingAmount`／`credit`）

---

## 零、同步摘要（一眼表）

| 主題 | 後端 | 前端 | 狀態 |
|------|------|------|------|
| payments / 明細 | `PosOrderPayment`、`payments[]` | 實收／收款方式 | **已對齊** |
| 品項／分類 | `GET /categories`、`GET /products?categoryId=` | 已接 API | **已對齊** |
| **品牌／標籤** | `Brand`、`GET /brands`、`GET /products?brandId=&tag=`，商品含 `brandId`、`tags` | 第二列仍 mock | **待前端接** |
| **賒帳** | `allowCredit: true` + `customerId`；`sum(payments) ≤ totalAmount`；`SALE_RECEIVABLE` + `SALE_PAYMENT`；明細 `paidAmount`、`remainingAmount`、`credit` | 結帳仍全額付清；無 `customerId` 送單 | **待前端接** |
| 錯誤碼 | 含 `POS_CREDIT_REQUIRES_CUSTOMER`、`POS_PAYMENT_EXCEEDS_TOTAL`、`POS_PAYMENT_AMOUNT_INVALID` 等 | `ERROR_CODE_MAP` 待補上列 | **待前端補** |
| 訂單列表／分頁 | `storeId`／`from`／`to` | 已接 | **已對齊** |
| 補款 API | 後端 To Do：對既有賒帳單再收一筆 | — | **未做** |

---

## 一、後端現況（摘要）

- POS、Inventory、Finance、主檔、Seed、業務錯誤碼、整合測試（含賒帳／payments）。
- **BrandModule**：`GET /brands`；Product 帶 `brandId`、`tags`；`GET /products` 支援 `brandId`、`tag`。
- **賒帳建單**：`POST /pos/orders` body 可選 `allowCredit: true`（須 `customerId`）；`payments` 可為多筆、總和 ≤ 應收；金流寫 `SALE_PAYMENT`。
- **明細**：`paidAmount`、`remainingAmount`、`credit`；詳見 `docs/api-design-pos.md`。

---

## 二、前端現況（摘要）

- 收銀、結帳（全額）、訂單列表／篩選／分頁、明細（payments）；品項列接 categories。
- **尚未依新合約**：賒帳送單、`GET /brands` 品牌列、`GET /products?brandId=`、明細顯示未收餘額／掛帳標記、新錯誤碼 mapping。

---

## 三、下一步開發計畫（建議順序）

1. **前端 P0**：依 `api-design-pos.md` 結帳送 `allowCredit` + `customerId` + `payments`（實收可 &lt; 應收）；訂單明細顯示 `paidAmount`／`remainingAmount`／`credit`；`ERROR_CODE_MAP` 補賒帳相關 code。
2. **前端 P1**：`GET /brands` 填品牌列；選品牌後 `GET /products?brandId=`（與 category 可並存或依文件）。
3. **後端（可並行）**：補款／沖帳 API（對既有賒帳單）；可選 E2E。
4. **折扣列**：仍 mock，直至有 API 或沿用 `tag` 篩選。

---

## 四、後端任務清單（剩餘）

- [ ] 補款 API（對既有賒帳單再收一筆）；文件 + 實作。
- [ ] （可選）全端 E2E；Inventory/Finance 邊界測試。

---

## 五、前端任務清單（剩餘）

- [ ] 賒帳結帳：`allowCredit`、`customerId`、多筆／部分 `payments`。
- [ ] 明細：`paidAmount`、`remainingAmount`、`credit` 顯示。
- [ ] `GET /brands` + 品牌篩選 + `GET /products?brandId=`。
- [ ] `ERROR_CODE_MAP`：`POS_CREDIT_REQUIRES_CUSTOMER`、`POS_PAYMENT_EXCEEDS_TOTAL`、`POS_PAYMENT_AMOUNT_INVALID`。
- [ ] （可選）E2E；折扣／tag 篩選（若產品需）。

---

## 六、本日變更紀錄（僅追加）

- 彙整：後端 Brand／賒帳／SALE_PAYMENT 已實作；整合表與任務清單更新；`AGENT-DEV-INSTRUCTIONS.md` 已對齊新任務。

---

## 七、參考文件

- **[後端／前端開發指令](../AGENT-DEV-INSTRUCTIONS.md)**（複製貼上）
- `docs/api-design-pos.md`、`docs/api-design.md` §6（brands/products）
- `docs/backend-error-format.md`
- `docs/progress/backend/backend-progress-2026-03-13.md`
- `docs/progress/frontend/frontend-progress-pos-2026-03-13.md`
