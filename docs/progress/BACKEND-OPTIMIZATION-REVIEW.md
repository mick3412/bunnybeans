# 後端全局優化審查

> 執行後端優化時，請依本檔作為修改方式參考。INSTRUCTIONS 任務對應本檔章節。

**033/034 完成狀態**：§一 Guard、§二 throw 工廠、§三 純字串 throw、§四 DTO 擴展、§五 Transaction、§六 N+1/並行、§七 分頁、§八 多數 as any、§九 catch、§十 日誌、§十一 測試、§十二 cursor/快取/select — **已由 INSTRUCTIONS 033/034 完成**。剩餘缺口：promotion conditions/actions DTO、throw 工廠 controller 殘留、pos.service L520 型別。

---

## 一、Guard 一致性：AdminApiKeyGuard

### 狀態

**已由 INSTRUCTIONS 033 完成**：Merchant、Purchase、Dashboard、POS 等寫入端點已加 AdminApiKeyGuard。

### 原缺口（已修復）

以下 Controller 的寫入端點未加 `@UseGuards(AdminApiKeyGuard)`：

| Controller | 檔案 | 說明 |
|------------|------|------|
| MerchantController | `backend/src/modules/merchant/interface/merchant.controller.ts` | 所有 CRUD 0 個 Guard |
| PurchaseOrderController | `backend/src/modules/purchase/interface/purchase-order.controller.ts` | 所有端點 0 個 Guard |
| ReceivingNoteController | `backend/src/modules/purchase/interface/receiving-note.controller.ts` | 所有端點 0 個 Guard |
| SupplierController | `backend/src/modules/purchase/interface/supplier.controller.ts` | 所有端點 0 個 Guard |
| PurchaseReportsController | `backend/src/modules/purchase/interface/purchase-reports.controller.ts` | 0 個 Guard |
| DashboardController | `backend/src/modules/dashboard/interface/dashboard.controller.ts` | 0 個 Guard |
| PosController | `backend/src/modules/pos/interface/pos.controller.ts` | 僅 `GET /export` 有 Guard；其餘 POST/GET 均無 |

### 修改方式

- 至少所有寫入端點（POST/PATCH/DELETE）加 `@UseGuards(AdminApiKeyGuard)`。
- 或改為 class-level：`@UseGuards(AdminApiKeyGuard)` 放於 `@Controller(...)` 下方。
- 參考已加 Guard 的 controller：`promotion.controller.ts`、`finance.controller.ts`、`customer.controller.ts`。

---

## 二、錯誤處理：throw-exceptions 工廠遷移

### 狀態

**已由 INSTRUCTIONS 033 完成**：18 個 service 檔、221+ 處已遷移。**殘留**：finance.controller L71、customer.controller L178 仍用 `new BadRequestException`，應改 `throwBadRequest`。

### 修改方式

1. 從 `shared/utils/throw-exceptions.ts` import：`throwBadRequest`、`throwNotFound`、`throwConflict`。
2. 將 `throw new BadRequestException({ code: 'XXX', message: '...' })` 改為 `throwBadRequest('XXX', '...')`。
3. 將 `throw new NotFoundException({ code, message })` 改為 `throwNotFound(code, message)`。
4. 將 `throw new ConflictException({ code, message })` 改為 `throwConflict(code, message)`。
5. 錯誤格式須符合 [backend-error-format.md](../backend-error-format.md)。

---

## 三、純字串 throw 修正

### 狀態

**已由 INSTRUCTIONS 033 完成**：merchant.service、product.service 已改 throwNotFound。

### 修改方式

改為：`throwNotFound('MERCHANT_NOT_FOUND', 'Merchant not found')` 等，確保回應含 `code` 欄位。

---

## 四、DTO / ValidationPipe 擴展

### 狀態

**已由 INSTRUCTIONS 033/034 完成**：POS、Purchase、ReceivingNote、Customer、Merchant、Finance 已建立 DTO。**殘留**：promotion.controller conditions/actions 仍為 `as any`，應定義 PromotionConditionDto、PromotionActionDto。

### 修改方式

1. 建立 `*.dto.ts` 檔，使用 `class-validator` 裝飾器：`@IsNotEmpty`、`@IsString`、`@IsOptional`、`@IsArray`、`@ValidateNested` 等。
2. 在 controller 的 `@Body()` 參數使用 DTO class。
3. 全域已啟用 `ValidationPipe`（main.ts），無需額外設定。
4. 參考：`backend/src/modules/promotion/dto/create-promotion-rule.dto.ts`、`pos-reports-query.dto.ts`。

---

## 五、Transaction 原子性：POS 多步驟寫入

### 狀態

**已由 INSTRUCTIONS 033 完成**：createOrder、appendPaymentToOrder、refundToOrder、returnToStock 已包入 $transaction。**殘留**：pos.service L520 `(source as any)?.totalAmount` 應改明確型別。

### 修改方式

將多步驟寫入包在 `this.prisma.$transaction(async (tx) => { ... })` 中，使用 `tx` 取代 `this.prisma` 執行 DB 操作。參考 `inventory.service.ts` L393 的 transfer 寫法。

---

## 六、N+1 與串行查詢優化

