# 後端開發紀錄（僅追加）

規格 Agent 收斂時讀本檔**最上方最新條目**。後端 Agent **每輪完成後**在上方追加，**勿刪改**下方舊文。  
本檔條目**改以 INSTRUCTIONS 編號分輪**（不再以日期時間分輪）。每一條目請簡短對照當輪的後端 INSTRUCTIONS（見 [tasks/instructions/](../tasks/instructions/)；以最新編號檔案為準）§1，說明各任務「已完成／進行中／未開始」與測試結果（jest／其它驗收）。

格式：

```markdown
### INSTRUCTIONS NNN（本輪摘要一句）
- 做了：…
- 測試/驗收：…
- commits：<short_sha> <message>；<short_sha> <message>（或 PR）
- PR／檔案（可選）：…
```

---

### INSTRUCTIONS-058（商品總覽：列表回應形狀 / 效期欄位與篩選一致性）
- 做了：
  - **#1 商品列表契約補齊**：`GET /products` 列表回應補上 `productionDate`、`shelfLifeMonths`、`expiryDate`，以支援前端計算「到期日／剩餘天數」。
  - **#2 效期篩選一致**：`minDaysUntilExpiry` 改為同時支援 `expiryDate` 或 `productionDate+shelfLifeMonths` 推算（與前端顯示一致），避免食品/牧草等大量落差。
  - **#3 分頁行為**：有 `minDaysUntilExpiry` 時改於應用層過濾後再分頁（因 DB 端無法直接 addMonths 計算），避免誤排除。
- 測試/驗收：`pnpm --filter pos-erp-backend test` ⚠️（既有 `ops.integration-spec.ts` flaky：runJob log count 斷言偶發 +1 不穩；本輪未新增/修改 ops 邏輯）
- commits：待提交

---

### INSTRUCTIONS-058（商品批次操作/匯出一致性 + 效期篩選對齊）
- 做了：依 `BACKEND-INSTRUCTIONS 058.md` §1 完成本輪任務。
  - **#2 批次操作/匯出支援**：確認 `PATCH /products/batch-price`、`PATCH /products/batch-tags`、`GET /products/export` 皆受 Admin Key 保護；統一 batch-tags 的錯誤碼（空 productIds → `PRODUCT_BATCH_EMPTY`；空 tags / 非法 operation → `PRODUCT_BATCH_INVALID`），並補 integration-spec。
  - **#3 效期/剩餘天數篩選一致**：`GET /products` 回傳包含 `productionDate`、`shelfLifeMonths`、`expiryDate`；`minDaysUntilExpiry` 篩選與匯出改為支援 `expiryDate` 或 `productionDate+shelfLifeMonths` 推算，對齊前端規則；文件同步更新。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠（22 suites、166 tests）；`pnpm ci:backend-with-db` 全綠。
- commits：`eccae3a3` fix(products): align export/filter expiry logic and unify batch-tags errors；`bd838ad6` docs(agent-log) 058

---

### INSTRUCTIONS-057（售後 API 二次驗收與契約凍結）
- 做了：依 `BACKEND-INSTRUCTIONS 057.md` §1 完成本輪任務（遵循售後計劃邊界：不新增 DB、不破壞既有退款/退貨核心 API）。
  - **#2 售後查詢 API 二次驗收**：補強 `GET /pos/orders` 邊界測試（空資料、混合情境、分頁）；驗證 `hasRefund` / `hasReturn` / `hasExchange` / `afterSalesOnly` 篩選正確。
  - **#3 明細資料完整性**：`GET /pos/orders/:id` 向後相容擴充售後摘要欄位（`hasRefunds`、`refundTotal`、`hasReturns`、`returnedItemCount`、`hasExchangeDerived`），支援明細頁 Tab 式售後重構。
  - **#4 契約凍結與相容保護**：維持 `POST /pos/orders/:id/refunds`、`POST /pos/orders/:id/returns/stock`、`POST /pos/orders`（含 `exchangeFromOrderId`）行為不變，回歸測試通過。
  - 文件同步：`api-design-pos` 補上明細擴充欄位說明。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠（22 suites、164 tests）；`pnpm ci:backend-with-db` 全綠（曾遇既有 pos-sessions 間歇失敗，重跑即通過）。
- commits：`d9ad2d71` feat(pos-after-sales): validate filters/pagination and enrich order detail after-sales fields

---

### INSTRUCTIONS-056（售後重整：POS 訂單列表欄位與篩選）
- 做了：依 `BACKEND-INSTRUCTIONS 056.md` §1 完成本輪任務（遵循售後重整計劃邊界：不新增 DB、不改退款/退貨核心 API）。
  - **#2 欄位擴充**：`GET /pos/orders` 新增 `hasRefunds`、`refundTotal`、`hasReturns`、`returnedItemCount`、`exchangeFromOrderId`、`hasExchangeDerived`。
  - **#3 篩選參數**：新增 `hasRefund`、`hasReturn`、`hasExchange`、`afterSalesOnly`（true/1 啟用）。
  - **#4 查詢效能/正確性**：改為單次 SQL 聚合與 `EXISTS` 條件，避免 N+1；退款使用 `FinanceEvent(SALE_REFUND)`，退貨使用 `InventoryEvent(RETURN_FROM_CUSTOMER)`，換貨使用 `exchangeFromOrderId`/衍生單關聯。
  - **#5 文件與型別同步**：更新 `api-design-pos` 列表欄位與 query 說明；前端 `posOrdersApi` query 型別、`posOrdersMockService` summary 型別同步。
  - **#6 測試**：新增 `pos-create-order.integration-spec` 測試覆蓋（僅退款/僅退貨/換貨衍生/afterSalesOnly 與各 filter）。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠（22 suites、164 tests）；`pnpm ci:backend-with-db` 全綠。
- commits：`3a71c125` feat(pos-after-sales): enhance order list fields and filters；`3f7d9f2c` docs(agent-log) 056

---

### INSTRUCTIONS-055（後端優化 #2～#5 採購／庫存分頁）
- 做了：依 `BACKEND-INSTRUCTIONS 055.md` §1 完成本輪任務。
  - **#2 Supplier 分頁**：`GET /suppliers` 新增 `page`、`pageSize`，回傳 `{ items, total, page, pageSize }`；預設 50，上限 200；保留 q 搜尋。
  - **#3 PurchaseOrder 分頁**：`GET /purchase-orders` 新增 `page`、`pageSize`，回傳 `{ items, total, page, pageSize }`；預設 20，上限 100；保留 lines include。
  - **#4 ReceivingNote 分頁**：`GET /receiving-notes` 新增 `page`、`pageSize`，回傳 `{ items, total, page, pageSize }`；預設 20，上限 100。
  - **#5 滯銷品分頁**：`GET /inventory/slow-moving` 新增 `page`、`pageSize`，回傳 `{ items, total, page, pageSize, from, to }`；預設 50，上限 200。
  - **前端**：purchaseApi listSuppliers、listPurchaseOrders、listReceivingNotes 使用 `response.items`。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 22 suites、162 passed（ops runJob flaky 1 failed）。
- commits：`dea77734` feat(backend-055): supplier, purchase-order, receiving-note, slow-moving pagination

---

### INSTRUCTIONS-054（後端優化 #2～#6）
- 做了：依 `BACKEND-INSTRUCTIONS 054.md` §1 完成本輪任務。
  - **#2 Finance 對象名稱搜尋**：`GET /finance/balances`、`GET /finance/events` 新增 `?q=`，依 Party.displayName ILIKE 搜尋；balances 的 with_party CTE 加條件；listEvents 依 q 查 partyIds 篩選。
  - **#3 Product 分頁**：findAll 回傳 `{ items, total, page, pageSize }`；預設 pageSize 50，上限 200；pos.service listProductsWithInventory 使用 `{ items }`。
  - **#4 Customer 分頁與 tag 下推**：listByMerchant 回傳 `{ items, total, page, pageSize }`；tag 篩選改為 Prisma `tags: { array_contains }` 下推至 DB。
  - **#5 Finance listEvents select**：findMany 只 select 必要欄位。
  - **#6 索引檢查**：FinanceEvent 新增 `@@index([occurredAt])`。
  - **前端**：posOrdersApi、loyaltyApi 處理 `{ items }` 回應形狀。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 22 suites、163 tests 全綠。`pnpm ci:backend-with-db` 有 1 flaky ops runJob 測試（單獨執行通過）。
- commits：`4dc8210d` feat(backend-054): finance q search, product/customer pagination, listEvents select, FinanceEvent index

---

### INSTRUCTIONS-053（052 收斂）
- 做了：依 `BACKEND-INSTRUCTIONS 053.md` §1 完成本輪任務。
  - **前置**：迴歸維護 `pnpm --filter pos-erp-backend test` 全綠；`pnpm ci:backend-with-db` 通過。
  - **#1 迴歸確認**：052 變更無遺漏、測試全綠；無待提交變更。
- 測試/驗收：`pnpm ci:backend-with-db` 通過；22 suites、163 tests 全綠。
- commits：`32c99f94` docs(agent-log) 053

---

### INSTRUCTIONS-052（051 收斂）
- 做了：依 `BACKEND-INSTRUCTIONS 052.md` §1 完成本輪任務。
  - **前置**：迴歸維護 `pnpm --filter pos-erp-backend test` 全綠；`pnpm ci:backend-with-db` 通過。
  - **#1 迴歸確認**：051 變更無遺漏、測試全綠；未提交變更（ops runJob 斷言）已補 atomic commit。
  - **#2 #4 POS 預設門市（選配）**：依說明「前端可先以 localStorage 實作，本項可後補」，本輪未實作。
- 測試/驗收：`pnpm ci:backend-with-db` 通過；22 suites、163 tests 全綠。
- commits：`e8585f0d` test(ops) runJob finance-snapshot assert exact count

---

### INSTRUCTIONS-051（050 收斂）
- 做了：依 `BACKEND-INSTRUCTIONS 051.md` §1 完成本輪任務。
  - **前置**：迴歸維護 `pnpm --filter pos-erp-backend test` 全綠；`pnpm ci:backend-with-db` 通過。
  - **#1 迴歸確認**：050 變更無遺漏、測試全綠；未提交變更（held-carts 驗證 + DTO）已補 atomic commit。
- 測試/驗收：`pnpm ci:backend-with-db` 通過；22 suites、163 tests 全綠。
- commits：`e9566beb` fix(pos) held-carts item validation + DTO class-validator；`76bad951` docs(agent-log) 051

---

### 掛單 DTO whitelist 修復（bugfix）
- 做了：`pos-held-carts.controller.ts` 的 `HeldCartItemDto`、`HoldCartBodyDto` 原先無 class-validator 裝飾器，導致 NestJS 全域 `ValidationPipe({ whitelist: true })` 移除 body 屬性，storeId 變成空字串、後端拋 `POS_HELD_CART_STORE_REQUIRED`。補上 `@IsString`、`@IsNumber`、`@Min`、`@IsArray`、`@ArrayMinSize`、`@ValidateNested`、`@Type` 等裝飾器，仿 create-pos-order.dto 模式。
- 測試/驗收：pos-held-carts integration 4 passed；全後端 163 tests 全綠。
- commits：待補 atomic commit
- 檔案：pos-held-carts.controller.ts

---

### INSTRUCTIONS-050（兩門市情境 + 營業報表門市維度）
- 做了：依 `BACKEND-INSTRUCTIONS 050.md` §1 完成本輪任務。
  - **前置**：迴歸維護 `pnpm --filter pos-erp-backend test` 全綠；`pnpm ci:backend-with-db` 通過。
  - **#1 迴歸確認**：049 變更無遺漏、測試全綠。
  - **#2 summary byStore 加入 avgOrder**：ByStoreItemDto 新增 `avgOrder`（revenue/ordersCount，0 時為 0）；api-design-pos §4.4 更新。
  - **#3 summary storeId 指定時跳過 byStoreRows**：條件式 `filter.storeId ? Promise.resolve([]) : groupBy(...)`，減少 DB 查詢。
  - **#4 integration-spec 補強**：byStore 含 avgOrder 且計算正確；帶 storeId 時 byStore 為 undefined 或空。
- 測試/驗收：`pnpm ci:backend-with-db` 通過；22 suites、163 tests 全綠。
- commits：`08eef150` feat(pos-reports) byStore avgOrder, skip when storeId

---

### INSTRUCTIONS-048（047 收斂 + 掛單 500 修正）
- 做了：依 `BACKEND-INSTRUCTIONS 048.md` §1 完成本輪任務。
  - **前置**：迴歸維護 `pnpm --filter pos-erp-backend test` 全綠；`pnpm ci:backend-with-db` 通過。
  - **#1 迴歸確認**：047 變更無遺漏、測試全綠。
  - **#2 掛單 Internal server error 修正**：holdCart 前驗證 store 存在，否則 `throwNotFound('POS_STORE_NOT_FOUND')`；補 integration test。
- 測試/驗收：`pnpm ci:backend-with-db` 通過；22 suites、162 tests 全綠。
- commits：`e34bd5f0` fix(pos) holdCart validate store, POS_STORE_NOT_FOUND；`8319f5ff` docs(agent-log) 048

---

### INSTRUCTIONS-047（046 收斂）
- 做了：依 `BACKEND-INSTRUCTIONS 047.md` §1 完成本輪任務。
  - **前置**：迴歸維護 `pnpm --filter pos-erp-backend test` 全綠；`pnpm ci:backend-with-db` 通過。
  - **#1 迴歸確認**：046 變更無遺漏、測試全綠；未提交後端變更已補 atomic commits（PosHeldCart 實作、e2e-seed 修正、docs）。
- 測試/驗收：`pnpm ci:backend-with-db` 通過；22 suites、161 tests 全綠。
- commits：`ffe85337` feat(pos) PosHeldCart；`04565d4c` fix(e2e-seed) ReferenceIdLink order；`2694a45d` docs db-seed e2e-pos；`bd1be9ab` docs(agent-log) 047

---

### INSTRUCTIONS-046（045 收斂 + 掛單／取單收斂）
- 做了：依 `BACKEND-INSTRUCTIONS 046.md` §1 完成本輪任務。
  - **#1 迴歸確認**：045 變更無遺漏、測試全綠。
  - **#2 掛單／取單收斂**：① seed wipeAll 加入 `posHeldCart.deleteMany()`（store 之前）；② api-design-pos 新增 § 掛單／取單 API 契約（POST/GET /pos/held-carts、POST /pos/held-carts/:id/retrieve）；③ 新增 `pos-held-carts.integration-spec.ts`（hold→list→retrieve、storeId/items 空拋錯、NOT_FOUND）。
- 測試/驗收：`pnpm ci:backend-with-db` 通過；22 suites、161 tests 全綠。
- commits：`a2717b79` fix(seed) wipeAll posHeldCart；`88b8df3d` docs(api-design-pos)；`6f5d5add` test(pos) pos-held-carts；`b3b47bf9` docs(agent-log) 046

---

### 交易暫存機制（掛單／取單）— 後端
- 做了：依計畫實作 POS 掛單／取單功能。① **Prisma Schema**：新增 `PosHeldCart` model（storeId、itemsJson、subtotal、total、heldAt）；migration `20260323064516_add_pos_held_cart`。② **PosHeldCartsService**：`holdCart`、`listHeldCarts`、`retrieveAndDelete`。③ **PosHeldCartsController**：`POST /pos/held-carts` 掛單、`GET /pos/held-carts?storeId=` 列表、`POST /pos/held-carts/:id/retrieve` 取單（回傳 items 並刪除）。④ 註冊至 pos.module.ts。
- 測試/驗收：migration 已套用；`pnpm --filter pos-erp-backend build` 受既有 e2e-seed 路徑影響，held-carts 模組結構正確。
- commits：變更未提交（待 atomic commits）
- 檔案：schema.prisma、pos-held-carts.service.ts、pos-held-carts.controller.ts、pos.module.ts、migrations/20260323064516_add_pos_held_cart/

---

### INSTRUCTIONS-045（044 收斂）
- 做了：依 `BACKEND-INSTRUCTIONS 045.md` §1 完成本輪任務。
  - **#1 迴歸確認**：044 變更無遺漏、測試全綠；044 未提交變更（含 seed 補強）已補 atomic commits。
