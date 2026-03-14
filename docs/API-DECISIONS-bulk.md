# 批量 API — 已採用決策與可改選項

## §7 訂單 export 含明細

| 已採用 | 說明 |
|--------|------|
| **Query** | `includeLines=1`（或 `true`） |
| **列意義** | 每 **一筆明細列** 一列 CSV；訂單欄位在每列重複 |
| **上限** | 最多 **10_000 明細列**（非訂單筆數） |
| **欄位** | 原訂單 8 欄 + `lineItemId`,`lineProductId`,`lineQuantity`,`lineUnitPrice`,`lineAmount` |

**可改選項（未做）**

- A：改為「每訂單一列、明細 JSON 塞單欄」→ 較不利 Excel 透視  
- B：加 `includePayments=1` 另支 export  

---

## §6 客戶 CSV import

| 已採用 | 說明 |
|--------|------|
| **同步一鍵** | **`POST /customers/import`**：同一 **merchantId** 下 **phone 已存在 → 該列 failed**（不覆寫） |
| **互動 preview / apply** | **`POST /customers/import/preview`** + **`POST /customers/import/apply`** |
| **同檔驗證** | **apply 必傳 `fileHash`（sha256）**；與上傳檔不一致 → 拒絕（防 preview 後換檔） |
| **同 CSV 內同 phone** | **兩列（或多列）各自進 conflict**（不併成單一 conflict）；每列可個別 skip / create（同 phone 僅一筆 create）/ overwrite（僅 DB 已存在時） |
| **必填** | Query **`merchantId`**；表頭 **`name`** |
| **選填欄** | `phone`,`memberLevel`,`code` |
| **空 phone** | 允許多筆（僅非空 phone 做唯一／CSV 內重複檢查） |

**可改選項（之後若要改行為再拍板）**

1. 同步 import 改為 **重複 phone → update**  
2. **全 merchant 唯一 phone**（目前未做）  

---

## §5 非同步大檔 import

| 已採用 | 說明 |
|--------|------|
| **建立** | `POST /imports/jobs/:kind` + multipart **`file`**；`kind` = `products_csv` \| `inventory_csv` |
| **回傳** | `{ jobId }`（**202** 可選；目前 **200**） |
| **查詢** | `GET /imports/jobs/:id` → `status` pending→running→done\|failed；`result` 同同步 `{ ok, failed }` |
| **failed** | 匯入拋錯（例：未預期例外）時 **`status: failed`**；**`result` 為 null**；**`error`** 為字串（`Error.message`）。成功時才有 **`result`**。 |
| **執行** | 同 process **`setImmediate`**；**多 pod 時每實例各自佇列**（無中央 worker） |
| **同步上限** | 未改；仍可用原 **POST /products/import**、**POST /inventory/import**（≤1 萬列） |

**可改選項（之後）**

- **Redis / SQS worker**：多 instance 共用佇列  
- **超過 N 列強制 async**：目前由客戶端選同步或 job  
- **job 保留天數**：目前未自動刪除（可定時清 `BulkImportJob`）  
- **Rate limit**：**POST /imports/jobs** 目前**未實作**（無 429）；建議單一使用者 **≤10 job／分** 或於 API Gateway 節流；實作時建議 **`IMPORT_JOB_RATE_LIMIT`** + **429**。  

---

## 部署

- Migration：**`20260315180000_bulk_import_job`**（`BulkImportJob` 表）
