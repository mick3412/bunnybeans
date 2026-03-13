## 今日進度快照（2026-03-13）

| 項目 | 內容 |
|------|------|
| **今日完成** | 賒帳結帳（`allowCredit`、`customerId`、實收 ≤ 應收／部分或全賒）；`CreatePosOrderRequest`／`PosOrderDetail` 對齊 api-design-pos（`paidAmount`、`remainingAmount`、`credit`）；明細頁顯示實收合計、未收餘額、掛帳標籤；**GET /brands** + 品牌列單選 + **GET /products?brandId=**（與 categoryId 並用）；ERROR_CODE_MAP 補 `POS_CREDIT_REQUIRES_CUSTOMER`、`POS_PAYMENT_EXCEEDS_TOTAL`、`POS_PAYMENT_AMOUNT_INVALID`。 |
| **卡點** | 無。 |
| **To Do** | 可選 E2E；折扣列改接 `tag` API；補款 API 若後端提供再接。 |

---

## 目前完成的前端工作（摘要）

- 路由：`/login`、`/pos`、`/pos/orders`、`/pos/orders/:id`。
- API：health、stores、**brands**、products（**categoryId、brandId**）、categories、pos/orders（**allowCredit**、部分 payments）。
- **結帳**：全額或掛帳；掛帳必填客戶 ID；錯誤碼含賒帳三碼。
- **訂單明細**：`paidAmount`／`remainingAmount`／`credit` + 收款方式列。
- **POS 品項／品牌**：後端分類 + 品牌 API 載入商品。

## 需要後端配合的事項

- **已滿足**：賒帳建單、brands、products brandId、錯誤碼表。
- **可選**：補款／沖帳 API。

## 前端下一步 TODO

- 可選 E2E；折扣列接 `GET /products?tag=`。

## 本日變更紀錄 （僅追加）

- 09:50 更新：（略，見歷史）
- 14:26 更新：（略，見歷史）
- **執行彙整**：（略）
- **整合更新**：後端已上 Brand + 賒帳；前端 To Do 改為接 allowCredit／brands／明細 paidRemaining／新 error code。
- **15:03 更新**：賒帳結帳 Modal（allowCredit、customerId、payments 加總 ≤ 應收）；PosOrderDetail 與明細 UI（paidAmount、remainingAmount、credit）；getBrands + 品牌篩選 + getProducts brandId；ERROR_CODE_MAP 三碼；ProductDto brandId/tags。
