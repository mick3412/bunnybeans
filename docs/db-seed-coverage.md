# Seed 資料涵蓋檢查清單

本文件對應 `pnpm db:seed` 所建資料，確保**收銀端**與**後台**所有報表／表格都有內容可展示。

## 資料關聯性（非獨立孤島）

所有資料須具**業務關聯**，同一實體可跨表穿透：

### 訂單／金流／穿透
| 關聯鏈 | 說明 |
|--------|------|
| **POS 訂單 → 金流 → 穿透** | PosOrder.id = FinanceEvent.referenceId = ReportClickAudit.referenceId（點擊可導向訂單明細） |
| **驗收單 → 金流 → 穿透** | ReceivingNote.id = FinanceEvent.referenceId = ReportClickAudit.referenceId（點擊可導向驗收單） |
| **採購→驗收→庫存→即期** | PurchaseOrder → ReceivingNote（含 batchCode/expiryDate）→ InventoryEvent.referenceId = ReceivingNoteLine.id → PURCHASE_PAYABLE |
| **金流快照** | FinanceSnapshot.summaryJson 由當日 FinanceEvent 彙總（byType、byParty）與金流報表一致 |

### 客戶關聯
| 關聯鏈 | 說明 |
|--------|------|
| **客戶 → 訂單 → 金流** | PosOrder.customerId = Customer.id；FinanceEvent.partyId = `customer:${customerId}` |
| **客戶 → 點數存摺 → 訂單** | PointLedger.customerId + referenceId = PosOrder.id；會員訂單 013/014/016/018 有對應 EARNED |
| **客戶 → 折價券** | LoyaltyCouponIssue 連結 Customer ↔ LoyaltyCoupon；VIP 會員（林大戶）持有 WELCOME10、VIP50 |
| **客戶 → 客服紀錄** | CustomerContactLog.customerId = VIP001（林大戶） |
| **點數報表穿透** | ReportClickAudit source=loyalty-ledger，referenceId=PosOrder.id（點存摺可導向訂單） |
| **促銷活動套用** | PosOrder.promotionApplied 對應 PromotionRule；滿百折十／滿千折百 usageCount 與訂單數一致 |
| **折價券核銷** | LoyaltyCoupon.usedCount=1（VIP50 於訂單 016 核銷） |

---

## 數量與時間區段規範

- **每情境 ≥ 5 筆**：各情境至少 5 筆相關數據
- **報表時間區段**：today、last7d、last30d、last60d 均有足夠訂單／金流供 preset 篩選

### 時間分布（daysAgo = 執行當日往前 N 天）

| Preset | 區間 | Seed 訂單 |
|--------|------|-----------|
| today | 今日 | order1b、orderT1 |
| last7d | 近 7 日 | orderT1～T5、order1b、orderGold、orderMem1a、orderMem1b、orderMem2 等 |
| last30d | 近 30 日 | 涵蓋 daysAgo(0)～(29) 多筆 |
| last60d | 近 60 日 | 涵蓋 daysAgo(0)～(58) 多筆 |

## 商品路徑情境（進貨→銷售全流程）

| 情境 | 路徑 | 筆數 | Seed 對應 |
|------|------|------|-----------|
| **正常進貨→入庫→銷售** | PO → RN COMPLETED → PURCHASE_IN → SALE_OUT | 多筆 | DEMO-PO-FULL、黑/白 T 等 |
| **供應商不足／取消** | PO 向 INACTIVE 供應商 → CANCELLED | **5** | DEMO-PO-CANCEL1～5 |
| **整單退給供應商** | PO → RN RETURNED（不入庫） | **5** | DEMO-PO-RET1～5、DEMO-RN-RET1～5 |
| **部分退貨給供應商** | RN COMPLETED → RETURN_TO_SUPPLIER + PURCHASE_RETURN | **5** | rnPartial、rnFull、rnExpiring 共 5 筆 |
| **銷售退貨** | SALE_OUT → RETURN_FROM_CUSTOMER + SALE_REFUND | **5** | orderMem2、Mem1a、Gold、Mem5a、T2 |
| **換貨** | exchangeFromOrderId、SALE_REFUND 差額、RETURN_FROM_CUSTOMER + SALE_OUT | **5** | orderMem3、Mem1b、Mem2、Mem5a、014 → EX1～5 |

