# 後端開發紀錄（僅追加）

規格 Agent 收斂時讀本檔**最新條目**。後端 Agent **每輪完成後**在下方追加，**勿刪改**上方舊文。**新條目標題必含實際寫入當下之 `HH:MM`**（與 [daily-progress-format.md](../daily-progress-format.md) 一致）。

格式：

```markdown
### YYYY-MM-DD HH:MM（本輪摘要一句）
- 做了：…
- PR／檔案（可選）：…
```

---

### 初始化

- 本檔建立：協作流程改為 agent-log；之後每輪後端完成必追加。

### 2026-03-14 14:12（本輪：P4 A1／A2 批量 CSV）
- 做了：**GET /inventory/balances/export**（warehouseId、與 events/export 同約定）；**GET /finance/events/export**（query 同 list、preset=last30d）；api-design-inventory-finance、bulk-import-export-plan、TASK-backend-agent-plan-integrated 對齊；jest 32 綠。
- 檔案（可選）：`inventory.service.ts`／`inventory.controller.ts`、`finance.service.ts`／`finance.repository.ts`／`finance.controller.ts`、`*integration-spec.ts`、`docs/api-design-inventory-finance.md`。

### 2026-03-14 14:45（P4 A3：POS 訂單 CSV）
- 做了：**GET /pos/orders/export**（storeId／from／to 選填、訂單層級 8 欄、1 萬列、BOM、Admin Key）；api-design-pos §4.0b、bulk Phase A3 標已做；**jest 33** 綠。
- 檔案：`pos.repository.ts` `findManyForExport`、`pos.service.ts` `exportOrdersCsv`、`pos.controller.ts`、`api-design-pos.md`、`BACKEND-INSTRUCTIONS.md`。

### 2026-03-14 15:22（POST /products/import CSV）
- 做了：**POST /products/import**（multipart **`file`**、Admin Key、最多 1 萬列、**{ ok, failed[] }**、sku upsert、categoryCode／brandCode 列級失敗）；**api-design.md** §6.4；**jest 34** 綠。
- 檔案：`product.controller.ts`、`product.service.ts`、`product.repository.ts` `findBySku`、`csv-import.util.ts`、`product.integration-spec.ts`、`product.module.ts`（import DatabaseModule）。

### 2026-03-14 15:46（驗收：§2 BACKEND-INSTRUCTIONS）
- 做了：`pnpm --filter pos-erp-backend test` 全綠 **34 passed**；§2 三項勾選；import 以整合測試 + 可選 curl 複驗。

### 2026-03-14 17:20（Phase C：POST /inventory/events/import）
- 做了：**POST /inventory/events/import**（multipart **file**、**sku** + **warehouseCode|warehouseId** + **quantityDelta**、逐列 **recordInventoryEvent** STOCKTAKE_GAIN／LOSS、**{ ok, failed, referenceId }**、1 萬列、Admin Key）；api-design-inventory-finance §4.1b、bulk Phase C1；**jest 35** 綠。
- 檔案：`inventory.service.ts` `importEventsFromCsvBuffer`、`inventory-csv-import.util.ts`、`inventory.controller.ts` `Post('events/import')`、`inventory.integration-spec.ts`。

### 2026-03-14 17:58（BACKEND-INSTRUCTIONS 本輪執行：P0+P1 迴歸）
- 做了：**jest 35 passed**（product.import、inventory.import、`exportFinanceEventsCsv`、`exportBalancesCsv`、`exportOrdersCsv` 均在同一輪 CI 內）；**e2e.yml** `needs: backend-test` 已核；**deploy-preview** 仍為 migrate deploy + seed + 單一 :3003；選配 Phase D 未做。
- 檔案：無新增程式；驗收見 **BACKEND-INSTRUCTIONS §2**。

### 2026-03-14 18:30（§7→§6→§5：明細 export + 客戶 import + async job）
- 做了：**GET /pos/orders/export?includeLines=1**（1 萬明細列）；**POST /customers/import**（merchantId、重複 phone → failed）；**POST /imports/jobs/:kind** + **GET /imports/jobs/:id**（products_csv／inventory_csv、BulkImportJob）；migration **20260315180000**；**jest 38**；**API-DECISIONS-bulk.md**。
- 檔案：`pos.repository.ts` `findLineRowsForExport`、`pos.service.ts`、`customer/*`、`imports/*`、`app.module.ts`、`schema.prisma`、api-design／deploy-preview。

### 2026-03-13 19:05（客戶 import preview／apply + fileHash）
- 做了：**POST /customers/import/preview**（不寫入、**fileHash**、同 CSV 同 phone **每列各自 conflict**）；**POST /customers/import/apply**（**必傳 fileHash** 與同檔、**decisions** JSON）；api-design §6.5a／6.5b、API-DECISIONS-bulk §6；customer.integration-spec 5 則綠。
- 檔案：`customer.service.ts`、`customer.controller.ts`、`customer.integration-spec.ts`、`docs/api-design.md`、`docs/API-DECISIONS-bulk.md`。

### 2026-03-13 20:15（客戶 import — 前端待辦需求，後端已就緒）
- **交前端 Agent**：互動匯入流程 **preview → apply**（非僅單次 **POST /customers/import**）。選檔後 **POST …/preview**；依 `rows[].conflict`／`reasons`／`existing` 引導；**同一 File 物件保留至 apply**；apply 時 multipart 再傳同檔 + body **`fileHash`**（與 preview 回傳一致）+ **`decisions`** JSON（每筆 `preview.rows` 對應列號必有一筆）。UI：**衝突逐筆決策**（skip／create／overwrite+`customerId`）、**Skip Rest**、結束可 **下載跳過列 CSV**（前端組檔即可）。合約：**api-design.md** §6.5a／§6.5b；決策：**API-DECISIONS-bulk.md** §6。可同步寫入 **agent-log-frontend.md**、**FRONTEND-INSTRUCTIONS.md** 選配。

