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
| GET | `/suppliers/:id` | 單筆 |
| POST | `/suppliers` | 建立 |
| PATCH | `/suppliers/:id` | 更新 |
| DELETE | `/suppliers/:id` | 進行中採購／驗收可 409 |

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
| GET | `/purchase-orders/:id` | 含 lines、qtyOrdered、unitCost、qtyReceived |
| POST | `/purchase-orders` | **DRAFT** |
| PATCH | `/purchase-orders/:id` | **僅 DRAFT** |
| POST | `/purchase-orders/:id/submit` | **DRAFT → ORDERED** |
| POST | `/purchase-orders/:id/cancel` | → **CANCELLED**（僅 DRAFT 或依你方規則允許的狀態） |

**入庫唯一管道**：**POST /receiving-notes/:id/complete**（見 §3）。不提供與 UI 並行的第二套「採購單直接收貨」API。

---

## 3. ReceivingNote（進貨驗收 RN-*）

**狀態**：`PENDING` | `IN_PROGRESS` | `COMPLETED` | `RETURNED`。

**驗收人**：body **`inspectorName`**（字串，可選）；**無 inspectorUserId**。

| Method | Path | 說明 |
|--------|------|------|
| GET | `/receiving-notes?merchantId=&status=&q=` | 列表 + 搜尋 |
| GET | `/receiving-notes/:id` | 詳情 + lines |
| POST | `/receiving-notes` | purchaseOrderId, inspectorName?, remark?；PO 須 **ORDERED** 或 **PARTIALLY_RECEIVED**；展開明細 |
| PATCH | `/receiving-notes/:id/lines` | 實收／合格／退回／原因 |
| POST | `/receiving-notes/:id/complete` | **僅對本單每列增量合格數**（或本單填寫之 qualifiedQty 與上次 complete 差額—實作擇一，建議：每張 RN 只 complete 一次，qualifiedQty 即本次入庫量）呼叫 **PURCHASE_IN**；**退回不進庫**；回寫 PO Line **qtyReceived**、PO 狀態 |
| POST | `/receiving-notes/:id/reject` | **RETURNED** |

**complete 建議語意（與 UI 一致）**：該張驗收單每列 **qualifiedQty** = 本次驗收認可入庫量 → 對該數量 **PURCHASE_IN**；**returnedQty** 僅紀錄與顯示，不產生入庫事件。

**可驗收採購單**：`GET /purchase-orders?merchantId=&status=ORDERED` 與 `PARTIALLY_RECEIVED`（前端下拉合併請求或後端單一 query）。

---

## 4. 錯誤碼

| code | 說明 |
|------|------|
| SUPPLIER_NOT_FOUND | — |
| PO_NOT_FOUND | — |
| PO_INVALID_STATUS | 不可建立驗收等 |
| RN_NOT_EDITABLE | — |
| RN_COMPLETE_INVALID | 合格數大於實收等 |
| PO_LINE_NOT_FOUND | — |

---

## 5. Phase 2（應付與入庫對齊）

| 項目 | 約定 |
|------|------|
| **寫入時機** | **POST /receiving-notes/:id/complete** 成功後（與本筆 **PURCHASE_IN**、PO Line **qtyReceived** 更新同一輪流程內緊接執行）。 |
| **金額** | **Σ（該張 RN 每一列的 qualifiedQty × 對應 PurchaseOrderLine.unitCost）**；與實際入庫合格數一致。 |
| **partyId** | 該採購單之 **supplierId**（供應商 UUID）。 |
| **referenceId** | **receivingNoteId**（驗收單 UUID）。 |
| **currency** | 與金流模組慣例一致（例如 **TWD**）。 |
| **note** | 可含驗收單號 **receiptNumber**，利於對帳。 |

若該次 complete 所有列 **qualifiedQty 均為 0**，可不寫 **PURCHASE_PAYABLE**（金額 0 無意義）。

### 5.1 草案（未實作）— 退回供應商

| 項目 | 草案 |
|------|------|
| **庫存** | **RETURN_TO_SUPPLIER**（`recordInventoryEvent`），數量 = 實際退倉數；與驗收 **returnedQty** 可對帳但不強制同一 API。 |
| **金流** | **PURCHASE_RETURN** 或沖 **PURCHASE_PAYABLE**（依會計政策擇一，後續拍板）。 |
| **API** | 可選 **POST /purchase-orders/:id/return** 或 **POST /receiving-notes/:id/return-to-supplier**；body 含 lineId + qty。 |