- 測試/驗收：`pnpm ci:backend-with-db` 通過；21 suites、158 tests 全綠。
- commits：`3dc05793` feat(seed)；`d748a22d` docs(db-seed-coverage)；`25230948` docs(agent-log) 044；`09153cd3` docs(agent-log) 045

---

### INSTRUCTIONS-044（043 收斂 + Seed 補強）
- 做了：依 `BACKEND-INSTRUCTIONS 044.md` §1 完成本輪任務。
  - **#1 迴歸確認**：043 變更無遺漏、測試全綠；`pnpm ci:backend-with-db` 通過。
  - **#2 Seed 補強 CashRegisterSession**：S002 建立 3 筆（1 OPEN、2 CLOSED），openedAt 分散過去 7 天；供 AdminPosSessionsPage。
  - **#3 Seed 補強 補貨建議**：DEMO-POS-REPL 銷售 pLowStock 1 單位 → SALE_OUT、庫存歸零；供 AdminReplenishmentPage。
- 測試/驗收：`pnpm ci:backend-with-db` 通過；21 suites、158 tests 全綠。
- commits：`3dc05793` feat(seed)；`d748a22d` docs(db-seed-coverage)；`25230948` docs(agent-log) 044

---

### INSTRUCTIONS-043（042 收斂）
- 做了：依 `BACKEND-INSTRUCTIONS 043.md` §1 完成本輪任務。
  - **#1 迴歸確認**：042 變更無遺漏、測試全綠。修正 pos-sessions.integration-spec 清理邏輯（deleteMany 取代 delete、seed wipeAll 含 CashRegisterSession）。
- 測試/驗收：`pnpm ci:backend-with-db` 通過；21 suites、158 tests 全綠。
- commits：`45644be7` fix(backend): pos-sessions test cleanup + seed wipeAll CashRegisterSession

---

### INSTRUCTIONS-042（匯出 API、批次改標籤、供應商排行 seed）
- 做了：依 `BACKEND-INSTRUCTIONS 042.md` §1 完成本輪任務。
  - **#1 迴歸確認**：041 變更無遺漏、測試全綠。
  - **#2 匯入／匯出對應**：新增 **GET /products/export**（search、sku、categoryId、brandId、tag、minDaysUntilExpiry；CSV UTF-8 BOM、Admin Key、1 萬列）；**GET /customers/export**（merchantId、search、status、tag、memberLevel；同上）。
  - **#3 批次改標籤**：新增 **PATCH /products/batch-tags**；Body `{ productIds, tags, operation?: 'add' | 'set' }`；`add` 附加去重、`set` 覆寫；Response `{ updated }`；api-design §6.3b。
  - **#4 供應商採購排行有資料**：seed 為 rnFull、rnPartial、rnExpiring 設定 `createdAt: daysAgo(5)`，確保「近 30 日」報表有示範資料；db-seed-coverage 補「供應商採購排行」涵蓋說明。
- 測試/驗收：`pnpm ci:backend-with-db` 通過；21 suites、158 tests 全綠。
- commits：`b9fb9a9c` feat(backend): INSTRUCTIONS 042 - products/customers export, batch-tags, supplier rankings seed

---

### INSTRUCTIONS-041（折扣標籤驗收、關帳驗收）
- 做了：依 `BACKEND-INSTRUCTIONS 041.md` §1 完成本輪任務。
  - **#1 迴歸確認**：040 變更無遺漏、測試全綠。
  - **#2 折扣標籤驗收**：`api-design.md` §6.1a 補 `GET /product-tags/for-pos-discount`（Query merchantId；Response `{ id, name, code }[]`）、`showInPosDiscount`、`autoCondition` 契約；POST/PATCH body 說明；`product-tag.integration-spec` 補 `listForPosDiscount returns only showInPosDiscount tags` 測試。Seed 已含 showInPosDiscount / autoCondition 示範（前輪完成）。
  - **#3 關帳驗收**：`api-design-pos.md` 新增 §5 關帳／收銀時段（Sessions），含 open/current/close/list/get 契約；pos-sessions 實作（service、controller、migration）與 `pos-sessions.integration-spec`（含 listSessions 測試）一併提交。
- 測試/驗收：`pnpm ci:backend-with-db` 通過；21 suites、158 tests 全綠。
- commits：`fbdf176e` feat(backend): INSTRUCTIONS 041 - product-tag for-pos-discount, pos-sessions, api contracts

---

### INSTRUCTIONS-040（Finance balances 契約、Product 驗證）
- 做了：依 `BACKEND-INSTRUCTIONS 040.md` §1 完成本輪任務。
  - **#1 迴歸確認**：039 變更無遺漏、測試全綠。
  - **#2 Finance balances 契約**：`api-design-inventory-finance.md` §5.0d 補 Response 範例 JSON、Query 參數說明；`finance-accounting-roadmap.md` §9.3 更新契約狀態；integration-spec 已有 5 則 getBalances 測試。
  - **#3 Product schema + ProductTag**：已實作（schema 含 specCapacity/specStyle/specWeight/expiryDescription；ProductTag CRUD + api-design §6.1a；product-tag.integration-spec 7 則），本輪驗證無缺。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 153 passed；`pnpm ci:backend-with-db` 通過。
- commits：`4e9c3d0f` docs(finance): GET /finance/balances contract + roadmap §9

---

### INSTRUCTIONS-039（catch 修正、POS 產品 brandName）
- 做了：依 `BACKEND-INSTRUCTIONS 039.md` §1 完成本輪任務。
  - **#1 迴歸確認**：038 變更無遺漏、測試全綠。
  - **#2 catch 區塊吞錯修正**：receiving-note 加註解；dispatch-rule-runner formatError 內層 catch 加 Logger.warn；crm-job getJob resultJson parse 加 Logger.warn；loyalty.controller createCoupon/updateCoupon 改為 throw ConflictException/NotFoundException。
  - **#3 POS 產品含 brandName**：ProductRepository/ProductService 支援 `includeBrand`；`GET /pos/products` 回傳 `brandName`；api-design-pos §4.0a 補契約；integration test。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 153 passed；`pnpm ci:backend-with-db` 通過。
- commits：`8b0d47d3` refactor: catch block fixes；`6ebc35b1` feat(pos): GET /pos/products add brandName

---

### INSTRUCTIONS-038（POS 產品列表含庫存）
- 做了：依 `BACKEND-INSTRUCTIONS 038.md` §1 完成本輪任務。
  - **#1 迴歸確認**：037 變更無遺漏、測試全綠。
  - **#2 POS 產品列表含庫存**：新增 `GET /pos/products?storeId=`（PosProductsController）；依 storeId 取得門市對應倉庫，彙總 InventoryBalance.onHandQty；回傳產品基本欄位 + `onHandQty`；`api-design-pos.md` 補契約（§4.0a）；integration test。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 153 passed；`pnpm ci:backend-with-db` 通過。
- commits：`69a8b151` feat(pos): GET /pos/products?storeId= with onHandQty

---

### INSTRUCTIONS-037（Promotion DTO、throw 工廠、pos.service 型別）
- 做了：依 `BACKEND-INSTRUCTIONS 037.md` §1 完成本輪任務。
  - **#1 迴歸確認**：036 變更無遺漏、測試全綠。
  - **#2 BACKEND-OPTIMIZATION-REVIEW.md**：標註 033/034 完成、列出剩餘缺口。
  - **#3 Promotion conditions/actions DTO**：新增 `promotion-condition-action.dto.ts`（PromotionConditionDto、PromotionActionTierDto、PromotionActionDto）；`create-promotion-rule.dto.ts` 使用 `@ValidateNested` + `@Type`；`promotion.controller` 移除 `as any`。
  - **#4 throw 工廠殘留**：finance.controller L71、customer.controller L178 改為 `throwBadRequest`。
  - **#5 pos.service L520**：新增 `toNum` helper，`sourceTotal` 改為 `source ? toNum(source.totalAmount) : 0`，移除 `as any`。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 152 passed；`pnpm ci:backend-with-db` 通過。
- commits：`a9f7fed8` feat(promotion): DTO for conditions/actions with @ValidateNested；`9890ff3d` refactor(backend): throwBadRequest in finance/customer controller；`9d9fcdb4` refactor(pos): toNum helper for sourceTotal

---

### INSTRUCTIONS-036（迴歸確認）
- 做了：依 `BACKEND-INSTRUCTIONS 036.md` §1 完成本輪任務。
  - **迴歸維護**：`pnpm --filter pos-erp-backend test` 152 passed；`pnpm ci:backend-with-db` 通過。
  - **#1 迴歸確認**：確認 035 變更無遺漏、測試全綠；後端無待提交變更。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠；`pnpm ci:backend-with-db` 通過。
- commits：`efe9bb96` docs(agent-log): INSTRUCTIONS 036

---

### INSTRUCTIONS-035（迴歸確認、E2E 環境支援）
- 做了：依 `BACKEND-INSTRUCTIONS 035.md` §1 完成本輪任務。
  - **迴歸維護**：`pnpm --filter pos-erp-backend test` 152 passed；`pnpm ci:backend-with-db` 通過。
  - **#1 迴歸確認**：確認 034 變更無遺漏、測試全綠；後端無待提交變更。
  - **#2 E2E 環境支援**：確認 `db:seed` 含「食盆 小」（DEMO-BOWL-S）；`e2e:seed` 含 E2E-RN-0001（receiptNumber）、E2E-BC-0001（barcode single fixture）；供前端 E2E spec 使用。無需改 Guard 或 Key。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠；`pnpm ci:backend-with-db` 通過。
- commits：`919560d3` docs(agent-log): INSTRUCTIONS 035

---

### INSTRUCTIONS-033（Guard 一致性、throw 工廠遷移、DTO 擴展、POS Transaction、N+1/並行優化、分頁上限、as any 清理、catch 修正、Logger、測試覆蓋）
- 做了：依 `BACKEND-INSTRUCTIONS 033.md` §1 完成 #1～#12，並補齊第二輪項目。
  - **#1 AdminApiKeyGuard**：為 MerchantController（寫入端點）、PurchaseOrderController、ReceivingNoteController、SupplierController、PurchaseReportsController、DashboardController（class-level）、PosController（POST 端點）加上 AdminApiKeyGuard。
  - **#2 純字串 throw**：merchant.service.ts getMerchant/getStore/getWarehouse、product.service.ts getProduct 改為 throwNotFound({code, message})。
  - **#3 throw-exceptions 工廠遷移**：18 個 service 檔、221+ 處 throw 遷移至 throwBadRequest/throwNotFound/throwConflict。
  - **#4 DTO / ValidationPipe**：新增 CreatePosOrderDto、CreateCustomerDto、MergeCustomersDto、CreateMerchantDto；**補齊** CreatePurchaseOrderDto、QuickReceiveDto、PatchPurchaseOrderDto、CreateFromReplenishmentDto、CreateReceivingNoteDto、PatchReceivingNoteLinesDto、ReturnToSupplierDto、RecordFinanceEventDto、ClosePeriodDto、CreateSnapshotDto；Customer merge 改用 MergeCustomersDto（primaryId、mergeIds）。
  - **#5 POS Transaction**：createOrder 核心寫入包入 $transaction；appendPaymentToOrder 包入 $transaction；**補齊** refundToOrder、returnToStock 包入 $transaction。
  - **#6 N+1 與並行**：warehouse 庫存檢查改批次 findMany；inventory/finance 迴圈改 Promise.all；customer getConsumptionInsights 4 查詢並行；getById pointLedger+settings+lastEarned 並行。
  - **#7 手機查詢**：全表掃描改 SQL contains 末 9 碼，加 select 精簡。
  - **#8 分頁上限**：product findAll take=5000、customer listByMerchant take=5000。
  - **#9 as any 清理**：ops.service resultCode 欄位去除 as any、tier-rule Decimal 改 Number()、finance.repository error 型別守衛、receiving-note batchCode/expiryDate 去除 as any、promotion.controller 保留必要 cast。
  - **#10 catch 修正**：loyalty.controller rethrow HttpException、crm-job setImmediate catch 加 Logger.error、receiving-note 靜默 catch 加 Logger.warn、dispatch-rule-runner formatError 去除 as any。
  - **#11 業務日誌**：createOrder/refundToOrder/returnToStock/customer merge 加 Logger.log。
  - **#12 測試覆蓋**：新增 merchant.integration-spec、dashboard.integration-spec；**補齊** edge case：pos-create-order（並行 createOrder 至少一成功、sequential second refund exceeds → POS_REFUND_EXCEEDS_PAID）、customer.integration-spec（merge CUSTOMER_MERGE_INVALID when secondary not found / mergeIds empty or same as primary）。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 152 passed；`pnpm ci:backend-with-db` 通過。
- commits：`233b798c` feat(backend): INSTRUCTIONS 033 — guard, throw-factory, DTO, $transaction, N+1, pagination, as-any, catch, logging, tests；`16472261` DTOs for Purchase/ReceivingNote/Finance/Customer merge；`8c522c46` POS refundToOrder/returnToStock $transaction；`ddf564ef` edge case tests

---

### INSTRUCTIONS-034（迴歸確認、033 補齊提交、選配優化）
- 做了：依 `BACKEND-INSTRUCTIONS 034.md` §1 完成迴歸維護與本輪任務；**選配 #2** 已執行。
  - **迴歸維護**：`pnpm --filter pos-erp-backend test` 152 passed；`pnpm ci:backend-with-db` 通過。
  - **#1 迴歸確認**：確認 033 變更無遺漏、033 補齊未提交變更已補 atomic commits；修正 pos-create-order 並行測試 teardown（by storeId）。
  - **選配 #2 其他優化**：findLineRowsForExport 改 cursor-based pagination；findManyForExport、product.findAll、findLineRowsForExport 加 select 精簡；dashboard getSummary TTL 60s 快取。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠；`pnpm ci:backend-with-db` 通過。
- commits：`16472261` DTOs；`8c522c46` POS $transaction；`ddf564ef` edge case tests；`2840f10c` agent-log；`39149e85` fix teardown；`896774b1` perf: cursor pagination + select 精簡；`19ec7ce2` perf: dashboard TTL cache；`d8ef4e3d` fix: teardown by storeId；`a0d2c595` docs: agent-log 034 選配完成

---

### INSTRUCTIONS-032（Inventory 參數化、PosOrder 索引、Supplier CTE、createMasterWithCode、throw-exceptions、PosService 並行、Reorder SQL、Finance SQL 分頁、ValidationPipe、分頁 cap、Multi-tenant 稽核）
- 做了：依 `BACKEND-INSTRUCTIONS 032.md` §1 完成 #1～#16（略 #17 快取）。
  - **#1 迴歸**：`pnpm --filter pos-erp-backend test` 全綠。
  - **#2 ci:backend-with-db**：migrate deploy → db:seed → test 全綠。
  - **#3** Inventory `findExpiringBatches`、`findExpiringProductSummary`：`$queryRawUnsafe` → `Prisma.sql` 參數化。
  - **#4** PosOrder 新增 `@@index([storeId, createdAt])`；migration `20260320123220`。
  - **#5** SupplierService.getById：lead/qualified/returned 三 raw query 合併為單一 CTE SQL。
  - **#6** `createMasterWithCode` 共用函數；category/brand/product-tag service create 改呼叫之。
  - **#7** `shared/utils/throw-exceptions.ts`（throwBadRequest, throwNotFound, throwConflict）；promotion、pos-reports controller 試用。
  - **#8** PosService.getOrderById：derived、source、refundAgg、refundEvents 改 `Promise.all` 並行。
  - **#9** category/brand/product-tag repository reorder：單一 raw SQL `UPDATE ... SET sortOrder = CASE id WHEN ... END`。
  - **#10** findExpiringBatches rows+total 合併為單一查詢（COUNT(*) OVER()）。
  - **#11** main.ts requestLogger 改 NestJS Logger；bootstrap 改用 Logger。
  - **#12** finance.repository balancesByPartyId：SQL 層分頁與排序；Party 子查詢取代 IN 清單。
  - **#13** class-validator、class-transformer、@nestjs/mapped-types；main.ts ValidationPipe；CreatePromotionRuleDto、UpdatePromotionRuleDto、PosReportsQueryDto。
  - **#14** FinanceEvent `@@index([partyId, type])`；migration `20260320124252`。ReceivingNote/PurchaseOrder 既有索引評估後未新增。
  - **#15** pageSize 上限統一為 100（finance、inventory、ops）。
  - **#16** Multi-tenant 稽核：`docs/agent-collab/MULTI-TENANT-AUDIT-INSTRUCTIONS-032.md`。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠（145 passed）；`pnpm ci:backend-with-db` 全綠。
