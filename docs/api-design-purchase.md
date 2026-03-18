# API 設計 — 採購／供應商／進貨驗收（對齊 UI）

## 產品決策（固定）

| 項目 | 約定 |
|------|------|
| **入庫** | **只對「合格數 `qualifiedQty`」入庫**；**退回數不進庫**（不寫 PURCHASE_IN）。完成驗收時每列呼叫 **PURCHASE_IN** 的量 = 該列 **qualifiedQty**（與該次驗收增量一致，見 §3）。 |
| **採購單流程** | **無「已核准」步驟**（無組織／權限層級）；**草稿 → 已下單** 單一動作即可。 |
| **驗收人員** | 僅 **字串 `inspectorName`** 紀錄顯示；**不綁定** User／員工表。 |
| **無 DB** | 交付 schema + migration + 程式；整合測試待 **DATABASE_URL**。 |
| **無 ADMIN KEY** | 採購／驗收路由可不掛 Guard（Demo）；上線再統一。 |

---

## 1. Supplier（供應商管理）

**列表**：code、name、contactPerson、phone、paymentTerms、status `ACTIVE` | `INACTIVE`。  
**表單**：email、address、taxId、bankAccount、note。

| Method | Path | 說明 |
|--------|------|------|
| GET | `/suppliers?merchantId=&q=` | 列表；`q` 模糊 **code／name／contactPerson** |
| GET | `/suppliers/:id` | 單筆（含績效指標 `kpis`，見下方 §1.1） |
| POST | `/suppliers` | 建立 |
| PATCH | `/suppliers/:id` | 更新 |
| DELETE | `/suppliers/:id` | 進行中採購／驗收可 409 |

### 1.1 供應商績效（P3）（stable）

`GET /suppliers/:id` 追加回傳 `kpis`：\n
- `deliveryLeadTimeDaysAvg?`：平均交貨天數（以 `ReceivingNote(COMPLETED).updatedAt - PurchaseOrder.orderDate` 計算；無資料為 null）\n
- `deliveryOnTimeThresholdDays`：固定為 3\n
- `deliveryOnTimeRate?`：準時率（\(leadTimeDays <= threshold\) 的比例；0~1；無資料為 null）\n
- `qualifiedQty`：累計合格入庫數（Σ ReceivingNoteLine.qualifiedQty；僅 COMPLETED）\n
- `returnedQty`：累計退貨數（Σ InventoryEvent(type=RETURN_TO_SUPPLIER).abs(quantity)；對應該 supplier 的 RN lines）\n
- `returnRate?`：退貨率（returnedQty / qualifiedQty；0~1；qualifiedQty=0 時為 null）\n

---

## 2. PurchaseOrder（採購單）

**狀態**（與 UI 篩選一致，**無已核准**）：

| API / DB | UI |
|----------|-----|
| `DRAFT` | 草稿 |
| `ORDERED` | 已下單 |
| `PARTIALLY_RECEIVED` | 部分到貨 |
| `RECEIVED` | 已收貨 |
| `CANCELLED` | 已取消 |

**轉換**：

- `DRAFT` → `ORDERED`：**POST …/submit**（寫入 **orderDate**）；`DRAFT` → `CANCELLED`：**POST …/cancel**。
- `ORDERED` / `PARTIALLY_RECEIVED`：可建立驗收單；驗收 **complete** 後依 PO Line **qtyReceived**（與合格入庫一致）更新為 **PARTIALLY_RECEIVED** 或 **RECEIVED**。