### 2026-03-15 21:40（BACKEND-INSTRUCTIONS 本輪：選配 + 驗收）
- 做了：**jest 44 passed**（客戶 apply 邊界：**decisions 缺列**、**同 CSV 同 phone 雙 create**）；**API-DECISIONS-bulk §5** + **api-design §6.6** 補 **job `failed`**（`result` null、`error` 字串）；**e2e.yml** `needs: backend-test` 未改動仍有效。**P0 migrate deploy** 須於 Preview／正式（`DATABASE_URL`）執行，見 **deploy-preview.md**（本機無 DB 時未跑 deploy）。
- 檔案：`customer.integration-spec.ts`、`API-DECISIONS-bulk.md`、`api-design.md`、**BACKEND-INSTRUCTIONS §2** 驗收勾選。

### 2026-03-16 10:05（BACKEND-INSTRUCTIONS §1 再跑一輪）
- 做了：**jest 44 passed**；**e2e.yml** 核對 **playwright `needs: backend-test`** 仍成立。**P0 migrate deploy**：Agent shell 無 **DATABASE_URL**，未代跑；Preview／正式請本機／CI 含 DB 時執行 **deploy-preview** 順序。**選配**：**api-design §6.6** 補前端可顯示 **`error`**；**POST /imports/jobs** **rate limit 未實作**一句。
- 檔案：`api-design.md`、**BACKEND-INSTRUCTIONS §2**。

### 2026-03-16 14:30（採購 Phase1：Supplier + PO + ReceivingNote）
- 做了：**Prisma** Supplier／PurchaseOrder／PurchaseOrderLine／ReceivingNote／ReceivingNoteLine + enum；**migration** `20260316120000_purchase_supplier_po_receiving`。**API**：**GET/POST/PATCH/DELETE /suppliers**（q）；**GET/POST/PATCH /purchase-orders**、submit／cancel；**GET/POST/PATCH lines /complete /reject /receiving-notes**；**complete** 僅 **qualifiedQty** → **PURCHASE_IN** + 累加 PO Line **qtyReceived**；**backend-error-format** PO_*/RN_*。**PurchaseModule** 註冊 **AppModule**；**tsc** 綠。有 DB 須 **migrate deploy**。
- 檔案：`prisma/schema.prisma`、`prisma/migrations/20260316120000_*`、`purchase/*`、`app.module.ts`、`backend-error-format.md`。

### 2026-03-12 22:10（完整 wipe SEED + 會員 dummy）
- 做了：**seed.ts** 開頭 **wipeAll**（依 FK 序 deleteMany）後單一劇本重建。**會員／客戶 6 筆**：E2E 固定 id、VIP／GOLD／NORMAL、無電話訪客。**供應商 4**（1 INACTIVE）。**採購**：DRAFT／CANCELLED／ORDERED／PARTIAL／RECEIVED + **RN** PENDING／IN_PROGRESS／COMPLETED（全收+部分合格退回）／RETURNED。**庫存**與驗收合格 **PURCHASE_IN** 一致；低庫存／零庫存。**POS 2 單**（現金／賒帳）+ **SALE_OUT**。**促銷 2+1 草稿**、**BulkImportJob** done/failed。**docs/db-seed.md**、**deploy-preview** 補「seed 清空」警告。新 DB 需先 **migrate deploy** 再 seed。
- 檔案：`prisma/seed.ts`、`docs/db-seed.md`、`docs/deploy-preview.md`。

### 2026-03-16 16:45（採購 Phase2：PURCHASE_PAYABLE + seed + purchase spec）
- 做了：**api-design-purchase §5** 明定 complete 後 **PURCHASE_PAYABLE**（Σ qualifiedQty×unitCost、partyId=supplierId、referenceId=RN id）。**ReceivingNote complete** 內 **FinanceService.recordFinanceEvent**。**seed** 4 家 Supplier、SEED-PO-DRAFT／ORDERED、SEED-RN IN_PROGRESS。**purchase.integration-spec**（無 Supplier 表則 skip）；**jest** 全綠時基線 **44 + skip 或 45**（依 DB 是否已 migrate）。**api-design §6.6**／**API-DECISIONS-bulk** rate limit 句已於前輪。
- 檔案：`receiving-note.service.ts`、`purchase.module.ts`、`prisma/seed.ts`、`purchase.integration-spec.ts`、`api-design-purchase.md`、`backend-error-format.md`。

### 2026-03-17 11:20（BACKEND-INSTRUCTIONS 本輪：維護 seed、迴歸）
- 做了：**jest 45 passed**；**未執行 `pnpm db:seed`**（避免 wipe 既有完整 seed DB，見 **db-seed.md**）。**未改 seed.ts**（complete 已寫 PURCHASE_PAYABLE，報表可沿用 RN complete 路徑）。**API-DECISIONS-bulk §5** 補 **POST /imports/jobs rate limit 未實作**建議；**api-design-purchase §5.1** **RETURN_TO_SUPPLIER**／**PURCHASE_RETURN** 草案。
- 檔案：`API-DECISIONS-bulk.md`、`api-design-purchase.md`。**purchase.integration-spec** 仍須 teardown，不殘留測試列。
