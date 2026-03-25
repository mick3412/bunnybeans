# Seed 完整性驗證報告

**驗證日期**：2025-03-19（2025-03-23 補強）  
**依據**：`backend/prisma/seed.ts`、`docs/db-seed-coverage.md`、前端路由與頁面

---

## 一、驗證摘要

| 類別 | 結果 | 說明 |
|------|------|------|
| 資料關聯性 | ✅ 完整 | 訂單↔金流↔穿透、採購↔驗收↔庫存、客戶↔訂單↔點數等鏈路正確 |
| 報表／表格覆蓋 | ✅ 已補強 | CashRegisterSession、補貨建議、OpsJobRunLog、CrmMarketingJob 皆有 seed |
| 文檔一致性 | ⚠️ 1 項 | db-seed.md 寫 Segment 3 筆，實際 5 筆 |
| 可空表（設計許可） | ✅ | 無 |

---

## 二、已補強項目（2025-03-23）

### 1. OpsJobRunLog（Job 監控）

| 項目 | 說明 |
|------|------|
| **頁面** | `AdminOpsJobsPage` (`/admin/ops/jobs`) |
| **補強** | 新增 5 筆 OpsJobRunLog：finance-snapshot、crm-run-scheduled、finance-period-close，`lastRunAt` 分散近 7 日 |

### 2. CrmMarketingJob（行銷工作台）

| 項目 | 說明 |
|------|------|
| **頁面** | `AdminCrmJobsPage` (`/admin/crm/jobs`) |
| **補強** | 新增 2 筆 CrmMarketingJob：VIP 發折 50 券、全部 ACTIVE 發歡迎券，status=done |

### 3. LoyaltyCouponIssue 客戶 code

| 項目 | 說明 |
|------|------|
| **問題** | 發券紀錄引用不存在的 `GOLD001`、`GOLD002` |
| **補強** | 改為實際存在的 code：coup20 用 VIP002、MEM019（GOLD）；coup30 用 VIP002 取代 GOLD001 |

### 4. 先前已補強

- **CashRegisterSession**：6 筆（2 OPEN、4 CLOSED）
- **補貨建議**：DEMO-POS-REPL 銷售 DEMO-LOW-STOCK
- **商品效期**：牧草、飼料、零食皆具 productionDate/shelfLifeMonths 或 expiryDate，剩餘天數可計算

---

## 三、已確認完整項目

| 模組 | 項目 | 筆數／狀態 |
|------|------|------------|
| 金流 | FinanceSnapshot | 5 筆，由 FinanceEvent 彙總 |
| 金流 | FinanceAuditLog | 30 筆，對應 sample FinanceEvent |
| 金流 | FinancePeriodClose | 2 筆 demo 關帳區間 |
| 穿透 | ReportClickAudit | 5 筆，對應 posOrder、receivingNote |
| 會員 | Segment | 5 筆 |
| 會員 | CustomerContactLog | 5 筆 |
| 會員 | CrmCouponDispatchRule | 5 筆 |
| 採購／驗收 | 多狀態 PO、RN | 涵蓋 DRAFT～CANCELLED、PENDING～RETURNED |
| 庫存 | 即期批次 | 1 筆 DEMO-RN-EXPIRING |
| 訂單 | POS 訂單 | 30+ 筆，分散 daysAgo(0)～(58) |
| 訂單 | 促銷／折價券 | 滿百折十、滿千折百、VIP50 核銷 |
| 訂單 | 換貨／退貨 | 5 筆換貨、5 筆銷售退貨、5 筆退供應商 |

---

## 四、資料關聯性檢查（通過）

- **PosOrder → FinanceEvent**：SALE_RECEIVABLE、SALE_PAYMENT 與訂單對齊
- **ReceivingNote → FinanceEvent**：PURCHASE_PAYABLE、PURCHASE_RETURN 對齊
- **InventoryEvent.referenceId**：對應 PosOrder.id 或 ReceivingNoteLine.id
- **PointLedger.referenceId**：對應 PosOrder.id
- **ReportClickAudit.referenceId**：對應實際 posOrder、receivingNote，穿透可導向

---

## 五、後續建議

1. **更新 db-seed.md**：Segment 筆數改為 5（若尚未更新）
2. **供應商採購排行**：若近 30 日仍空白，可確認 ReceivingNote COMPLETED 的 createdAt 是否落在查詢區間