## 會員路徑情境（資料→促銷→點數→訂單）

| 情境 | 路徑 | 筆數 | Seed 對應 |
|------|------|------|-----------|
| **會員+訂單+贈點** | PosOrder → PointLedger EARNED | 多筆 | referenceId 對齊 |
| **會員+點數折抵** | PointLedger BURNED | **5** | custGold、custMem6、custMem1、custMem2、custMem5 |
| **會員+折價券持有** | LoyaltyCouponIssue | **5** | VIP001+WELCOME10、VIP001/002/MEM005/MEM010+VIP50 |
| **會員+折價券核銷** | LoyaltyCoupon.usedCount | 1 | VIP50 usedCount=1 |
| **會員+促銷套用** | PosOrder.promotionApplied | **5** | 001/011/023 滿百折十；016/025 滿千折百 |
| **會員+換貨** | exchangeFromOrderId、點數 | **5** | 5 筆換貨新單 |

## 收銀端（POS）

| 頁面／功能 | 資料需求 | Seed 對應 | 狀態 |
|------------|----------|-----------|------|
| POS 結帳 | Store、Warehouse、Product、庫存 | M001/S001/W001、24 商品、多 SKU 有庫存 | ✅ |
| POS 報表 (GET /pos/reports/summary) | PosOrder（近 60 天）、金額分散 | 30 筆 DEMO-POS-*-001～030 | ✅ |
| POS 訂單列表 | PosOrder、客戶 | 30 筆訂單、會員＋匿名客 | ✅ |
| POS 訂單明細 | PosOrder、items、payments | 每筆訂單含 items、payment | ✅ |
| 會員查詢／掛帳 | Customer、PointLedger | VIP001～MEM016、WALK01、點數 | ✅ |
| 條碼搜尋 | Product.barcode | e2e-seed 建立；db:seed 部分商品有 barcode | ⚠️ e2e:seed 補 E2E 條碼 |
| 促銷套用 | PromotionRule（draft=false） | 2 上架＋1 草稿 | ✅ |
| 折價券 | LoyaltyCoupon、LoyaltyCouponIssue | WELCOME10、VIP50 | ✅ |
| 商品即期篩選 | Product.expiryDescription、InventoryEvent.expiryDate | 規格欄位有填；即期批次見下 | ✅ |

## 後台（Admin）

### 儀表板／報表
| 頁面 | 資料需求 | Seed 對應 | 狀態 |
|------|----------|-----------|------|
| Admin 儀表板 | getPosReportsSummary、今日／近7日 | POS 訂單分散 60 天 | ✅ |
| 業績報表 (AdminReportsPage) | FinanceEvent、PosOrder | SALE_RECEIVABLE、SALE_PAYMENT 與訂單對齊 | ✅ |
| POS 報表 (PosReportsPage) | 同上 | 同上 | ✅ |
| 金流餘額 (AdminFinanceBalancesPage) | FinanceEvent、partyId | customer:/supplier:/STORE:WALKIN | ✅ |
| 金流稽核 (AdminFinanceAuditPage) | FinanceAuditLog | 依 FinanceEvent 寫入 | ⚠️ 視後端實作 |
| 關帳區間 (AdminFinancePeriodsPage) | FinancePeriodClose | **2 筆** demo CLOSED 區間 | ✅ |
| **金流快照** (AdminFinanceSnapshotsPage) | **FinanceSnapshot** | **5 筆** daily，由 FinanceEvent 彙總 | ✅ |

### 採購／驗收／庫存
| 頁面 | 資料需求 | Seed 對應 | 狀態 |
|------|----------|-----------|------|
| 採購單列表 | PurchaseOrder（多狀態） | DRAFT、ORDERED、PARTIALLY_RECEIVED、RECEIVED、CANCELLED | ✅ |
| 驗收單列表 | ReceivingNote（多狀態） | PENDING、IN_PROGRESS、COMPLETED、RETURNED | ✅ |
| **供應商採購排行** (AdminProcurementHubPage) | ReceivingNote COMPLETED、createdAt 在近 30 日內 | rnFull、rnPartial、rnExpiring 設定 **createdAt: daysAgo(5)**，確保「近 30 日」報表有示範資料 | ✅ |
| 庫存列表 | InventoryBalance、Product | 多 SKU 有庫存；低庫存 1、零庫存 0 | ✅ |
| **即期庫存** (AdminExpiringInventoryPage) | **InventoryEvent.batchCode+expiryDate** | **seed 已補 1 即期批次** | ✅ |
| 補貨建議 | onHandQty 低 + SALE_OUT 歷史 | DEMO-POS-REPL 銷售 pLowStock 1 單位 → SALE_OUT、庫存歸零 | ✅ |
| 快速驗收 | PO ORDERED、可選商品 | DEMO-PO-*-ORDERED | ✅ |