| Method | Path | 說明 |
|--------|------|------|
| GET | `/purchase-orders?merchantId=&status=&q=` | 列表；`q`：單號／供應商名 |
| GET | `/purchase-orders/:id` | 含 lines（qtyOrdered、qtyReceived）、**receivingProgress**（totalOrdered、totalReceived、percentComplete、fullyReceivedLinesCount） |
| POST | `/purchase-orders` | **DRAFT** |
| PATCH | `/purchase-orders/:id` | **僅 DRAFT** |
| POST | `/purchase-orders/:id/submit` | **DRAFT → ORDERED** |
| POST | `/purchase-orders/:id/cancel` | → **CANCELLED**（僅 DRAFT 或依你方規則允許的狀態） |
| POST | `/purchase-orders/from-replenishment` | 依補貨建議建立 **DRAFT** 採購單；body `{ supplierId, warehouseId, suggestions: [{ productId, suggestedQty }] }`；回應 `{ id, orderNumber }` |
| POST | `/purchase-orders/quick-receive` | **快速進貨**：一鍵建立 PO + RN + complete（同一流程內寫入 **PURCHASE_IN** + **PURCHASE_PAYABLE**）；詳見下方 §2.1 |

**補貨→PO 草稿**：`POST /purchase-orders/from-replenishment` 依 `GET /inventory/replenishment-suggestions` 勾選結果建立草稿 PO；lines 的 `qtyOrdered` = `suggestedQty`，`unitCost` 取自商品 `costPrice`（無則 0）。

**取消規則**：**DRAFT**、**ORDERED** 可呼叫 **POST …/cancel** 設為 **CANCELLED**；已開立驗收單（RN）者依產品需求決定（建議：已有 **COMPLETED** 驗收之 PO 不可取消，或僅允許取消未 complete 之 RN）。實作時見 `purchase-order.service` cancel 條件。

**入庫唯一管道**：**POST /receiving-notes/:id/complete**（見 §3）。不提供與 UI 並行的第二套「採購單直接收貨」API。

### 2.1 快速進貨（Quick Receive）（stable）

> 目的：支援「選供應商 → 選品項 → 輸入數量 → 一鍵完成」；後端會自動建立採購單與驗收單並完成入庫與應付。

- **POST `/purchase-orders/quick-receive`**
  - **Body**：
    - `merchantId`（必填）
    - `supplierId`（必填；供應商需為 ACTIVE）
    - `warehouseId`（必填）
    - `orderNumber`（必填；同商家唯一）
    - `inspectorName?`、`remark?`
    - `lines`（必填，至少 1 筆）：`[{ productId, qty, unitCost?, batchCode?, expiryDate?, weightUnit? }]`
      - `qty` 必須為 **正整數**
      - `unitCost` 未提供時，後端以 Product `costPrice`（無則 0）帶入
  - **行為**：
    - 建立 **PO（DRAFT）** → submit 成 **ORDERED**
    - 建立 **RN** → 寫入每列 `receivedQty=qty`、`qualifiedQty=qty` → **complete**
    - complete 時計入庫存事件 **PURCHASE_IN**（referenceId = RN line id），並寫金流 **PURCHASE_PAYABLE**（referenceId = receivingNoteId）
  - **Response**：回傳 **ReceivingNote 詳情**（同 `POST /receiving-notes/:id/complete` 回傳）
  - **錯誤碼**（建議）：數量非法 `RN_COMPLETE_INVALID`；商品不存在 `INVENTORY_PRODUCT_NOT_FOUND`；供應商不存在 `SUPPLIER_NOT_FOUND`；倉庫不存在 `INVENTORY_WAREHOUSE_NOT_FOUND`；單號衝突 `PO_ORDER_NUMBER_CONFLICT`

---

## 3. ReceivingNote（進貨驗收 RN-*）

**狀態**：`PENDING` | `IN_PROGRESS` | `COMPLETED` | `RETURNED`。

**驗收人**：body **`inspectorName`**（字串，可選）；**無 inspectorUserId**。