### 狀態

**已由 INSTRUCTIONS 033 完成**：warehouse 批次 findMany、Promise.all、customer 並行、手機 SQL contains。

### 6-A. pos.service.ts createOrder 多倉庫存檢查（L194-214）

- 現狀：巢狀 for 迴圈內 `await findUnique`，每 item 一次 DB。
- 修改：改為單次 `findMany({ where: { productId: { in: productIds }, warehouseId: wh.id } })`，在 memory 中比對數量。

### 6-B. pos.service.ts 串行改並行

- 庫存扣減（L299-308）：`for (item) { await recordInventoryEvent }` → `Promise.all`。
- 信用付款記帳（L326-337）：`for (p) { await recordFinanceEvent }` → `Promise.all`。
- returnToStock（L579-621）：`for (row) { await recordInventoryEvent }` → `Promise.all`。

### 6-C. customer.service.ts 串行改並行

- `getConsumptionInsights`（L99-181）：lastOrder、firstOrder、aggregate、count 可 `Promise.all`。
- `getById`（L345-397）：pointLedger、loyaltySettings 等可並行。

### 6-D. pos.service.ts 手機查詢全表掃描（L138-162）

- 現狀：`findMany({ phone: { not: null } })` 取全表再 JS filter。
- 修改：改為 SQL-side 正規化欄位或 LIKE 查詢，避免全表掃描。

---

## 七、分頁與 findMany 上限

### 狀態

**已由 INSTRUCTIONS 033 完成**：product take=5000、customer take=5000。

### 修改方式

- 為列表 API 加 `page`、`pageSize` 參數（與現有 pageSize 上限 100 對齊）。
- `findAll` 加 `take` 上限（如 1000）或分頁。

---

## 八、型別安全：as any 清理

### 狀態

**已由 INSTRUCTIONS 033 完成**：ops、tier-rule、finance.repository、receiving-note。**殘留**：promotion.controller conditions/actions（本輪處理）、pos.service L520。

### 修改方式

- 能用型別斷言 `as SomeType` 取代 `as any` 則改。
- 為 JSON 欄位定義 interface。
- 避免 catch 區塊使用 `e as any`，改用 `instanceof Error` 或 `unknown` + type guard。

---

## 九、catch 區塊吞錯修正

### 狀態

**已由 INSTRUCTIONS 033 完成**：loyalty rethrow、crm-job Logger、receiving-note Logger。

### 缺口

| 檔案 | 行號 | 情形 |
|------|------|------|
| receiving-note.service.ts | L251-252 | `catch { // ignore }` 吞錯 |
| dispatch-rule-runner.service.ts | L139-140 | `catch { return 'unknown error' }` 不 rethrow |
| crm-job.service.ts | L125-126 | catch 覆蓋 result |
| loyalty.controller.ts | L174-175, 200-201 | catch 返回錯誤物件但非 HTTP exception |

### 修改方式

- 若為預期可忽略的錯誤（如 view 未 migrate），加註解說明，並考慮 log。
- 若應 propagate，改為 `catch (e) { this.logger.warn(...); throw e; }`。
- loyalty.controller 的 catch 若為業務邏輯（如重複券碼），可保留但確保回傳格式一致。

---

## 十、業務操作日誌

### 狀態

**已由 INSTRUCTIONS 033 完成**：createOrder、refund、returnToStock、merge 加 Logger。

### 修改方式

在以下操作加 `Logger.log` 記錄操作摘要（traceId + 關鍵參數）：

- `pos.service.ts` createOrder、refundToOrder、returnToStock
- `customer.service.ts` merge
- 其他高價值寫入操作

使用 NestJS Logger，格式參考 `main.ts` requestLogger。

---

## 十一、測試覆蓋

### 狀態

**已由 INSTRUCTIONS 033 完成**：merchant、dashboard integration-spec；POS 並行、退款超額、customer merge edge case。

### 原缺口

- **merchant**：無 integration-spec。
- **dashboard**：無 integration-spec。
- **POS edge case**：並行建單庫存競爭、並行退款超額。
- **customer merge**：合併後積分/訂單歸屬。

### 修改方式

- 為 merchant、dashboard 建立 `*.integration-spec.ts`，至少涵蓋 happy path。
- 為 POS 並行情境、customer merge 加 edge case 測試。

---

## 十二、其他優化

### 狀態

**已由 INSTRUCTIONS 034 選配完成**：findLineRowsForExport cursor、dashboard TTL cache、findMany select。

| 項目 | 檔案 | 說明 |
|------|------|------|
| findLineRowsForExport | pos.repository.ts | while 迴圈可改 cursor-based pagination |
| dashboard 快取 | dashboard.service.ts | 可選：加記憶體快取 TTL 1-5 分鐘 |
| findMany select | product.repository.ts | 大列表可加 select 僅取必要欄位 |

---

## 執行順序建議

1. Guard 一致性（安全優先）
2. 純字串 throw 修正（快速）
3. throw-exceptions 工廠遷移（逐步）
4. Transaction 原子性（POS 高風險）
5. N+1 / 串行改並行
6. DTO 擴展（分批）
7. 分頁、型別、catch、日誌、測試