### 會員／CRM
| 頁面 | 資料需求 | Seed 對應 | 狀態 |
|------|----------|-----------|------|
| 會員列表 | Customer、等級、消費 | VIP/GOLD/NORMAL、M001～MEM016 | ✅ |
| 會員分群 | Segment | **5 筆**（全部、VIP、GOLD、NORMAL、多筆消費） | ✅ |
| 分群預覽 | Segment + Customer | 同上 | ✅ |
| 發券規則 | CrmCouponDispatchRule | **5 筆** | ✅ |
| 點數存摺 | PointLedger | EARNED、BURNED、EXPIRED | ✅ |
| 折價券 | LoyaltyCoupon、LoyaltyCouponIssue | 2 券 | ✅ |
| 客服紀錄 | CustomerContactLog | **5 筆** | ✅ |

### 收銀班次／營運
| 頁面 | 資料需求 | Seed 對應 | 狀態 |
|------|----------|-----------|------|
| **收銀班次** (AdminPosSessionsPage) | **CashRegisterSession** | **6 筆**（S002：2 OPEN、4 CLOSED），openedAt 分散過去 7 天 | ✅ |
| Ops 作業 (AdminOpsJobsPage) | OpsJobRunLog | **5 筆**（finance-snapshot、crm-run-scheduled、finance-period-close 等） | ✅ |
| **報表穿透審計** (AdminOpsReportClicksPage) | **ReportClickAudit** | **5 筆**（finance-events、loyalty-ledger、pos-reports） | ✅ |
| Bulk 匯入 | BulkImportJob | done / failed 各 1 | ✅ |

### 商品／行銷
| 頁面 | 資料需求 | Seed 對應 | 狀態 |
|------|----------|-----------|------|
| 商品列表 | Product、Category、Brand | 24 筆、6 類、4 品牌 | ✅ |
| 類別／品牌 | Category、Brand | 同上 | ✅ |
| ProductTag | ProductTag | 3 筆（熱銷、新品、清倉） | ✅ |
| 促銷規則 | PromotionRule | 2 上架＋1 草稿 | ✅ |

## 本 seed 補強項目（相對原 db-seed.md）

1. **FinanceSnapshot**：由當日 `order1Occurred` 之 FinanceEvent 彙總 `byType`、`byParty`，與金流報表數據一致
2. **ReportClickAudit**：referenceId 對應實際 PosOrder / ReceivingNote，source=finance-events（與金流報表穿透來源一致）
3. **即期庫存**：完整鏈路 `PO → RN (batchCode/expiryDate) → InventoryEvent.referenceId=ReceivingNoteLine.id` + PURCHASE_PAYABLE

## 已補強（本輪完成）

1. **CashRegisterSession**：6 筆（2 OPEN、4 CLOSED），供 AdminPosSessionsPage
2. **補貨建議**：DEMO-POS-REPL 銷售 DEMO-LOW-STOCK，建立 SALE_OUT
3. **OpsJobRunLog**：5 筆，供 AdminOpsJobsPage
4. **CrmMarketingJob**：2 筆 done，供 /admin/crm/jobs
5. **商品效期**：牧草／飼料／零食具可計算剩餘天數之欄位
6. **LoyaltyCouponIssue**：發券對象改為實際存在之會員 code（移除不存在的 GOLD001/GOLD002）

## 驗證指令

```bash
# 完整清除後重載（推薦）
pnpm db:reset

# 或僅重灌資料
pnpm db:seed
```

收銀：/pos、/pos/orders、/pos/reports  
後台：/admin/* 各頁逐一檢查；**行銷規則常駐**（`/admin/marketing/rules`）為 API placeholder，列表可為空屬預期