| Method | Path | 說明 |
|--------|------|------|
| GET | `/receiving-notes?merchantId=&status=&q=` | 列表 + 搜尋 |
| GET | `/receiving-notes/:id` | 詳情 + lines |
| POST | `/receiving-notes` | purchaseOrderId, inspectorName?, remark?；PO 須 **ORDERED** 或 **PARTIALLY_RECEIVED**；展開明細 |
| PATCH | `/receiving-notes/:id/lines` | 實收／合格／退回／原因；可選填 **batchCode**（批號）、**expiryDate**（效期）、重量單位等欄位 |
| POST | `/receiving-notes/:id/complete` | **僅對本單每列增量合格數**（或本單填寫之 qualifiedQty 與上次 complete 差額—實作擇一，建議：每張 RN 只 complete 一次，qualifiedQty 即本次入庫量）呼叫 **PURCHASE_IN**；**退回不進庫**；回寫 PO Line **qtyReceived**、PO 狀態；若該列有填寫 **batchCode／expiryDate** 則一併寫入對應的 `InventoryEvent` 以供效期查詢（`GET /inventory/expiring`） |
| POST | `/receiving-notes/:id/reject` | **RETURNED** |

**complete 建議語意（與 UI 一致）**：該張驗收單每列 **qualifiedQty** = 本次驗收認可入庫量 → 對該數量 **PURCHASE_IN**；**returnedQty** 僅紀錄與顯示，不產生入庫事件。  
飼料／生鮮等需控管效期之商品，可在 RN line 填寫 **batchCode** 與 **expiryDate**，complete 時計入 `InventoryEvent` 上對應欄位，後續由 `/inventory/expiring` 聚合成「即將到期批次」清單。

**可驗收採購單**：`GET /purchase-orders?merchantId=&status=ORDERED` 與 `PARTIALLY_RECEIVED`（前端下拉合併請求或後端單一 query）。

---

## 4. 錯誤碼

| code | 說明 |
|------|------|
| SUPPLIER_NOT_FOUND | — |
| PO_NOT_FOUND | — |
| PO_INVALID_STATUS | 不可建立驗收等 |
| RN_NOT_EDITABLE | — |
| RN_COMPLETE_INVALID | 合格數大於實收等；或 return-to-supplier 單列 quantity 超過該列（qualifiedQty − 已退數量） |
| PO_LINE_NOT_FOUND | — |

---

## 5. Phase 2（應付與入庫對齊）

| 項目 | 約定 |
|------|------|
| **寫入時機** | **POST /receiving-notes/:id/complete** 成功後（與本筆 **PURCHASE_IN**、PO Line **qtyReceived** 更新同一輪流程內緊接執行）。 |
| **金額** | **Σ（該張 RN 每一列的 qualifiedQty × 對應 PurchaseOrderLine.unitCost）**；與實際入庫合格數一致。 |
| **partyId** | 該採購單之 **supplier:{supplierId}**（供應商 Party key）。 |
| **referenceId** | **receivingNoteId**（驗收單 UUID）。 |
| **currency** | 與金流模組慣例一致（例如 **TWD**）。 |
| **note** | 可含驗收單號 **receiptNumber**，利於對帳。 |

若該次 complete 所有列 **qualifiedQty 均為 0**，可不寫 **PURCHASE_PAYABLE**（金額 0 無意義）。

### 5.1 已採用 — 退回供應商

| 項目 | 約定 |
|------|------|
| **庫存** | **POST /receiving-notes/:id/return-to-supplier** 成功後，依 body 每列呼叫 **RETURN_TO_SUPPLIER**（`recordInventoryEvent`），數量 = 該列 **quantity**（出庫）；**referenceId** = 該筆 **ReceivingNoteLine** id。每列累計退倉數不得超過該列 **qualifiedQty**。 |
| **金流** | 同一 API 內寫一筆 **PURCHASE_RETURN**（`recordFinanceEvent`）：**partyId** = 該 RN 之 **supplier:{supplierId}**，**amount** = Σ（每列 quantity × 對應 PurchaseOrderLine.unitCost），**referenceId** = **receivingNoteId**，**note** 含 RN 單號。 |
| **API** | **POST /receiving-notes/:id/return-to-supplier**，body `{ lines: [{ receivingNoteLineId, quantity }] }`。僅 **COMPLETED** 之 RN 可呼叫。 |