- commits：77a3c680 feat(backend): INSTRUCTIONS 032 — security, perf, refactor (#3–#16)

---

### INSTRUCTIONS-031（迴歸 + ci:backend-with-db 驗證）
- 做了：依 `BACKEND-INSTRUCTIONS 031.md` §1 完成 #1～#2。
  - **#1 迴歸**：`pnpm --filter pos-erp-backend test` 全綠（145 passed）。
  - **#2 ci:backend-with-db**：`migrate deploy` → `db:seed` → test 全綠。
- 測試/驗收：`pnpm ci:backend-with-db` 全綠。
- commits：無（本輪無後端變更）

### INSTRUCTIONS-030（迴歸 + ci:backend-with-db 驗證 + 類別／品牌／標籤排序）
- 做了：依 `BACKEND-INSTRUCTIONS 030.md` §1 完成 #1～#3。
  - **#1 迴歸**：`pnpm --filter pos-erp-backend test` 全綠（145 passed）。
  - **#2 ci:backend-with-db**：`migrate deploy` → `db:seed` → test 全綠。
  - **#3 類別／品牌／標籤排序**：Category、Brand、ProductTag 新增 `sortOrder`（Int 預設 0）；migration `20260320092022`；seed 建立時帶入 sortOrder；GET 列表依 sortOrder 升序；新增 `PATCH /categories/reorder`、`PATCH /brands/reorder`、`PATCH /product-tags/reorder`（body: `ids[]`；product-tags 需 `merchantId`）；api-design 補契約；category/brand/product-tag integration-spec 補 reorder 測試。
- 測試/驗收：`pnpm ci:backend-with-db` 全綠。
- commits：dcd21302 feat(category,brand,product-tag): add sortOrder + PATCH reorder API (INSTRUCTIONS 030)

### INSTRUCTIONS-029（迴歸 + ci:backend-with-db 驗證 + api-design 對齊檢查）
- 做了：依 `BACKEND-INSTRUCTIONS 029.md` §1 完成 #1～#3。
  - **#1 迴歸**：`pnpm --filter pos-erp-backend test` 全綠（142 passed）。
  - **#2 ci:backend-with-db**：`migrate deploy` → `db:seed` → test 全綠。
  - **#3 api-design 對齊檢查**：確認 api-design*.md 與實際 API 一致；028 新增 API（minDaysUntilExpiry、supplier-rankings、groupBy=hour、finance/summary byParty displayName/kind）皆已於契約載明，無缺漏。
- 測試/驗收：`pnpm ci:backend-with-db` 全綠。
- commits：1f7ea1b5 docs(agent-log): INSTRUCTIONS-029 backend entry

### INSTRUCTIONS-028（迴歸 + ci:backend-with-db + 金流 byParty displayName + 商品效期篩選 + 採購排行 + 時段分析）
- 做了：依 `BACKEND-INSTRUCTIONS 028.md` §1 完成 #1～#6。
  - **#1 迴歸**：`pnpm --filter pos-erp-backend test` 全綠（142 passed）。
  - **#2 ci:backend-with-db**：`migrate deploy` → `db:seed` → test 全綠。
  - **#3 金流 summary**：`GET /finance/summary?groupBy=partyId` 之 `byParty[]` 每筆擴充 **`displayName?`**、**`kind?`**（`finance.repository` 沿用 **`resolvePartyDisplayAndKind`**）；`api-design-inventory-finance.md` 補契約；`finance.integration-spec` 斷言欄位存在。
  - **#4 商品剩餘天數**：`GET /products` 支援 **`minDaysUntilExpiry`**（UTC 日界、嚴格大於 N 天且須有 `expiryDate`）；`api-design.md` §6.2 補充；非法 query → **`PRODUCT_FILTER_INVALID`**。
  - **#5 供應商採購排行**：新增 **`GET /purchase/reports/supplier-rankings`**（`PurchaseReportsService`／Controller）；僅 **`ReceivingNote` `COMPLETED`**，彙總 **`totalAmount`**（Σ qualifiedQty×unitCost）與 **`receivingNotesCount`**；`api-design-purchase.md` §1.2；`purchase.integration-spec` 一則。
  - **#6 時段分析**：`GET /pos/reports/daily` 支援 **`groupBy=hour`**，回傳 **`byHour`**（0–23，**`createdAt` UTC 小時**）；`api-design-pos.md` 補契約；`pos-reports.integration-spec` 一則。
- 測試/驗收：`pnpm ci:backend-with-db` 全綠（142 passed）。
- commits：ed181f47 feat(reports): INSTRUCTIONS 028 — finance byParty, minDaysUntilExpiry, supplier rankings, POS hourly + agent-log

### INSTRUCTIONS-027（迴歸 + ci:backend-with-db 驗證 + api-design 對齊 + byStore）
- 做了：依 `BACKEND-INSTRUCTIONS 027.md` §1 完成 #1～#4。
  - **#1 迴歸**：`pnpm ci:backend-with-db` 全綠（140 passed）。註：`pnpm --filter pos-erp-backend test` 單獨執行時，e2e-seed 需 DB 已執行 db:seed，建議使用 `ci:backend-with-db`。
  - **#2 ci:backend-with-db 驗證**：migrate deploy → db:seed → test 流程通過。
  - **#3 api-design 對齊**：api-design-pos 補 merchantId query 說明（summary、top-items、daily）；契約與實作一致。
  - **#4 報表進階（選配）**：`GET /pos/reports/summary` 擴充 `byStore`（storeId、storeCode、storeName、revenue、ordersCount，依營收降序）；pos-reports.integration-spec 補 byStore 多門市測試。
- 測試/驗收：`pnpm ci:backend-with-db` 全綠。
- commits：ff38741c feat(pos-reports): add byStore to summary；930b7c32 docs(agent-log): INSTRUCTIONS-027

### INSTRUCTIONS-026（迴歸 + 有效期限模組 + 即將到期天數 + 產品條碼確認）
- 做了：依 `BACKEND-INSTRUCTIONS 026.md` §1 完成 #1～#5。
  - **#1 迴歸**：`pnpm --filter pos-erp-backend test` 全綠（139 passed）。
  - **#2 DB seed 驗證**：`pnpm db:seed` 可執行；品牌 A～D、POS 訂單 60 天分散已確認。
  - **#3 有效期限模組**：`PATCH /receiving-notes/:id/lines` 與 `POST /purchase-orders/quick-receive` 支援 (a) `expiryDate` 或 (b) `productionDate` + `shelfLifeMonths` 由後端計算到期日；receiving-note.service 新增 `computeExpiryDate` 輔助。
  - **#4 即將到期天數**：`GET /inventory/expiring` 批次回傳新增 `daysUntilExpiry`（到期日期 − 當天）；`groupBy=product` 新增 `earliestDaysUntilExpiry` 與每 batch 之 `daysUntilExpiry`。
  - **#5 產品條碼確認**：Product schema 已有 `barcode`；`GET /products/search-barcode?q=`、scan-stocktake 已使用；api-design.md 已載明。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠。
- commits：d73b624b feat(purchase,inventory): expiry；368edbed docs: api-design expiry；b4f691b7 docs(agent-log): INSTRUCTIONS-026

### INSTRUCTIONS-025（迴歸 + Product schema 擴充確認）
- 做了：依 `BACKEND-INSTRUCTIONS 025.md` §1 完成 #1～#2。
  - **#1 迴歸**：`pnpm --filter pos-erp-backend test` 全綠（138 passed）。
  - **#2 Product schema 擴充**：**已於前期實作**。baseline migration 已含 `specCapacity`、`specStyle`、`specWeight`、`expiryDescription`；`specColor`、`weightGrams` 保留但棄用；product.service／repository／controller／CSV import 已支援；api-design.md 產品章節已載明。本輪更新 `GLOBAL-GAP-AND-UX-REVIEW.md` 將狀態改為「已實作」。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠。
- commits：051c2be9 docs: Product schema 已實作確認 + GLOBAL-GAP 狀態更新；8b7c9289 docs(agent-log): add INSTRUCTIONS-025 backend entry

### INSTRUCTIONS-024（四組報表後端：會員貢獻、營收趨勢 groupBy、客單價分布）
- 做了：依 `BACKEND-INSTRUCTIONS 024.md` §1 完成 #1～#4。
  - **#1 迴歸**：`pnpm --filter pos-erp-backend test` 全綠（138 passed）。
  - **#2 會員營收貢獻 API**：擴充 `GET /pos/reports/summary` 回傳 `memberContribution`（memberRevenue、memberOrdersCount、guestRevenue、guestOrdersCount）；pos-reports.service 依 PosOrder.customerId 有無分組彙總；pos-reports.integration-spec 補 memberContribution、member+guest breakdown 測試。
  - **#3 營收趨勢 groupBy API**：擴充 `GET /pos/reports/daily` 支援 `groupBy=day|week|month`；getDaily 依 groupBy 分桶（week 週一起點、month 月單位）；integration-spec 補 groupBy=week 測試。
  - **#4 客單價分布 API**：新增 `GET /pos/reports/order-value-distribution`（query 同 summary）；回傳 buckets（0–200、200–500、500–1000、1000–2000、2000+）；integration-spec 補一則。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠。
- commits：e7378c1 feat(pos-reports): memberContribution, daily groupBy, order-value-distribution；8da05abc docs(agent-log): add INSTRUCTIONS-024 backend entry；0699922f docs(agent-log): fix commit sha

### INSTRUCTIONS-023（迴歸 + 已實作確認）
- 做了：依 `BACKEND-INSTRUCTIONS 023.md` §1 完成 #1～#4。**#2～#4 已於前期實作**，本輪確認無需變更。
  - **#1 迴歸**：`pnpm --filter pos-erp-backend test` 全綠（135 passed）。
  - **#2 Party 多方視圖落實**：POS 建單／補款／退款已寫入 `customer:{id}`；驗收／退供寫入 `supplier:{id}`；finance.integration-spec「getBalances is isolated by merchantId」驗證跨商家隔離與 kind／displayName。
  - **#3 補貨閉環驗收**：purchase.integration-spec「from-replenishment: creates DRAFT PO from suggestions」已涵蓋勾選建議→建 PO 草稿 API 流程。
  - **#4 活動成效報表擴充**：GET /loyalty/reports/activity 已回傳 byDispatchRule、byCoupon、revenueFromPointRedemption；loyalty.integration-spec 已覆蓋。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠。
- commits：7ee95d50 docs(agent-log): add INSTRUCTIONS-023 backend entry。

### INSTRUCTIONS-021（迴歸 + 選配註記）
- 做了：依 `BACKEND-INSTRUCTIONS 021.md` §1 完成 #1；#2、#3 選配註記。
  - **#1 迴歸**：`pnpm --filter pos-erp-backend test` 全綠（135 passed）。
  - **#2 Party 多方視圖（選配）**：本輪不納入。**已於前期實作**：Party view 解析 partyId；GET /finance/balances 支援 kind 篩選（customer/supplier）與 displayName；api-design-inventory-finance 已對齊。待下輪規格決策若需擴充。
  - **#3 業績概覽 API 排查（選配）**：本輪無前端回報「熱銷品項／區間趨勢載入失敗」。019 已補 GET /pos/reports/top-items、daily 單一商家 merchantId fallback；integration-spec 已覆蓋。無需變更。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠。
- commits：3fd62bf7 docs(agent-log): add INSTRUCTIONS-021 backend entry。

### INSTRUCTIONS-020（finance-accounting-roadmap 對齊 + E2E full profile 審查）
- 做了：依 `BACKEND-INSTRUCTIONS 020.md` §1 完成 #1～#3。
  - **#1 迴歸**：`pnpm --filter pos-erp-backend test` 全綠（135 passed）。
  - **#2 finance-accounting-roadmap 對齊**：更新 `docs/finance-accounting-roadmap.md`：§6 應收應付彙總改為「已實作」；§6.2 GET /finance/balances 註明已實作、單一商家 merchantId fallback；§7 關帳與審計改為「已實作」；§9.1 應收應付餘額補充 displayName、kind、merchantId fallback；關帳／Audit 改為 **已實作**（periods、audit-log、snapshots 均已實作）。
  - **#3 E2E full profile 審查（選配）**：`admin-receiving-notes-smoke`、`admin-expiring-inventory-smoke` 已於 `.github/workflows/e2e-full.yml` fixed gate；e2e-seed full profile 具備對應 fixture（E2E-RN-0001、E2E-EXP-BATCH-0001）；`docs/e2e-pos.md` 已有驗收摘要；無需變更。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠。
- commits：9ebda857 docs: INSTRUCTIONS-020 finance-accounting-roadmap alignment；862905d5 docs(agent-log): fix INSTRUCTIONS-020 commit SHA。

### INSTRUCTIONS-019（主檔 canonical code + merchantId 單一商家友善 + agent-log 前端可開始）
- 做了：依 `BACKEND-INSTRUCTIONS 019.md` §1 完成 #1～#7。
  - **#1 迴歸**：`pnpm --filter pos-erp-backend test` 全綠（135 passed）。
  - **#2 主檔 code 規則**：Category/Brand/ProductTag 建立/更新套用 canonical code（`a-z0-9-`、slugify、dedupe suffix）；`code` 選填，未送時由 `name` 自動衍生；違規回傳 `*_CODE_INVALID`。
  - **#3 API 契約**：更新 `docs/api-design.md`、`docs/backend-error-format.md`（含 `*_CODE_INVALID`、`*_CODE_REQUIRED`、Brand/ProductTag 條目）。
  - **#4 integration-spec**：Category/ProductTag 補齊 (a) 中文名→x-* (b) 重複→suffix (c) 手動 code 接受/拒絕 (d) update 保留/重算。
  - **#5 前端可開始條件**：見下方 curl 範例，可驗證規則。
  - **#6 merchantId 單一商家友善**：`GET /finance/balances`、`GET /pos/reports/summary`、`top-items`、`daily` 未傳 merchantId 且 DB 僅一筆 Merchant 時自動使用；多商家時仍須傳 merchantId。
  - **#7 POS 報表**：top-items/daily 已具 integration-spec；單一商家情境可透過 merchantId fallback 正常回傳。
- **前端可開始條件**：API 已支援 `code` 選填與 canonical 規則；可用下列 curl 驗證：
  - 中文名自動 code：`curl -X POST http://localhost:3003/categories -H "Content-Type: application/json" -d '{"name":"飲料"}'` → `code` 為 `x-{hash}` 格式
  - 手動 code 接受：`curl -X POST http://localhost:3003/categories -H "Content-Type: application/json" -d '{"code":"drinks","name":"飲料"}'` → `code: "drinks"`
  - 手動 code 拒絕：`curl -X POST http://localhost:3003/categories -H "Content-Type: application/json" -d '{"code":"Invalid!","name":"X"}'` → 400 `CATEGORY_CODE_INVALID`
  - 單一商家 balances 免 merchantId：`curl http://localhost:3003/finance/balances`（DB 僅一筆 Merchant 時 200）
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠。
- commits：cd46d75a feat(backend): canonical code rules for Category/Brand/ProductTag；84bd7575 feat(backend): single-merchant fallback；0d687538 docs: INSTRUCTIONS-019 API contract, error codes, agent-log；b7723663 docs(agent-log): add commit SHAs

### INSTRUCTIONS-018（full seed 回歸 + 錯誤碼契約一致性確認）
- 做了：完成本輪 §1 #1~#5 檢查與回歸；`E2E_PROFILE=full pnpm --filter pos-erp-backend e2e:seed` 通過，`E2E_SEED_SUMMARY` 與 fail-fast 正常；檢查前端 `getErrorMessage` 與後端常用錯誤碼（401/403、`ADMIN_API_KEY_REQUIRED`、POS/INVENTORY/FINANCE）映射一致，無需新增後端錯誤碼或調整；確認目前前端變更僅使用既有 `expiryDescription` 欄位（後端已支援），且未採 slugify code 規則，故本輪不需後端 schema/API/validation 變更。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠；`E2E_PROFILE=full pnpm --filter pos-erp-backend e2e:seed` 通過並輸出 `E2E_SEED_SUMMARY`。
- commits：5f3f4390 docs(agent-log): add INSTRUCTIONS-018 backend entry

### INSTRUCTIONS-017（full gate fail-fast：expiring/receiving-note + CI triage log）
- 做了：`.github/workflows/e2e-full.yml` 擴充 fail-fast 的 `Expected fixture keys`（包含 dispatch、barcode、exchange、referenceId、replenishment、expiring、receiving note、finance report refs，並補 disabled/future 負向 keys）；`backend/scripts/e2e-seed.ts` 在 `E2E_PROFILE=full` 增加 `E2E_SEED_SUMMARY` console log，並新增/強化 fail-fast 驗證：`E2E-EXP-BATCH-0001` expiring inventory（`PURCHASE_IN` + expiryDate 落在 `daysAhead=30` + SUM(quantity)>0）與 `E2E-RN-0001` receiving note return-to-supplier 最小可退量（`qualifiedQty` 可退且 returnable>=1，並確保關聯 PO/warehouse/product 存在）；同時補強錯誤訊息包含 fixture key 與實際 count/值。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠。
- commits：3b316292 backend: extend e2e-full fail-fast fixture triage + seed summary；58701670 backend: refine e2e-seed errors + add CI seed summary；c58cee34 docs/e2e-pos: add CI triage fixture keys；4c213158 backend: fix TS types in e2e-seed fail-fast

### INSTRUCTIONS-015（補貨建議 full gate：擴 suite、seed deterministic、補 contract）
- 做了：`.github/workflows/e2e-full.yml` 固定清單加入 `e2e/admin-categories.spec.ts`、`e2e/admin-customers-import.spec.ts`、`e2e/admin-bulk.spec.ts`、`e2e/admin-replenishment.spec.ts`；`backend/scripts/e2e-seed.ts` 在 `E2E_PROFILE=full` 補足補貨建議所需 deterministic inventory 資料（`inventoryBalance.onHandQty=0` + `SALE_OUT` fixture）並 fail-fast 驗證 `suggestedQty > 0`；新增 `AdminApiKeyGuard` 錯誤碼 schema 測試（`ADMIN_API_KEY_REQUIRED`）；更新 `docs/e2e-pos.md` 補 `e2e-full` 指令範例與四個 spec 的驗收摘要。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠。
- commits：fac529c5 feat(e2e-seed): guarantee replenishment suggestions for full profile；43035a2f chore(e2e-full): add categories/customers/bulk/replenishment specs gate；6f99cb27 test(guard): add AdminApiKeyGuard 401 error schema coverage；77641776 docs(e2e-pos): add e2e-full example + spec acceptance rows

### INSTRUCTIONS-014（referenceId UUID-like 修復 + 報表穿透穩定性）
- 做了：`backend/scripts/e2e-seed.ts` 調整 POS order / receivingNote / exchange referenceId 為 UUID-like（純 hex）並加入 deterministic occurredAt；擴充 seed fail-fast 驗證（UUID-like 格式 + 至少 1 筆 finance referenceId 可解析為 posOrder/receivingNote）；補 `OpsService.resolveReference` integration 邊界測試，並更新 `docs/e2e-pos.md` referenceId UUID-like 契約與 full gate 驗收要點（避免 `ReferenceIdLink` 長期非可點狀態）。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠（含 `e2e:seed` fail-fast 驗證）；Playwright/E2E smoke 未於本機執行（依 seed/排序與前端 UUID-like contract 預期 full profile 不再 skip）。
- commits：da51cb6 feat(e2e,ops): stabilize ReferenceIdLink penetration fixtures；8d8ff8a docs(e2e): add ReferenceIdLink UUID-like contract + full gate checks

### INSTRUCTIONS-012（dispatch-rules 常駐化：full fixtures/runner 驗收 + lastRun/ops 導向一致性）
- 做了：依 `BACKEND-INSTRUCTIONS 012.md` §1 完成 #1～#10（RBAC 長期 skip）。
  - **#1 迴歸維護 + commit**：`prisma migrate deploy` 無 pending；`pnpm --filter pos-erp-backend test` 全綠後再提交 atomic commits。
  - **#2 E2E full fixtures（dispatch-rules runner 所需固定資料）**：`backend/scripts/e2e-seed.ts` full profile 新增 segment/coupon 與 enabled 規則（固定 key：`E2E-SEGMENT-NORMAL-0001` / `E2E-COUPON-0001` / `E2E-RULE-ENABLED-0001`），並用 `deleteMany` teardown 確保可重放。
  - **#3 runner 作用範圍（正/負向邊界）**：新增 disabled（`E2E-RULE-DISABLED-0001`）與未到時間 future（`E2E-RULE-FUTURE-0001`），並在 full profile 加 fail-fast 驗證。
  - **#4 OpsJobRunLog 對應驗收**：runner 回傳訊息彙總（含 rule name + `jobId=`），`crm.controller`/`ops.service` 以該 message 記錄 `OpsJobRunLog(jobType=crm-run-scheduled)`。
  - **#5 integration 邏輯邊界補全**：`backend/src/modules/crm/crm.integration-spec.ts` 擴充 disabled 不觸發/lastRun* 為 null、future 不觸發、duplicate 防重為 `SKIPPED` 且 lastRunNote 含 `duplicate-protection`、失敗為 `FAILED` 並 `nextRunAt` 後延約 +30min。
  - **#6 API 合約：dispatch-rules list lastRun 欄位**：補最小 integration-spec 確認列表回傳 `lastRunAt/lastRunCode/lastRunNote` 欄位一致（即使為 null）。
  - **#7 E2E full gate 不得 skip**：新增 `e2e/admin-dispatch-rules.spec.ts`，在 `E2E_PROFILE=full` 時觸發 runner 並驗證 lastRun* 非空且 lastRunCode 合理。
  - **#8 E2E：run log 導向 /admin/ops/jobs**：驗證 ops jobs 表可看到 `crm-run-scheduled` 且訊息包含 `jobId=`。
  - **#9 CI**：`.github/workflows/e2e-full.yml` 固定加入 `e2e/admin-dispatch-rules.spec.ts`，並 fail-fast 輸出預期 fixture keys。
  - **#10 文件對齊**：更新 `docs/e2e-pos.md`、`docs/crm-member-roadmap.md`；新增 `BACKEND/FRONTEND-INSTRUCTIONS 012` 並移除已過時的 009/010。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠。
- commits：e4aebf1 feat(ops,crm,e2e): dispatch-rules full gate fixtures and runner observability；9b36cd1 docs: align E2E/CI dispatch-rules acceptance for INSTRUCTIONS 012

### INSTRUCTIONS-010（E2E full gate 強化 + click-audit v2 健康/修復提示 + 常駐規則防重與重試）
- 做了：依 `BACKEND-INSTRUCTIONS 010.md` §1 完成 #1～#7（RBAC 長期 skip）。
  - **#1 Regression**：`prisma migrate deploy` 無 pending；`pnpm --filter pos-erp-backend test` 全綠（含新增 seed integration spec）。
  - **#2 Full fixtures 補金流報表資料集**：`E2E_PROFILE=full` seed 新增穩定 finance report dataset（sale/purchase referenceId），並加 `src/scripts/e2e-seed.integration-spec.ts` 驗證 seed 後可查到。
  - **#3 CI gate**：`.github/workflows/e2e-full.yml` 強化 fail-fast 輸出，並改為固定 gate specs 清單（barcode multi / 換貨 settlement / click-audit / 金流報表）。
  - **#4 Click-audit 健康分數 v2**：summary 新增 `health`（rate + OK/WARN/ALERT 門檻）與 `fixHints[]` 供前端顯示下一步；補 ops integration-spec。
  - **#5 Click-audit 修復路徑分類 v2**：list 回傳 `fixHint`（DATA_MISSING / NEEDS_DISAMBIGUATION / PERMISSION / OK），summary 回 `fixHints[]`；文件對齊。
  - **#6 常駐規則正式化保護**：runner 新增「同期間防重」→ `SKIPPED`，失敗最小重試策略（`nextRunAt` +30min）→ `FAILED`；補 crm integration-spec。
  - **#7 文件對齊**：更新 `docs/e2e-pos.md`（full fixtures 含金流報表）、`docs/ops-roadmap.md`（health/fixHint）、`docs/crm-member-roadmap.md`（防重/重試）。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠。
- commits：58ffe7c feat(e2e,ops,crm): full gate + click-audit v2 + dispatch rule hardening；31d10c3 docs: align click-audit v2 and full e2e fixtures

### INSTRUCTIONS-009（click-audit 可觀測性彙總 + E2E full fixtures/CI + CRM runner 監控欄位）
- 做了：依 `BACKEND-INSTRUCTIONS 009.md` §1 完成 #1～#8（RBAC 長期 skip）。
  - **#1 Regression**：修正 purchase integration-spec 會被殘留關帳資料污染的問題（測試前清 `FinancePeriodClose`），`prisma migrate deploy` 可跑通，後端 jest 全綠。
  - **#2 Click-audit 進階彙總**：`GET /ops/reports/click-audit/summary` 新增 `topSources`（NOT_FOUND/MULTI_MATCH 排行）、`trendByDay`、`topReferenceIds`；補 ops integration-spec（含至少 2 組 filter 組合）。
  - **#3 Click-audit drill-down 強化**：`GET /ops/reports/click-audit` 新增 `resultCode` filter；補整合測試。
  - **#4 E2E_PROFILE=full**：`pnpm --filter pos-erp-backend e2e:seed` 支援 `E2E_PROFILE=full`，一次產出 barcode single/multi-match、換貨 settlement（含 SALE_REFUND event）、報表用 finance events；並加入 fail-fast 驗證（缺 fixture 直接 throw）。
  - **#5 CI E2E（手動/排程）**：新增 `.github/workflows/e2e-full.yml`：`migrate deploy → db:seed → e2e:seed(full) → playwright`。
  - **#6 Runner 驗收補齊**：runner 失敗時錯誤訊息包含 error code（例如 `CRM_JOB_COUPON_REQUIRED`），並可由 ops/jobs 查到 run log。
  - **#7 Runner 最低監控指標**：`CrmCouponDispatchRule` 新增 `lastRunAt/lastRunCode/lastRunNote`（SENT/FAILED + 摘要），runner 執行時寫入；補最小整合測試。
  - **#8 文件對齊**：更新 `docs/e2e-pos.md`（full fixtures keys、e2e-full workflow）、`docs/ops-roadmap.md`（click-audit list/summary 欄位）、`docs/crm-member-roadmap.md`（dispatch-rules lastRun 欄位）。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠；`E2E_PROFILE=full pnpm --filter pos-erp-backend e2e:seed` 可重複執行且 fail-fast 驗證通過。
- commits：78a5909 feat(ops,crm): extend click-audit analytics and runner status；d349f08 docs: align e2e and ops/crm fixtures；54d30ac chore(backend): sync migrations, tests, and CI；5706a2a docs: refresh instructions and agent logs；fee3d9d feat(frontend,e2e): expand admin pages and E2E coverage；7072b09 chore(frontend-v2): add Vite scaffold (no build artifacts)

### INSTRUCTIONS-007（click-audit resultCode + barcode/seed/E2E 契約補齊 + 閉環驗收）
- 做了：依 `BACKEND-INSTRUCTIONS 007.md` §1 完成 #1～#10（RBAC 依文件前言長期 skip）。\n+  - **#1 Regression**：`prisma migrate deploy`、`db:seed`、後端 jest 全綠。\n+  - **#2 Snapshots 閉環**：補/驗證 `POST /finance/snapshots` 與 list/get/download 欄位一致，新增整合測試覆蓋 POST→list→download。\n+  - **#3 換貨 Phase2 驗收支援**：`exchangeSettlement` 補 `refund.events[]`（SALE_REFUND 摘要）與 topup/refund needed/refunded；整合測試覆蓋「需退款→退款後 SETTLED」。\n+  - **#4 Barcode 契約**：`GET /products/search-barcode` 明確允許多筆命中（回 `items[]`），並補 `limit` 行為整合測試。\n+  - **#5 E2E fixture**：`pnpm e2e:seed` 固定條碼 `E2E-BC-0001` 可重複生成；文件補充 fixture key。\n+  - **#6 Promotion reorder**：完整驗證重複/遺漏/跨 merchant（`PROMOTION_REORDER_INVALID`），integration-spec 覆蓋。\n+  - **#7 Purchase 退供再驗收**：integration-spec 覆蓋 return-to-supplier 的庫存/金流事件與 receiving-note 欄位。\n+  - **#8 Click-audit 可觀測性**：`ReportClickAudit` 新增 `resultCode`（string）+ migration；`POST /ops/reports/click-audit` 支援 `resultCode?` 並在未提供時推導 `NOT_FOUND/NAVIGATED`；summary 新增 `byResultCode` 聚合；補整合測試至少 3 種結果。\n+  - **#9 E2E 文件化**：更新 `docs/e2e-pos.md` 加入 migrate deploy → db:seed → e2e:seed → e2e 一鍵順序、barcode fixture、CI 步驟對齊。\n+  - **#10 文件對齊**：更新 `ops-roadmap.md` 補 `resultCode` 欄位說明。\n+- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠；`prisma migrate deploy` 套用新增 migration；`prisma generate` 更新 client。\n+- commits：無（本輪未要求 commit）。\n+\n 
### INSTRUCTIONS-006（換貨差額驗收補強 + barcode 文件對齊；RBAC 仍跳過）
- 做了：依 `BACKEND-INSTRUCTIONS 006.md` §1 完成 #1、#4～#7；#2/#3 RBAC 依目前產品決策指示 **忽略/跳過**（與文件要求衝突，已在文件註明以避免漂移）。
  - **#1 Regression**：`prisma migrate deploy`、`pnpm db:seed`、`pnpm --filter pos-erp-backend test` 全綠。
  - **#4 Barcode（維持可重複）**：更新 `api-design.md` 釐清 `GET /products/search-barcode` 允許多筆命中，前端需提供選擇列表 UX。
  - **#5 Snapshots POST 一致性驗收**：補整合測試，確保 `createSnapshot` 回傳欄位與 `getSnapshotById` 一致（generatedAt/summary/path）。
  - **#6 換貨 Phase 2 驗收支援**：擴充 `GET /pos/orders/:id` 的 `exchangeSettlement`，新增 `refund{neededAmount,refundedAmount,events[]}` 與 `topup{neededAmount,remainingAmount}`，讓前端可顯示退款事件摘要（SALE_REFUND）；補整合測試覆蓋「需退款→退款後 SETTLED」。
  - **#7 文件對齊**：更新 `erp-roadmap.md`、`order-roadmap.md` 的換貨/條碼/RBAC 狀態描述。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠（15 suites / 119 tests）。
- commits：無（本輪未要求 commit）。

### INSTRUCTIONS-005（barcode 可重複 + snapshot 查看/下載 + 換貨差額對帳 + 即期庫存 summary）
- 做了：依 `BACKEND-INSTRUCTIONS 005.md` §1 完成 #1、#4～#12；#2/#3 RBAC 依指示長期 skip。
  - **#1 Regression**：`prisma migrate deploy`、`pnpm db:seed`、`pnpm --filter pos-erp-backend test` 全綠。
  - **#4/#5 Barcode（允許重複）**：移除 `Product.barcode` unique（新增 index），`GET /products/search-barcode` 支援多筆命中；`pnpm e2e:seed` 補固定條碼 fixture `q=E2E-BC-0001`，並更新文件。
  - **#6 Finance snapshots 閉環**：補 `GET /finance/snapshots/:id` 與 `GET /finance/snapshots/:id/download`（含 summary/generateAt/path）。
  - **#7 換貨 Phase 2（最小對帳）**：`GET /pos/orders/:id` 回傳 `exchangeSettlement`（source/derived totals、delta、refund/topup status），並以 `SALE_REFUND` 判斷退款狀態。
  - **#8 即期庫存 summary**：`GET /inventory/expiring?groupBy=product` 回 `{ earliestExpiryDate, expiringQty, batches[] }`（含分頁）。
  - **#9 退供 UI 欄位**：確認 `GET /receiving-notes/:id`（service）回傳 qualified/returned/reason/batch/expiry 等欄位並補測試。
  - **#10 Promotion reorder 限制**：`PATCH /promotion-rules/reorder/bulk` 要求 ids 必須包含該 merchant 全部規則；partial reorder 回 `PROMOTION_REORDER_INVALID`，補錯誤碼文件與整合測試。
  - **#11 CI gate**：backend CI 新增 `pnpm ci:schema-migration-check`，並改用 `prisma migrate deploy`（取代 db push）。
  - **#12 文件對齊**：更新 finance snapshots 查看/下載、ERP 補充 inventory summary / promotion reorder 限制 / barcode fixture，並註明 RBAC 長期 skip。
- 測試/驗收：新增/更新之 module spec 單跑皆通過（product/finance/pos/inventory/purchase/promotion）；本輪 migration 可 deploy。
- 檔案（摘要）：`backend/prisma/schema.prisma`、`backend/prisma/migrations/20260318090000_barcode_non_unique`、`backend/scripts/e2e-seed.ts`、`backend/src/modules/finance/*`、`backend/src/modules/pos/*`、`backend/src/modules/inventory/*`、`backend/src/modules/promotion/*`、`.github/workflows/backend-ci.yml`、`docs/*`。

### INSTRUCTIONS-003（關帳/Audit/Snapshot + click-audit 查詢 + 可追蹤補跑）
- 做了：依 `BACKEND-INSTRUCTIONS 003.md` §1 完成 #1～#6、#8～#10；#7 RBAC 依指示跳過。\n+  - **#1 Regression**：`migrate deploy`、`db:seed`、後端 jest 全綠。\n+  - **#2 Click-audit 完整化**：新增 `GET /ops/reports/click-audit`（filter/sort/page）與 `GET /ops/reports/click-audit/summary`（聚合），補 ops integration-spec。\n+  - **#3 Finance periods + 寫入保護**：修正關帳檢查預設只套用 global（`merchantId=null`），新增 close/unlock 阻擋寫入測試。\n+  - **#4 Finance audit log**：驗證 `recordFinanceEvent` 成功後寫入 `FinanceAuditLog`，並可用 `GET /finance/audit-log` 查詢。\n+  - **#5 Snapshots 最小落地**：新增 `FinanceSnapshot`（migration + upsert），補 `GET /finance/snapshots` 列表與整合測試；Ops `finance-snapshot` 手動補跑仍可用。\n+  - **#6 Ops run 可追蹤**：`POST /ops/jobs/run` 回傳 `runLogId`，並可由 `GET /ops/jobs` 查到；補整合測試。\n+  - **#8 換貨回溯**：`GET /pos/orders/:id` 回傳 `exchange`（source/derived ids），補整合測試。\n+  - **#9 條碼規則**：文件補充 barcode 全域唯一說明（`GET /products/search-barcode`）。\n+  - **#10 CRM skeleton**：dispatch-rule runner 觸發 job、更新 nextRunAt，並寫 OpsJobRunLog（整合測試覆蓋）。\n+- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠；相關 module spec（ops/finance/pos/crm/product/customer）單跑亦通過。\n+
### INSTRUCTIONS-001（Phase 2 能力全做；重新追加）
- 做了：完成 `BACKEND-INSTRUCTIONS 001.md` §1 #1～#9。包含：`ReportClickAudit` + `POST /ops/reports/click-audit`；`pnpm ci:schema-migration-check`（schema/migration drift 檢查）；`GET /finance/balances`（merchantId 隔離、分頁、totals）；POS reports / Loyalty activity / Finance balances 多商家隔離與錯誤態測試；Loyalty activity v2 平均指標；POS 換貨追蹤 `exchangeFromOrderId`；`GET /products/search-barcode?q=` 條碼契約與 scan-stocktake 文件釐清。
- 測試/驗收：ops/finance/pos/loyalty/product 相關 integration-spec 皆通過；`prisma generate` 與 `migrate deploy` 可跑通。
- 檔案（摘要）：`backend/src/modules/ops/*`、`backend/src/modules/finance/*`、`backend/src/modules/pos/*`、`backend/src/modules/loyalty/*`、`backend/src/modules/product/*`、`backend/scripts/prisma-check-migrations.sh`、`docs/*`。

### 2026-03-18 01:47（BACKEND-INSTRUCTIONS §1：12 項執行驗收）
- 做了：依 `docs/tasks/BACKEND-INSTRUCTIONS.md` §1 執行並驗收（本輪做 #1~#7、#10~#12；#8/#9 略過）。包含：referenceId 規則跨文件一致；`GET /ops/references/resolve` 邊界整合測試；`pnpm e2e:seed` 穩定穿透 fixture；Finance summary `groupBy=day|week`；Party view/partyId 解析來源；CRM job 歷史列表；Loyalty 活動成效報表；換貨 MVP 文件；`ci:backend-with-db` 可重現跑通。
- 測試/驗收：`pnpm --filter pos-erp-backend test` 全綠（15 suites / 101 tests）；`pnpm --filter pos-erp-backend exec prisma migrate deploy` 無 pending；`pnpm db:seed` 成功；`pnpm e2e:seed` 成功（POS order id: `e2e00002-0000-4000-8000-00000000o001`；ReceivingNote id: `e2e00003-0000-4000-8000-00000000rn01`）；`pnpm ci:backend-with-db` 全綠。

### 初始化

- 本檔建立：協作流程改為 agent-log；之後每輪後端完成必追加。

### 彙整（2026-03-18 00:51）

| 模組/功能區塊 | 進度細節（去重） | 重點功能開發進度 |
|---|---|---|
| 商品主檔 | - `POST /products/import`（CSV multipart `file`、ok/failed）<br>- 產品規格欄位擴充（specCapacity/specStyle/specWeight/expiryDescription；specColor/weightGrams 棄用）<br>- ProductTag：`GET/POST/PATCH/DELETE /product-tags` + seed 示範 + integration-spec | - **Done**：CRUD/匯入/規格欄位/標籤 master 已具備並有測試覆蓋 |
| 庫存 | - CSV 盤點匯入：`POST /inventory/events/import`（逐列失敗、referenceId）<br>- 多品盤點：`POST /inventory/events/batch-stocktake`<br>- 掃碼盤點：`POST /inventory/events/scan-stocktake`（sku/barcode）<br>- 批次/效期：schema + `GET /inventory/expiring`（聚合）<br>- 補貨建議：`GET /inventory/replenishment-suggestions`<br>- 滯銷品：`GET /inventory/slow-moving` | - **Done**：盤點/批次效期/補貨/滯銷核心 API 已具備 |
| 採購 | - Supplier/PO/RN 全套 CRUD + submit/cancel + lines patch/complete/reject<br>- 入庫/應付：RN complete → `PURCHASE_IN` + `PURCHASE_PAYABLE`<br>- 退供應商：`POST /receiving-notes/:id/return-to-supplier` → `RETURN_TO_SUPPLIER` + `PURCHASE_RETURN`<br>- 補貨→PO 草稿：`POST /purchase-orders/from-replenishment`<br>- 快速進貨：`POST /purchase-orders/quick-receive`（PO+RN+complete 一鍵）<br>- 供應商績效：`GET /suppliers/:id` 追加 kpis | - **Done**：採購主流程 + 退供 + 補貨閉環 + 快速進貨已具備；契約與測試已補 |
| POS（銷售/報表） | - 訂單匯出：`GET /pos/orders/export`（可含明細 `includeLines=1`）<br>- POS 報表：`GET /pos/reports/summary`（含 preset/from/to、byPaymentMethod/byCategory、毛利欄位）、`/top-items`、`/daily` + integration-spec<br>- 促銷試算/結帳整合（points multiplier、usageCount 等） | - **Done**：POS 匯出/報表/毛利分析已具備並有測試覆蓋 |
| 金流/財務 | - Finance events list/export 支援 `type` 篩選<br>- `GET /finance/summary`（groupBy=type/partyId）<br>- `GET /finance/balances`（回傳 receivable/payable；後續補 `displayName`、`kind` + kind 篩選）<br>- 關帳/Audit/快照：period close/unlock、audit-log、snapshots（Phase 3） | - **Done**：events/export/summary/balances 已具備（含 kind/displayName 擴充）<br>- **Done（已落地）**：關帳/Audit/快照端點與 migration 已有紀錄 |
| 會員/集點/CRM/行銷 | - 會員主檔 2.0：Customer status/blockReason/tags + merge + contacts（CustomerContactLog）<br>- 點數：EARNED/BURNED ledger、merchant-wide ledger、dashboard KPI 擴充<br>- 客戶匯入：preview/apply（fileHash + decisions）與舊版 import/job 方案<br>- 分群/分級：Segment（preview/export）、TierRule（recalc-tiers）<br>- 行銷 job：`POST /crm/jobs/:kind`（含 segment-coupon 等）+ `GET /crm/jobs/:id`<br>- 發券規則：dispatch-rules CRUD + run-scheduled runner | - **Done**：CRM A～G 多數路徑已具備（主檔/分群/互動/行銷 job/發券規則/活動報表） |
| 促銷 | - PromotionRule CRUD、preview 金額一致性<br>- usageCount 追蹤、memberLevels 條件<br>- 點數加倍：`POINTS_MULTIPLIER`（取最大倍率）<br>- 促銷成效：`GET /promotion-rules/effectiveness` | - **Done**：引擎/試算/加倍點數/成效 API 已具備 |
| Ops/監控 | - OpsJobRunLog + `GET /ops/jobs/status`<br>- `GET /ops/jobs` 分頁/kind 篩選 + from/to + messageSummary（200 字截斷）<br>- referenceId 解析：`GET /ops/references/resolve?referenceId=` → `{ kind }` | - **Done**：job 狀態/列表/穿透解析能力已具備；integration-spec 已有覆蓋紀錄 |
| 匯入/匯出/批次作業 | - export CSV：inventory balances、finance events、pos orders（含明細）<br>- imports/jobs：products_csv/inventory_csv（BulkImportJob） + job 查詢<br>- imports rate limit：`POST /imports/jobs` 10/min（429 IMPORT_JOB_RATE_LIMIT） | - **Done**：CSV 匯入匯出與 job 基礎、限流已具備 |
| 測試/部署/E2E/Seed | - Jest 多輪全綠（覆蓋多模組 integration-spec）<br>- `pnpm ci:backend-with-db` / fallback（db push → seed → test）與 P3009/P3018 排除文件<br>- seed 劇本：wipeAll + 全域 demo；E2E fixture 分離 `e2e:seed`<br>- deploy-preview：排程/常見錯誤/驗證指南 | - **Done**：測試與 seed 流程已成形；CI 一鍵綠在乾淨 DB 上可行，已文件化限制 |

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

### 2026-03-17 15:40（Loyalty dashboard 擴充 + point-ledger 全店）
- 做了：**GET /loyalty/dashboard** 增 **circulatingPointsTotal**（各客戶最新 balanceAfter&gt;0 合計）、**newMembersThisMonth**、**totalPointsBurnedLifetime**、**ongoingPromotionsCount**、**recentLedger**（15 筆含會員名）、**activePromotions**（draft=false 檔期內）；舊三欄位保留。**GET point-ledger** 僅 **merchantId** 時 **listLedgerMerchantWide**（含 **customerName**）。**jest 45** 綠。
- 檔案：`loyalty.service.ts`、`loyalty.controller.ts`、`docs/api-design-loyalty.md`。

### 2026-03-17 12:30（Loyalty CRM B1–B6 + imports 限流 + seed 對帳）
- 做了：**migration `20260317120000_loyalty_crm`**（LoyaltySettings、PointLedger、LoyaltyCoupon、Customer memberCode/joinDate、PromotionRule.usageCount）。**LoyaltyModule**：settings／ledger／dashboard／coupons CRUD（Admin）；**POS createOrder** 贈 **EARNED** + 促銷 **usageCount**；**GET /customers** 擴充 pointBalance 等；**POST /imports/jobs** **10/分** **429 IMPORT_JOB_RATE_LIMIT**。**seed** wipe 補刪 loyalty 表；**DEMO-RN-FULL** 後補一筆 **PURCHASE_PAYABLE**；LoyaltySettings + 示範 PointLedger + WELCOME10 coupon。**api-design-loyalty**、**API-DECISIONS-bulk**、**backend-error-format**。**jest 45** 綠（需已 migrate）。
- 檔案：`schema.prisma`、`loyalty/*`、`pos.service.ts`、`customer.service.ts`、`imports.controller.ts`、`import-job-rate-limit.ts`、`seed.ts`、`docs/*`。

### 2026-03-17 16:05（BACKEND-INSTRUCTIONS §1 迴歸、未跑 seed）
- 做了：**jest 45 passed**（9 suites）；**未執行 db:seed**，以保留既有完整 seed 資料庫。**purchase.integration-spec** teardown 已確認清理測試自建資料。本輪依 **BACKEND-INSTRUCTIONS** §1 必做執行。
- 檔案：`docs/agent-collab/agent-log-backend.md`。

### 2026-03-17 17:00（BACKEND-INSTRUCTIONS §1 計畫執行）
- 做了：**jest 45 passed**（9 suites）；**未執行 db:seed**，以保留既有完整 seed 資料。依計畫執行迴歸＋agent-log 追加。
- 檔案：`docs/agent-collab/agent-log-backend.md`。

### 2026-03-17 18:00（選配三項：customers/search、return-to-supplier、Loyalty spec）
- 做了：**① GET /customers/search?merchantId=&q=** 模糊搜尋 phone／name／memberCode，回傳 items 最多 20 筆；**api-design-loyalty §8**。**② 採購 §5.1** **POST /receiving-notes/:id/return-to-supplier**（body lines receivingNoteLineId + quantity），COMPLETED RN 可退倉 **RETURN_TO_SUPPLIER** ＋ 一筆 **PURCHASE_RETURN**；**api-design-purchase §5.1** 標已採用。**③ Loyalty 專用 integration-spec**（getSettings、listLedgerMerchantWide、listLedger、dashboard 四則，teardown 自建資料）；修正 dashboard  Raw SQL **customerId** 歧義。**jest 49** 綠。
- 檔案：`customer.service.ts`、`customer.controller.ts`、`receiving-note.service.ts`、`receiving-note.controller.ts`、`loyalty.service.ts`、`loyalty.integration-spec.ts`、`api-design-loyalty.md`、`api-design-purchase.md`。

### 2026-03-17 19:00（BACKEND-INSTRUCTIONS 必做 ①～④ + 選配已具）
- 做了：**①** jest 49 passed，未執行 db:seed。**② B3 效期** GET /customers 回傳 **expiringSoon**、**expiringAt**（依 LoyaltySettings.rollingDays／notifyDaysBefore 與最後一筆 EARNED 計算）。**③ 會員單筆 CRUD** **POST /customers**、**GET /customers/:id**、**PATCH /customers/:id**（Admin 寫入 X-Admin-Key）；契約 §7。**④ 結帳 BURNED** createOrder body **pointsToRedeem**，有客戶時扣點寫 **PointLedger BURNED**，餘額不足 **400 LOYALTY_INSUFFICIENT_POINTS**；**api-design-loyalty §5**、**backend-error-format**。選配（search、return-to-supplier、Loyalty spec）前輪已完成。
- 檔案：`customer.service.ts`、`customer.controller.ts`、`pos.service.ts`、`loyalty.service.ts`、`api-design-loyalty.md`、`backend-error-format.md`、`agent-log-backend.md`。

### 2026-03-17 20:00（BACKEND-INSTRUCTIONS 全執行 + 選配 單一商家 API）
- 做了：**選配** **GET /merchant/current** 新增（優先 env **DEFAULT_MERCHANT_ID**，無則 DB 唯一一筆；0 筆 404 MERCHANT_NOT_FOUND、多筆 400 MERCHANT_AMBIGUOUS）。**api-design-loyalty §9**、**backend-error-format**。**①～⑤** 必做已具，本輪迴歸確認；**未執行 db:seed**。**jest 49** 綠。
- 檔案：`merchant.service.ts`、`merchant.controller.ts`、`api-design-loyalty.md`、`backend-error-format.md`、`agent-log-backend.md`。

### 2026-03-17 21:15（BACKEND-INSTRUCTIONS 本輪必做 + 選配全做）
- 做了：**①** **jest 53 passed** 全綠。**②** 未執行 db:seed，保留既有 DB（本條註明）。**③** return-to-supplier 測試已具備（purchase.integration-spec 已有 RETURN_TO_SUPPLIER + PURCHASE_RETURN it）。**④** 契約對照：**backend-error-format** 補 **RN_COMPLETE_INVALID** 含「退倉超過合格數（return-to-supplier）」；api-design-loyalty、api-design-purchase 與實作一致。**選配**：Loyalty 進階 integration-spec 已具（settings／ledger limit／dashboard 空 merchant 等 7 則）；**優惠券** **api-design-loyalty §4** 補 **usedCount** 更新時機「POS 核銷後置」；**促銷 usageCount** pos-create-order.integration-spec「applies promotion」一則內 createOrder 後斷言 **PromotionRule.usageCount** ≥ 1；**會員主檔 2.0** **api-design.md §6.7** 契約草案（篩選、合併、標籤、黑名單、錯誤碼建議）。
- 檔案：`pos-create-order.integration-spec.ts`、`api-design-loyalty.md`、`api-design.md`、`backend-error-format.md`、`agent-log-backend.md`。

### 2026-03-17 22:00（BACKEND-INSTRUCTIONS 本輪：金流 type／summary／優惠券核銷／分群契約 + 選配全做）
- 做了：**①** **jest 55 passed** 全綠。**②** 未執行 db:seed，保留既有 DB（本條註明）。**③** 金流 type 維度：GET /finance/events 與 export 已支援 **type** 篩選；**finance.integration-spec** 新增 **listFinanceEvents filters by type**、**getSummary groupBy=type** 兩則。**④** 會員主檔 2.0 **後輪實作**（本條註明）。**選配**：**GET /finance/summary**（query from、to、preset=last30d、**groupBy=type｜partyId**；回應 byType 或 byParty）；**優惠券 POS 核銷** createOrder body **couponCode**、LoyaltyService **getCouponDiscount**／**redeemCoupon**、結帳成功後 usedCount +1；**分群／互動** **api-design.md §6.8** 契約草案（階段 E 分級分群、F 互動紀錄、G 行銷整合）。**backend-error-format** 補 LOYALTY_COUPON_INVALID、LOYALTY_COUPON_MAX_USED。purchase.integration-spec 修正 warehouse code 唯一性（避免 Unique constraint）。
- 檔案：`finance.repository.ts`、`finance.service.ts`、`finance.controller.ts`、`finance.integration-spec.ts`、`loyalty.service.ts`、`pos.service.ts`、`pos.controller.ts`、`purchase.integration-spec.ts`、`api-design-inventory-finance.md`、`api-design-loyalty.md`、`api-design.md`、`backend-error-format.md`、`agent-log-backend.md`。

### 2026-03-13 21:30（會員主檔 2.0 本輪實作 + 選配 F 完整、E/G 契約補齊）
- 做了：**①** **jest 59 passed** 全綠。**②** 未執行 db:seed（保留既有完整 seed DB，見 db-seed.md）。**③** 金流迴歸：finance.integration-spec 已有 type／preset／getSummary；本輪新增 **getSummary groupBy=partyId returns byParty array** 一則。**④** **會員主檔 2.0 本輪實作**：Schema Customer **status**／**blockReason**／**tags**、**CustomerContactLog**；migration `20260318000000_member_20_contact_log`；**CustomerService** listByMerchant（status／tag／phone／name／memberLevel 篩選）、getById／update（status、blockReason、tags）、**merge**（primaryId／mergeIds，歸戶 PosOrder／PointLedger／ContactLog，併入檔 BLOCKED）、**getContacts**／**addContact**；**CustomerController** GET/PATCH :id、GET/POST merge、GET/POST :id/contacts；**backend-error-format** CUSTOMER_NOT_FOUND、CUSTOMER_MERGE_INVALID、CUSTOMER_CONTACT_TYPE_REQUIRED。**選配 1 F**：互動紀錄完整（CustomerContactLog、GET/POST /customers/:id/contacts）；**customer.integration-spec** 新增 member 2.0 + contacts 三則（list 篩選 status/tags、merge、getContacts/addContact）。**選配 1 E/G**：**契約補齊** — api-design §6.8 階段 E（TierRule、POST /crm/recalc-tiers、Segment、GET /crm/segments/:id/preview）、G（生日券／回購券 job、報表 API）標 draft 與錯誤碼建議；F 標 stable 已實作。**選配 2**：金流 **getSummary groupBy=partyId** 補一則 integration 測試。**api-design.md** §6.7 標 stable、§6.8 F 已實作／E/G draft。
- 檔案：`schema.prisma`、`migrations/20260318000000_member_20_contact_log`、`customer.service.ts`、`customer.controller.ts`、`customer.integration-spec.ts`、`finance.integration-spec.ts`、`api-design.md`、`backend-error-format.md`、`agent-log-backend.md`。

### 2026-03-13 22:15（選配補齊：優惠券測試 + 階段 E Segment 最小實作）
- 做了：**選配** **①** 優惠券 — **loyalty.integration-spec** 新增 **createCoupon then listCoupons returns coupon with usedCount**（建立券後 list 含 usedCount=0）。**②** 階段 E 分群最小實作 — Prisma **Segment**（merchantId、name、conditions Json）；migration **20260318100000_add_segment**；**CrmModule**（SegmentService、SegmentController）；**GET /crm/segments/:id/preview** 回傳 `{ customerIds, count }`（依 conditions.memberLevel 可篩，無則該商家 ACTIVE 客戶）；**SEGMENT_NOT_FOUND** 見 backend-error-format；**crm.integration-spec** 兩則（getPreview 回傳名單、未知 id 拋 SEGMENT_NOT_FOUND）。**jest 62 passed**。**api-design.md** §6.8 階段 E 分群標「最小實作已具」。
- 檔案：`loyalty.integration-spec.ts`、`schema.prisma`、`migrations/20260318100000_add_segment`、`crm/segment.service.ts`、`crm/segment.controller.ts`、`crm/crm.module.ts`、`crm.integration-spec.ts`、`app.module.ts`、`backend-error-format.md`、`api-design.md`、`agent-log-backend.md`。

### 2026-03-13 22:35（BACKEND-INSTRUCTIONS 本輪執行）
- 做了：**①** **jest 62 passed** 全綠；purchase.integration-spec teardown 已確認清理自建資料。**②** 未執行 db:seed，保留既有完整 seed DB（見 db-seed.md）。**③** 迴歸確認：會員主檔 2.0（list 篩選、merge、contacts）、金流（events／export／summary groupBy=type｜partyId）、CRM（GET /crm/segments/:id/preview）已由 customer.integration-spec、finance.integration-spec、crm.integration-spec 涵蓋；契約與 api-design.md §6.7、§6.8 對齊。
- 檔案：無程式變更；**agent-log-backend.md** 本則追加。

### 2026-03-13 22:50（選配一併完成：seed Segment／ContactLog + 階段 E 條件測試）
- 做了：**選配** **①** 補 seed — **wipeAll** 新增 **customerContactLog.deleteMany**、**segment.deleteMany**；seed 劇本新增 **2 筆 Segment**（「全部 ACTIVE 會員」、「VIP 會員」conditions.memberLevel=VIP）、**1 筆 CustomerContactLog**（E2E 客戶、type=CALL）；**db-seed.md** 建立內容表補 Segment／ContactLog 說明。**②** 補整合測試 — **crm.integration-spec** 新增 **getPreview with conditions.memberLevel returns only matching customers**（VIP 分群僅回傳 VIP 客戶）。**jest 63 passed**。
- 檔案：`prisma/seed.ts`、`docs/db-seed.md`、`crm.integration-spec.ts`、`agent-log-backend.md`。

### 2026-03-13 23:05（BACKEND-INSTRUCTIONS 本輪執行）
- 做了：**①** **jest 63 passed** 全綠；purchase.integration-spec teardown 已確認清理自建資料。**②** 未執行 db:seed，保留既有完整 seed DB（見 db-seed.md）。**③** 迴歸確認：會員主檔 2.0（list 篩選、merge、contacts）、金流（events／export／summary groupBy=type｜partyId）、CRM（Segment preview 含 conditions.memberLevel）已由 customer、finance、crm integration-spec 涵蓋；契約與 api-design.md §6.7、§6.8 對齊。
- 檔案：無程式變更；**agent-log-backend.md** 本則追加。

### 2026-03-13 23:25（BACKEND-INSTRUCTIONS 必做 + 選配全做）
- 做了：**①** **jest 65 passed** 全綠。**②** 未執行 db:seed，保留既有 DB。**③** 維運確認契約對齊。**選配全做** — **階段 E 進階**：**GET /crm/segments/:id/export** 分群名單 CSV（id,name,phone,memberLevel；Admin Key）；**POST /crm/recalc-tiers**（Admin）stub 回傳 `{ updated: 0 }`；**crm.integration-spec** 新增 getExportCsv 一則。**階段 G**：**POST /crm/jobs/:kind**（Admin）kind=birthday-coupon｜repurchase-coupon，202 `{ jobId }` stub；無效 kind 400 **CRM_JOB_KIND_INVALID**；**CrmController** 註冊。**財務 Phase 4**：**GET /finance/balances**（query 可選 partyId）stub 回傳 `{ items: [] }`；**api-design-inventory-finance**、**api-design.md** §6.8、**backend-error-format** 契約與錯誤碼補齊；**finance.integration-spec** getBalances 一則。
- 檔案：`segment.service.ts`、`segment.controller.ts`、`crm.controller.ts`、`crm.module.ts`、`crm.integration-spec.ts`、`finance.controller.ts`、`finance.service.ts`、`finance.integration-spec.ts`、`api-design.md`、`api-design-inventory-finance.md`、`backend-error-format.md`、`agent-log-backend.md`。

### 2026-03-13 23:40（BACKEND-INSTRUCTIONS 本輪執行，選配已具）
- 做了：**①** **jest 65 passed** 全綠；purchase.integration-spec teardown 符合 §1。**②** 未執行 db:seed，保留既有完整 seed DB（見 db-seed.md）。**③** 維運確認：契約與 api-design 對齊；會員主檔 2.0／金流／CRM 已就緒。**選配**：階段 E（export CSV、recalc-tiers stub）、階段 G（jobs/:kind stub）、財務 Phase 4（GET /finance/balances stub）已於前輪實作，本輪無新增程式。
- 檔案：**agent-log-backend.md** 本則追加。

### 2026-03-13 24:00（BACKEND-INSTRUCTIONS 選配與待開發表全做）
- 做了：**①** **jest 65 passed** 全綠。**②** 未執行 db:seed。**選配＋待開發表** — **TierRule**：Schema + migration **20260318200000_add_tier_rule**；**TierRuleService** list/create/update/delete；**GET/POST/PATCH/DELETE /crm/tier-rules**（Admin）；**POST /crm/recalc-tiers**（Admin）body **merchantId** 必填，依 TierRule **SPEND_SUM** 區間內訂單總額更新 Customer.memberLevel；**CRM_RECALC_MERCHANT_REQUIRED**。**Segment 條件擴充**：preview 支援 **conditions.tag**（記憶體篩 tags 陣列）。**GET /finance/balances** 實作：依 FinanceEvent 重算 receivable（SALE_RECEIVABLE−SALE_PAYMENT−SALE_REFUND）、payable（PURCHASE_PAYABLE−PURCHASE_RETURN）；**finance.repository** balancesByPartyId；api-design-inventory-finance 標 stable。**採購取消規則**：api-design-purchase 補「取消規則」DRAFT/ORDERED 可 cancel。**盤點 referenceId 防呆**：**recordInventoryEvent** 對 **STOCKTAKE_GAIN/LOSS** 且未 skipReferenceIdCheck 時拒絕重複 referenceId；**INVENTORY_REFERENCE_ID_DUPLICATE**；批次匯入傳 **skipReferenceIdCheck: true**。**Imports 限流**：API-DECISIONS-bulk §5 已載明 10/分。**deploy-preview** 補「有 DB 時 CI 一鍵綠」。
- 檔案：`schema.prisma`、`migrations/20260318200000_add_tier_rule`、`tier-rule.service.ts`、`crm.controller.ts`、`crm.module.ts`、`segment.service.ts`、`finance.repository.ts`、`finance.service.ts`、`finance.integration-spec.ts`、`inventory.service.ts`、`api-design.md`、`api-design-purchase.md`、`api-design-inventory-finance.md`、`backend-error-format.md`、`deploy-preview.md`、`agent-log-backend.md`。

### 2026-03-13 15:30（BACKEND-INSTRUCTIONS 必做 + 選配 Phase 1：GET segments、分群發券 job）
- 做了：**①** **jest 67 passed** 全綠；purchase.integration-spec teardown 符合 §1。**②** 未執行 db:seed，保留既有 DB（見 db-seed.md）。**③** 維運：契約與 api-design 對齊；**GET /crm/segments** 列表、**POST /crm/jobs/:kind** 實作、**GET /crm/jobs/:id** 已就緒。**選配 Phase 1** — **GET /crm/segments**（query merchantId 必填、page、pageSize；response items、total；§6.8.0 標 stable）；**CrmMarketingJob**＋**LoyaltyCouponIssue** 表與 migration **20260319100000_crm_marketing_job_coupon_issue**；**POST /crm/jobs/:kind** 由 stub 改實作（body merchantId、segmentId、couponId｜couponCode；kind＝segment-coupon｜birthday-coupon｜repurchase-coupon；202 jobId、非同步發券寫入 LoyaltyCouponIssue）；**GET /crm/jobs/:id**（status、result、error）；**backend-error-format** 補 CRM_MERCHANT_REQUIRED、CRM_JOB_*；**crm.integration-spec** listSegments 兩則。
- 檔案：`segment.service.ts`、`segment.controller.ts`、`crm-job.service.ts`、`crm.controller.ts`、`crm.module.ts`、`schema.prisma`、`migrations/20260319100000_crm_marketing_job_coupon_issue`、`crm.integration-spec.ts`、`api-design.md`、`backend-error-format.md`、`agent-log-backend.md`。

### 2026-03-13 16:45（選配全做：發券規則常駐、Phase 2 報表、Phase 3 關帳／Audit／快照）
- 做了：**jest 67 passed** 全綠。**發券規則常駐** — **CrmCouponDispatchRule** 表；**GET/POST/PATCH/DELETE /crm/dispatch-rules**（merchantId、name、segmentId、couponId、enabled、scheduleType、cronExpr、nextRunAt）；**DispatchRuleService**、backend-error-format CRM_DISPATCH_*。**Phase 2** — **GET /loyalty/reports/activity**（merchantId、from、to、preset、groupBy；participations、couponUsage、pointsCostEstimate、couponUsageByCoupon）；api-design §6.8.2 標 stable。**Phase 3** — **FinancePeriodClose**、**FinanceAuditLog** 表；**recordFinanceEvent** 關帳檢查（已關帳區間含該日 → FINANCE_PERIOD_CLOSED）及成功後寫入 Audit；**POST /finance/periods/close**、**GET /finance/periods**、**POST /finance/periods/:id/unlock**；**GET /finance/audit-log**（eventId、from、to、actor）；**POST /finance/snapshots**（asOfDate、type: daily｜monthly；回傳 path、generatedAt、summary）；無新表時 hasClosedPeriodContaining／createAuditLog 降級不報錯。migration **20260319120000_phase2_3_crm_finance**。
- 檔案：`schema.prisma`、`migrations/20260319120000_phase2_3_crm_finance`、`dispatch-rule.service.ts`、`crm.controller.ts`、`crm.module.ts`、`loyalty.service.ts`、`loyalty.controller.ts`、`finance.repository.ts`、`finance.service.ts`、`finance.controller.ts`、`api-design.md`、`backend-error-format.md`、`agent-log-backend.md`。

### 2026-03-13 17:00（BACKEND-INSTRUCTIONS 本輪必做）
- 做了：**①** **jest 67 passed** 全綠；purchase.integration-spec teardown 符合 §1。**②** 未執行 db:seed，保留既有 DB（見 db-seed.md）。**③** 維運確認：契約與 api-design 對齊；Phase 1～3 與前端對接 API 已就緒。
- 檔案：**agent-log-backend.md** 本則追加。

### 2026-03-13 17:30（選配全做：POS 報表、發券排程、維運）
- 做了：**jest 67 passed** 全綠。**選配＋待開發 1～6** — **POS 報表**：**GET /pos/reports/summary** 擴充 query **preset**（today｜last7d｜last30d｜currentMonth｜last60d｜lastHalfYear）或 **from**／**to**、**storeId**；回傳 **period**、**byPaymentMethod**、**byCategory**；**GET /pos/reports/top-items**（from、to、storeId、limit、sortBy=quantity｜revenue）；**GET /pos/reports/daily**（from、to、storeId；byDay）；api-design-pos §4.4 新增。**發券規則排程**：**DispatchRuleRunnerService** 掃 **CrmCouponDispatchRule** enabled=true、scheduleType daily｜weekly｜monthly、nextRunAt≤now；觸發 **segment-coupon** job 並更新 **nextRunAt**；**POST /crm/jobs/run-scheduled**（Admin）供 cron 或手動呼叫。**維運**：Phase 1～3 與前端對接無缺；契約註記 §4.4。
- 檔案：`pos-reports.service.ts`、`pos-reports.controller.ts`、`dispatch-rule-runner.service.ts`、`crm.controller.ts`、`crm.module.ts`、`api-design-pos.md`、`agent-log-backend.md`。

### 2026-03-13 18:00（待開發 7：Loyalty／會員報表 API 進階）
- 做了：**jest 67 passed** 全綠。**GET /loyalty/reports/activity** 擴充 **preset**（today｜last7d｜last30d｜currentMonth｜last60d｜lastHalfYear）與 **from**／**to** 區間；回傳加 **period**。**GET /loyalty/reports/members**（Admin）— 會員報表進階：query merchantId、from、to、preset；回傳 newMembersCount、pointsEarned、pointsBurned、couponIssuedCount、membersWithPointsCount、byMemberLevel；api-design §6.8.2 補契約。
- 檔案：`loyalty.service.ts`、`loyalty.controller.ts`、`api-design.md`、`agent-log-backend.md`。

### 2026-03-16 18:30（BACKEND-INSTRUCTIONS 本輪：CI 一鍵綠命令 + 迴歸）
- 做了：在 monorepo 根新增 **`pnpm ci:backend-with-db`** 一鍵命令，內含 **`pnpm --filter pos-erp-backend exec prisma migrate deploy` → `pnpm db:seed` → `pnpm --filter pos-erp-backend test`**，並於 **deploy-preview.md**「有 DB 時 CI 一鍵綠」一節明確說明使用情境（僅測試／Preview、`DATABASE_URL` 已設）與「若不想 wipe DB 可分步執行」的備註。本輪實際執行 **`pnpm --filter pos-erp-backend test`**，**jest 67 passed** 全綠；未於本機執行 `migrate deploy`／`db:seed`，沿用既有 seed 完整 DB。
- 檔案：`package.json`（monorepo 根 scripts）、`docs/deploy-preview.md`、`docs/agent-collab/agent-log-backend.md`。

### 2026-03-16 19:00（BACKEND-INSTRUCTIONS 本輪：POS 報表 spec + 排程說明 + 迴歸）
- 做了：依 **`api-design-pos.md` §4.4** 為 POS 報表 API 補上一組整合測試 **`pos-reports.integration-spec.ts`**（summary／top-items／daily 皆在有 DB 環境下實際建單後驗證 period、KPI、排行與按日彙總），確保與既有實作一致。於 **`deploy-preview.md`** 新增「後端定時工作與排程」段落，說明 **`POST /crm/jobs/run-scheduled`** 發券排程、**`POST /finance/periods/close` / `POST /finance/periods/:id/unlock`** 關帳解鎖與 **`POST /finance/snapshots`** 快照的建議頻率與監控要點。變更後再跑一輪 **`pnpm --filter pos-erp-backend test`**，**jest 70 passed** 全綠；本輪未執行 `migrate deploy`／`pnpm db:seed`，沿用既有完整 seed DB。
- 檔案：`backend/src/modules/pos/pos-reports.integration-spec.ts`、`docs/deploy-preview.md`、`docs/agent-collab/agent-log-backend.md`。

### 2026-03-16 20:15（BACKEND-INSTRUCTIONS §1 六項全做 + 驗收）
- 做了：**① ci:backend-with-db**：本機執行時因 DB 存在 **failed migration（P3009）** 未通過，於 agent-log 註明；**②** **deploy-preview.md** 新增「常見錯誤與排除」小節（seed 失敗、連線逾時、權限不足、migration P3009、Jest 資料衝突）。**③** **POS 與 Finance 報表 cross-check**：**pos-reports.integration-spec** 新增「POS summary 與 Finance summary 同區間一致」及「summary 當 from＞to 拋 REPORT_INVALID_RANGE」兩則。**④** 報表錯誤碼與契約：**backend-error-format.md** 補 **REPORT_INVALID_RANGE**／**REPORT_RANGE_TOO_LARGE**；**pos-reports.service** 對 from/to 驗證並拋錯；**api-design-pos.md** §4.4、**api-design-inventory-finance.md** 補錯誤碼說明。**⑤** **job 狀態**：新增 **OpsJobRunLog** 表（migration **20260320100000_ops_job_run_log**）、**OpsModule**（OpsService.recordRun／getStatus）、**GET /ops/jobs/status**；**run-scheduled**／**closePeriod**／**createSnapshot** 執行後寫入紀錄。**⑥** **deploy-preview** 補「如何查看 job 狀態」（GET /ops/jobs/status）與「如何手動補跑」步驟。另修正 **generateOrderNumber** 加隨機尾碼避免並行測試 orderNumber 衝突。**jest 72 passed** 全綠；本輪未執行 **db:seed**（保留既有 DB）；purchase.integration-spec teardown 符合 §1。
- 檔案：`deploy-preview.md`、`backend-error-format.md`、`api-design-pos.md`、`api-design-inventory-finance.md`、`pos-reports.service.ts`、`pos-reports.integration-spec.ts`、`schema.prisma`、`migrations/20260320100000_ops_job_run_log`、`ops/*`、`crm.controller.ts`、`crm.module.ts`、`finance.controller.ts`、`finance.module.ts`、`app.module.ts`、`pos.service.ts`、`agent-log-backend.md`。

### 2026-03-17 18:20（盤點後端缺口計畫，無新程式變更）
- 做了：依 **docs/progress/integrated-last-cycle.md**、`BACKEND-INSTRUCTIONS.md` §1 與 `api-design-*.md`、`crm-member-roadmap.md` 重新盤點整體後端模組（CRM／Loyalty／POS 報表／Inventory／Finance／Purchase／Ops），整理出「POS 報表錯誤碼與契約」「Finance 報表區間驗證」「Job 狀態查詢與 deploy-preview 文件」等缺口計畫並確認截至 2026-03-20 的程式與文件實作皆已補齊（包含 REPORT_INVALID_RANGE／REPORT_RANGE_TOO_LARGE、OpsJobRunLog + GET /ops/jobs/status 等）。本輪僅為規格與現況比對，**未修改任何後端程式或 migration，亦未重跑 jest／migrate／seed**。
- 檔案：`docs/progress/integrated-last-cycle.md`、`docs/tasks/BACKEND-INSTRUCTIONS.md`、`docs/api-design*.md`、`docs/api-design-pos.md`、`docs/api-design-inventory-finance.md`、`docs/api-design-purchase.md`、`docs/crm-member-roadmap.md`、`docs/deploy-preview.md`、`docs/backend-error-format.md`、`docs/agent-collab/agent-log-backend.md`。
### 2026-03-17 21:30（BACKEND-INSTRUCTIONS 本輪：ci:backend-with-db 嘗試 + B7～B12／Ops job 迴歸）
- 做了：依 BACKEND-INSTRUCTIONS §1 在本機實際執行 **`pnpm ci:backend-with-db`**；指令本身已於前輪新增並含 `migrate deploy → db:seed → test`，本輪執行時因目標 DB 先前存在 **failed migration（P3009, 20260313120000_add_pos_order_payment）**，Prisma `migrate deploy` 直接中止而未進入 seed／jest，此情境與 `deploy-preview.md`「常見錯誤與排除」中 P3009 說明一致，應在 **乾淨或已修復 failed migration 的 DB** 上使用一鍵命令（CI／新 Preview DB 可透過 `migrate reset` 或人工 resolve 後再跑）。同一環境下再跑一輪 **`pnpm --filter pos-erp-backend test`**，**12 suites / 78 tests 全綠**，涵蓋先前 B7～B12（批次效期、補貨建議、TierRule rolling window、POINTS_MULTIPLIER）以及 **OpsJobRunLog + GET /ops/jobs/status** 相關 integration-spec，確認存貨批次／效期、補貨建議、TierRule、加倍點數與 job 狀態查詢在現行 schema 上都穩定通過。
- 測試：`pnpm ci:backend-with-db` 因既有 DB 內 failed migration（P3009）中止；`pnpm --filter pos-erp-backend test` **全綠（78 passed, 12 suites）**。
- 檔案：本輪無新增程式或文件；僅執行命令與驗證現有 B7～B12／Ops 路徑測試結果，並於本檔記錄行為與限制。

### 2026-03-17 22:30（BACKEND-INSTRUCTIONS 本輪：ci/seed 一鍵綠限制說明 + B7～B12／Finance balances 驗收）
- 做了：針對 **§1.1 三項必做** 實際執行與驗收：**① ci／seed 一鍵綠** — 嘗試以 `prisma migrate reset --force` 修復舊有 failed migration 時，發現 migration `20260313120000_add_pos_order_payment` 依賴的 `PosOrder` 並未由任一 migration 建表，導致在「完全空白的 DB 僅跑 migrate」情境下會以 **P3018 + 42P01 relation \"PosOrder\" does not exist** 失敗；本輪改以 `prisma db push` 將 schema 同步到本機測試 DB，再執行 `pnpm db:seed`（wipe + full demo）與 `pnpm --filter pos-erp-backend test`，確認在「以 db push 建表 + seed 的測試 DB」上一鍵測試可穩定跑綠，但**純靠 migrate deploy 無法從零建立完整 schema**。建議後續若要在 CI 上完全依賴 migrate，需要補一組 baseline migration（含 PosOrder 與早期表結構），本輪僅記錄限制與建議，未改動既有 migration 檔。**② B7～B12／OpsJobRunLog 迴歸** — 在完成 db push + seed 後再次執行 `pnpm --filter pos-erp-backend test`，12 suites / 78 tests 全綠，覆蓋 B7/B8 批次效期（`inventory.integration-spec.ts` / `purchase.integration-spec.ts`）、B9 補貨建議（`GET /inventory/replenishment-suggestions`）、B10 TierRule rolling window + `POST /crm/recalc-tiers`、B11 POINTS_MULTIPLIER 加倍點數、B12 Party 抽象相關 summary，以及 OpsJobRunLog + `GET /ops/jobs/status` 路徑。**③ Finance 應收應付餘額 API** — 對照 `docs/api-design-inventory-finance.md`，確認 `GET /finance/balances` 匯入 `finance.controller.ts` / `finance.service.ts` / `finance.repository.ts` 之實作已符合 `{ items: [{ partyId, receivable, payable }] }` 與 `partyId` 選填契約，並在 `finance.integration-spec.ts` 內將最後一則測試改為「為兩個唯一 partyId 建立 SALE_RECEIVABLE／SALE_PAYMENT／PURCHASE_PAYABLE 事件 → 驗證 getBalances({}) 的彙總金額，以及 getBalances({ partyId }) 僅回該 party 一筆」；測試內部以 `prisma.financeEvent.deleteMany` 依 partyId 清理自建資料。
- 測試：`pnpm --filter pos-erp-backend test` **12 suites / 78 tests 全綠**；本輪實際執行了 `pnpm db:seed`（wipe + full demo），確認 seed 劇本在 db push 建表後可正常跑完；`pnpm ci:backend-with-db` 仍因「migrate 無法從零建立 PosOrder 等早期表」在 migrate 階段失敗，適合作為已知限制記錄於本檔與 deploy-preview，而非在本輪強行調整歷史 migration。
- 後續建議：若未來要在 CI／新 Preview DB 完全依賴 `pnpm ci:backend-with-db`，需安排一次性 schema baseline（例如補一個建立所有既有表的 migration，或在新環境初始化時先跑 `prisma db push` 再讓 `ci:backend-with-db` 負責之後的變更），並於 `deploy-preview.md` 補充「從零建庫」腳本；現階段在本機／測試環境可沿用「db push 建表 → db:seed → jest」流程驗證功能，且 B7～B12／Finance balances／Ops job 路徑已有穩定整合測試覆蓋。

### 2026-03-17 23:43（B7/B8/B9：效期批次 + 補貨建議）
- 做了：**B7/B8** — Prisma schema + migration 新增 `InventoryEvent`／`ReceivingNoteLine` 的 **batchCode/expiryDate/weightUnit**；`ReceivingNoteService.patchLines/complete` 串接批次與效期；`GET /inventory/expiring` 改用 raw SQL 聚合（避免 Prisma client 尚未更新造成阻塞），並補 `inventory.integration-spec` 與 `purchase.integration-spec` 覆蓋「進貨驗收帶批次/效期 → expiring 查得到」。**B9** — 實作 **GET /inventory/replenishment-suggestions**（近 N 天 `SALE_OUT` 推估 avgDailySales + safetyDays 計算 suggestedQty），並補整合測試。
- 測試：`pnpm --filter pos-erp-backend test` **全綠（75 passed）**；新增測試皆含 teardown 清理自建資料。
- 檔案：`docs/api-design-inventory-finance.md`、`docs/api-design-purchase.md`、`backend/prisma/schema.prisma`、`backend/prisma/migrations/20260320110000_inventory_batch_expiry/migration.sql`、`backend/src/modules/inventory/*`、`backend/src/modules/purchase/application/receiving-note.service.ts`、`backend/src/modules/inventory/inventory.integration-spec.ts`、`backend/src/modules/purchase/purchase.integration-spec.ts`。

### 2026-03-17 23:50（B10：TierRule rolling window + recalc-tiers 穩定化）
- 做了：在 `api-design.md` 明定 TierRule **lookbackDays rolling window**（以 now 往前回溯、用 `PosOrder.createdAt`；多規則取最高 threshold，不自動降級）。`TierRuleService.recalcTiers` 改為以 merchant 的 `storeIds` 篩訂單、Decimal 以 `toNumber()` 安全轉換、更新條件可覆蓋 `memberLevel=null`，並確保 updated 計數只算實際變更。`crm.integration-spec` 新增 recalcTiers 整合測試（GOLD/VIP 兩規則、最高門檻優先、lookbackDays 排除舊單）。
- 測試：`pnpm --filter pos-erp-backend test` **全綠（76 passed）**。
- 檔案：`docs/api-design.md`、`backend/src/modules/crm/application/tier-rule.service.ts`、`backend/src/modules/crm/crm.integration-spec.ts`。

### 2026-03-17 23:59（B11：Promotion memberLevel + 加倍點數）
- 做了：促銷引擎新增 action **`POINTS_MULTIPLIER`**（取套用規則中最大倍率，預設 1；不影響折扣），`PromotionService.preview` 回傳 `pointsMultiplier`；`PosService.createOrder` 依該倍率呼叫 `LoyaltyService.recordEarnedFromOrder` 以加倍贈點；`api-design-loyalty.md` §5 補「加倍點數」契約；新增促銷引擎單元測試與 POS 整合測試（VIP 2x 點數）。
- 測試：`pnpm --filter pos-erp-backend test` **全綠（78 passed）**。
- 檔案：`backend/src/modules/promotion/application/promotion-engine.ts`、`promotion.service.ts`、`backend/src/modules/pos/application/pos.service.ts`、`backend/src/modules/loyalty/application/loyalty.service.ts`、`backend/src/modules/pos/pos-create-order.integration-spec.ts`、`docs/api-design-loyalty.md`、`backend/src/modules/promotion/application/promotion-engine.spec.ts`。

### 2026-03-17 00:01（B12：Finance Party 多方應收應付設計草案）
- 做了：在 `api-design-inventory-finance.md` 補上 **Party（多方）抽象**（`partyId` 建議前綴格式 `${kind}:${refId}`、未來可演進到 Party 表），並新增「單一訂單拆多筆 FinanceEvent」之多方情境草案（平台代收/抽成、客印代工等）。`api-design.md` finance 章節補引用該草案位置，方便全站索引。
- 測試：文件更新，不影響程式；另跑 `pnpm --filter pos-erp-backend test` 仍全綠（78 passed）。
- 檔案：`docs/api-design-inventory-finance.md`、`docs/api-design.md`。

### 2026-03-17 23:55（BACKEND-INSTRUCTIONS 本輪五項全做：finance doc、Product schema、ProductTag CRUD）
- 做了：依 **§1.1 五項必做** 執行：**① ci／seed 一鍵綠** — `pnpm ci:backend-with-db` 仍因 P3009 failed migration 中止，沿用既有 agent-log 說明；**② B7～B12 穩定性** — `pnpm --filter pos-erp-backend test` 全綠（80 passed, 13 suites）；**③ Finance balances 契約** — 更新 **finance-accounting-roadmap.md §9.1** 將「應收應付餘額表／API」改為 **已實作**，註明 GET /finance/balances 回傳格式與 partyId 查詢；**④ Product schema 擴充** — migration `20260321120000_product_spec_fields` 新增 `specCapacity`、`specStyle`、`specWeight`、`expiryDescription`，保留 `specColor`、`weightGrams` 並標棄用；`product.service.ts`、`product.repository.ts`、`product.controller.ts` 與 CSV import 納入新欄位；`api-design.md` 產品章節更新；**⑤ ProductTag CRUD** — 新增 ProductTag 模型與 migration `20260321130000_product_tag`，實作 `GET/POST/PATCH/DELETE /product-tags`（merchantId 必填、Admin Key）；`product-tag.integration-spec.ts` 兩則（list+create、update+delete）含 teardown；`backend-error-format.md`、`api-design.md` §6.1a 補 ProductTag 契約與錯誤碼。
- 測試：`pnpm --filter pos-erp-backend test` **13 suites / 80 tests 全綠**；`pnpm db:seed` 執行成功，與新 Product 欄位及 ProductTag 表相容；`pnpm ci:backend-with-db` 仍因 migrate P3009 未通過，見前述限制。
- 檔案：`docs/finance-accounting-roadmap.md`、`backend/prisma/schema.prisma`、`migrations/20260321120000_product_spec_fields`、`migrations/20260321130000_product_tag`、`product.service.ts`、`product.repository.ts`、`product.controller.ts`、`modules/product-tag/*`、`api-design.md`、`backend-error-format.md`、`app.module.ts`。

### 2026-03-17 00:15（BACKEND-INSTRUCTIONS §1 本輪五項）
- 做了：**① seed 補 ProductTag** — wipeAll 加入 `productTag.deleteMany()`；建立 3 筆示範（熱銷、新品、清倉）；`db-seed.md` 補 ProductTag 區塊。**② 補貨→PO 草稿 API** — `api-design-purchase.md` 補 `POST /purchase-orders/from-replenishment` 契約；`PurchaseOrderService.createFromReplenishment`、controller 路由；`purchase.integration-spec` 一則。**③ finance-accounting-roadmap §9 修正** — §9.1 GET /finance/summary 改為已實作；§9.2 type／partyId 篩選、彙總區塊改為已實作（後端 API 已支援）。**④ deploy-preview 從零建庫指引** — 常見錯誤表補「從零建庫或 P3009 無法 resolve」替代流程（db push → db:seed → jest）。**⑤ GET /ops/jobs 擴充** — `OpsService.listJobs`、`GET /ops/jobs` 分頁與 kind 篩選；deploy-preview 補契約；`ops.integration-spec.ts` 一則。
- 測試：`pnpm --filter pos-erp-backend test` **14 suites / 82 tests 全綠**；`pnpm db:seed` 執行成功。
- 檔案：`seed.ts`、`db-seed.md`、`api-design-purchase.md`、`purchase-order.service.ts`、`purchase-order.controller.ts`、`purchase.integration-spec.ts`、`finance-accounting-roadmap.md`、`deploy-preview.md`、`ops.service.ts`、`ops.controller.ts`、`ops.integration-spec.ts`。

### 2026-03-17 22:45（BACKEND-INSTRUCTIONS §1 本輪五項全做）
- 做了：**①** jest 84 passed 全綠；db:seed、e2e:seed 可跑。**②** deploy-preview 補「ci:backend-with-db 仍受 P3009 限制」與從零建庫替代流程說明。**③** Party 模型、Finance balances 升級：GET /finance/balances 回傳 displayName、kind；query kind=customer｜supplier；前綴解析或 Customer/Supplier 查詢；api-design-inventory-finance §5.0d；finance.integration-spec 補 displayName、kind 篩選測試。**④** 報表穿透：api-design-inventory-finance、api-design-pos、api-design-loyalty 補 referenceId 跨模組連結說明。**⑤** 活動成效報表擴充：GET /loyalty/reports/activity 新增 byDispatchRule、byCoupon、revenueFromPointRedemption；api-design §6.8.2；loyalty.integration-spec 補 activity 擴充情境。
- 檔案：deploy-preview.md、api-design-inventory-finance.md、finance.repository.ts、finance.service.ts、finance.controller.ts、finance.integration-spec.ts、api-design-pos.md、api-design-loyalty.md、api-design.md、loyalty.service.ts、loyalty.integration-spec.ts。

### 2026-03-17 00:45（BACKEND-INSTRUCTIONS §1：E2E fixture 分離與 seed 純化）
- 做了：**① 建立獨立 E2E setup** — `backend/scripts/e2e-seed.ts` 對 E2E 客戶 upsert（id 固定、code E2E）；npm script `e2e:seed`。**② seed.ts 純化** — 移除 E2E_CUSTOMER_ID、E2E 客戶建立；DEMO-POS-002（賒帳）改為 VIP001；CustomerContactLog 改為 VIP001；PointLedger 移除 E2E 列、VIP001 納入 order2 贈點。**③ db-seed.md** — E2E 改由 e2e-seed 建立，會員表更新。**④ E2E 流程** — e2e-local.sh、e2e-one-click.sh、e2e-pos.md 補 e2e:seed 步驟說明。
- 測試：`pnpm --filter pos-erp-backend test` **82 tests 全綠**；`pnpm db:seed` 成功（19 客戶）；`pnpm e2e:seed` 成功。
- 檔案：`backend/scripts/e2e-seed.ts`、`backend/package.json`、`package.json`、`seed.ts`、`db-seed.md`、`scripts/e2e-local.sh`、`scripts/e2e-one-click.sh`、`docs/e2e-pos.md`。

### 2026-03-17 23:50（BACKEND-INSTRUCTIONS §1 五項全做）
- 做了：**① 迴歸維護** — `pnpm --filter pos-erp-backend test` **87 tests 全綠**；`pnpm db:seed` 成功。**② ci:backend-with-db 穩定** — deploy-preview 已載明 P3009 限制與從零建庫替代流程。**③ 毛利分析 API** — GET /pos/reports/summary 新增 totalCost、grossMargin、grossMarginRate（pos-reports.service、pos-reports.integration-spec）。**④ 促銷成效追蹤 API** — GET /promotion-rules/effectiveness（merchantId、from/to/preset；items 含 ruleId、ruleName、triggerCount、discountTotal、drivenRevenue）；api-promotion-rules.md；promotion.integration-spec。**⑤ 滯銷品 API** — GET /inventory/slow-moving（lookbackDays、salesThreshold、onHandThreshold）；inventory.service、controller、api-design-inventory-finance §4.3e；inventory.integration-spec。
- 測試：`pnpm --filter pos-erp-backend test` **87 passed**；`pnpm db:seed` 成功。
- 檔案：`pos-reports.service.ts`、`pos-reports.integration-spec.ts`、`api-design-pos.md`、`promotion.service.ts`、`promotion.controller.ts`、`promotion.integration-spec.ts`、`api-promotion-rules.md`、`inventory.service.ts`、`inventory.controller.ts`、`inventory.integration-spec.ts`、`api-design-inventory-finance.md`。

### 2026-03-17 00:15（BACKEND-INSTRUCTIONS §1 本輪五項全做）
- 做了：**① 迴歸維護** — `pnpm --filter pos-erp-backend test` **90 tests 全綠**；`pnpm db:seed` 成功。**② ci:backend-with-db 穩定** — deploy-preview 補「clean DB 可跑時優先使用」；package.json 新增 `ci:backend-with-db-fallback`（db push → seed → test）。**③ 批次改價 API** — PATCH /products/batch-price（body productIds[]、salePrice）；api-design §6.3a；product.service、controller、product.integration-spec。**④ 庫存多品多倉盤點 API** — POST /inventory/events/batch-stocktake（warehouseId、lines[{ productId, actualQty }]）；api-design-inventory-finance §4.1c；inventory.service、controller、inventory.integration-spec。**⑤ 操作捷徑 API** — GET /products/:id?includeBalances=true 回傳 balances；GET /purchase-orders/:id 回傳 receivingProgress（totalOrdered、totalReceived、percentComplete、fullyReceivedLinesCount）；api-design、api-design-purchase；product.integration-spec、purchase.integration-spec。
- 測試：`pnpm --filter pos-erp-backend test` **90 passed**；`pnpm db:seed` 成功。
- 檔案：`package.json`、`deploy-preview.md`、`product.service.ts`、`product.controller.ts`、`product.integration-spec.ts`、`inventory.service.ts`、`inventory.controller.ts`、`inventory.integration-spec.ts`、`purchase-order.service.ts`、`purchase.integration-spec.ts`、`api-design.md`、`api-design-inventory-finance.md`、`api-design-purchase.md`。

### 2026-03-17 00:40（BACKEND-INSTRUCTIONS §1 迴歸再驗收：測試隔離修正）
- 做了：修正整合測試 teardown 隔離：`promotion.integration-spec.ts` 刪 merchant 前補刪 customer；`inventory.integration-spec.ts` 刪 merchant 前補刪 customer；`finance.integration-spec.ts` 不再依賴 `findFirst` 的共用 merchant，改為測試內自建 merchant 並清理。重新跑 `pnpm --filter pos-erp-backend test` 回到 **90 passed**；`pnpm db:seed` 成功。
- 檔案：`promotion.integration-spec.ts`、`inventory.integration-spec.ts`、`finance.integration-spec.ts`、`agent-log-backend.md`。

### 2026-03-17 22:42（BACKEND-INSTRUCTIONS §1 十項全做）
- 做了：**① 迴歸維護** — `pnpm --filter pos-erp-backend test` 全綠（15 suites / 95 tests）。**② ci:backend-with-db 穩定（P3009）** — 新增 baseline migration `20260312000000_baseline`，舊 migrations squash 成 no-op，`pnpm ci:backend-with-db` 可走 `migrate deploy → db:seed → test` 一鍵綠。**③ 顧客消費洞察（指標）** — `GET /customers/:id` 追加 `insights`（lastOrder/totalSpend/ordersLast30d/avgDaysBetweenOrders/preferredCategories），並更新 `api-design.md` + `customer.integration-spec`。**④ 顧客洞察效能** — 補索引（`PosOrder(customerId, createdAt)`、`PosOrderItem(orderId/productId)`、`Product(categoryId)`）並建立 migration `20260317142456_customer_insights_indexes`。**⑤ 快速進貨（API）** — 新增 `POST /purchase-orders/quick-receive` 一鍵建立 PO+RN+complete，寫入 `PURCHASE_IN` + `PURCHASE_PAYABLE`；更新 `api-design-purchase.md` + `purchase.integration-spec`。**⑥ 快速進貨（防呆）** — qty<=0 等回 `RN_COMPLETE_INVALID`；`backend-error-format.md` 補 `PO_MERCHANT_MISMATCH`。**⑦ 掃碼盤點（API）** — 新增 `POST /inventory/events/scan-stocktake`（sku→productId→batch-stocktake）；更新 `api-design-inventory-finance.md` + `inventory.integration-spec`。**⑧ barcode 支援** — Product 新增 `barcode`（unique）與 migration `20260317150000_product_barcode`，盤點 API 支援 sku 或 barcode；`api-design.md` 產品章節更新。**⑨ 供應商績效 API** — `GET /suppliers/:id` 追加 `kpis`（交貨天數/準時率、退貨率）；更新 `api-design-purchase.md` + `purchase.integration-spec`。**⑩ 棄用欄位清理** — `specColor`、`weightGrams` 從 Product API 回傳排除（仍保留寫入相容），`api-design.md` 更新。\n+- 測試：`pnpm ci:backend-with-db` 全綠；`pnpm --filter pos-erp-backend test` 全綠；`pnpm db:seed` 成功。

### 2026-03-17 23:12（BACKEND-INSTRUCTIONS §1：報表穿透／Ops 監控補強）
- 做了：**① 報表穿透契約收斂** — 在 `api-design-inventory-finance.md` / `api-design-loyalty.md` / `api-design-pos.md` 補統一規則與案例（referenceId UUID 判別）。**② 報表穿透後端補強** — 新增 `GET /ops/references/resolve?referenceId=` 回傳 `{ kind: posOrder|receivingNote|unknown }`，前端可單點解析穿透目標；補 `ops.integration-spec` 覆蓋。**③ Ops Job 監控進階** — `GET /ops/jobs` 增加 `from/to`（createdAt 區間）與 `messageSummary`（200 字截斷 + …），同步更新 `ops-roadmap.md` 與整合測試覆蓋。**④ 回歸修正** — 修正 `pos-reports.integration-spec` SKU 唯一鍵偶發衝突。\n+- 測試：`pnpm --filter pos-erp-backend test` 全綠（15 suites / 96 tests）；`pnpm --filter pos-erp-backend db:seed` 成功。

### 2026-03-18 12:00（BACKEND-INSTRUCTIONS 001：Phase 2 能力全做）
- 做了：**① 報表穿透 2.0** — 新增 `ReportClickAudit`（Prisma model + migration）與 `POST /ops/reports/click-audit`（Admin Key），補 ops 文件與整合測試；`backend-error-format.md` 補 `OPS_REPORT_CLICK_AUDIT_INVALID`。**② CI/Preview 健檢** — 新增 `pnpm ci:schema-migration-check`（自動建立 shadow DB，跑 `prisma validate` + `migrate diff`），`deploy-preview.md` 補成功條件；並修正 schema drift（移除重複 `@@index([barcode])`）。**③ Party Phase 2** — `GET /finance/balances` 擴充 page/pageSize/total/totals；補 finance tests 與契約更新。**④ 多商家 Phase 2** — Finance balances / POS reports / Loyalty activity 以 `merchantId` 做隔離並補錯誤態／整合測試。**⑤ Loyalty 活動成效 v2** — 增加 `avgCouponUsagePerParticipation`、`avgPointsCostPerParticipation` 與測試、文件。**⑥ 換貨 Phase 2** — `PosOrder.exchangeFromOrderId`（migration）＋ `POST /pos/orders` 支援帶入並於 `GET /pos/orders/:id` 回傳；補整合測試與 order-roadmap 更新。**⑦ 條碼契約** — 新增 `GET /products/search-barcode?q=`（精確比對），更新 `api-design.md` 與 scan-stocktake 文件，補 product integration tests。
- 測試：分別針對 ops/finance/pos-reports/loyalty/product/pos-create-order 跑整合測試皆通過。
