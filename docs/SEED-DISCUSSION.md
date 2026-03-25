# SEED 相關討論展開

本文展開 `db:seed` / `e2e:seed` 的架構、涵蓋、待決事項與維護建議。

---

## 1. 架構概觀

### 1.1 雙軌設計

| 腳本 | 用途 | 相依性 | 指令 |
|------|------|--------|------|
| **db:seed** | 完整 DEMO 劇本，收銀／後台全流程測試 | 需 migration 後表已存在 | `pnpm db:seed` |
| **e2e:seed** | E2E 專用 fixture（掛帳客戶、條碼、換貨 referenceId 等） | **依賴 db:seed 先執行** | `pnpm e2e:seed` |

- `db:seed` 會先 `wipeAll()` 清空所有業務表，再建立單一可重現劇本。
- `e2e:seed` 在既有 db:seed 資料上**增量**建立 E2E 專用 fixture（E2E 客戶、E2E-BC-0001 條碼等），不 wipe。
- 掛帳 E2E 流程：`pnpm db:seed` → `pnpm e2e:seed` → Playwright。

### 1.2 執行入口

```bash
# 完整清除後重載（刪 DB → migrate → seed）
pnpm db:reset

# 僅重灌資料（保留 schema）
pnpm db:seed

# E2E 前置（需在 db:seed 之後）
pnpm e2e:seed
E2E_PROFILE=full pnpm e2e:seed   # full profile 補足補貨／即期／報表穿透等 fixture
```

---

## 2. db:seed 涵蓋內容（與文件對齊檢查）

### 2.1 db-seed.md 與實際實作差異

| 項目 | db-seed.md 描述 | 實際 seed.ts | 狀態 |
|------|-----------------|-------------|------|
| **Segment** | 3 筆 | 5 筆（全部 ACTIVE、VIP、GOLD、NORMAL、多筆消費） | ⚠️ 文件待更新 |
| **CrmCouponDispatchRule** | 2 筆 | 5 筆 | ⚠️ 文件待更新 |
| **CustomerContactLog** | 1 筆 | 5 筆 | ⚠️ 文件待更新 |
| **ReportClickAudit** | 2 筆 | 5 筆 | ⚠️ 文件待更新 |

建議：將 `db-seed.md` 的「建立內容（摘要）」表格同步為實際數量。

### 2.2 db-seed-coverage.md 檢查清單狀態

**已達成 ✅**

- POS、Admin 多數頁面有對應資料
- 訂單／金流／穿透鏈完整
- 採購→驗收→庫存→即期鏈
- 銷售退貨、換貨、部分退供應商
- 會員點數 EARNED/BURNED/EXPIRED
- FinanceSnapshot、ReportClickAudit

**待補強 ⚠️**

| 項目 | 說明 | 建議 |
|------|------|------|
| 條碼搜尋 | db:seed 部分商品有 barcode；E2E 條碼由 e2e:seed 建立 | 維持現狀，文件註明分工 |
| 補貨建議 | DEMO-ZERO-STOCK 零庫存；需 SALE_OUT 歷史才會有建議 | e2e:seed full profile 已補 deterministic fixture |
| FinanceAuditLog | 依 FinanceEvent 寫入 | 視後端實作決定是否 seed |
| OpsJobRunLog | 可空表 | 視需求決定是否補 demo run log |
| 關帳區間 | db:seed 無關帳 | 維持空表 |

---

## 3. 待決／討論事項

### 3.1 文件同步

- [ ] 更新 `db-seed.md` 摘要表格，反映 Segment / CrmCouponDispatchRule / CustomerContactLog / ReportClickAudit 實際筆數。
- [ ] 在 `db-seed.md` 補充「本 seed 補強項目」小節，連結 `db-seed-coverage.md` 的補強清單。

### 3.2 資料量與效能

- 目前 POS 訂單約 35+ 筆（含 orderT1～T5 等），分散 60 天；是否需擴充以壓力測試？
- `wipeAll()` 依 FK 順序 `deleteMany`，表多時是否改為 TRUNCATE CASCADE（若 DB 支援）以加速？

### 3.3 時序相依性

- 單號含年份（`DEMO-PO-${y}-*`），跨年時可能與歷史資料語義有落差。
- `daysAgo` 以執行當日為基準，CI 或排程執行時「今日」「近 7 日」等 preset 會變動；可接受為「相對時間」或需固定基準日？

### 3.4 E2E 與 db:seed 邊界

- `db:seed` 會清空業務表，**不會殘留** E2E 用 fixture；E2E 必須先 db:seed 再 e2e:seed。
- 是否有需求：在「不跑 db:seed」的情況下，僅跑 e2e:seed 補齊 E2E fixture（例如既有開發資料想保留）？目前設計不支援。

### 3.5 生產／Preview 環境

- `db-seed.md` 已警告：**生產環境切勿執行**。
- Preview 部署可選 `db:seed` 以重灌 demo；正式環境依政策不跑 seed。

---

## 4. 維護建議

### 4.1 Schema 變更時

1. migration 上線後，檢查 `seed.ts` 是否有新表／新欄位需補。
2. `wipeAll()` 須涵蓋新業務表（依 FK 子→父順序）。
3. 若新功能有報表／穿透，在 `db-seed-coverage.md` 補一列檢查。

### 4.2 新增業務情境時

1. 在 `db-seed.md` 摘要表格補一列。
2. 若涉「每情境 ≥5 筆」規範，在 `db-seed-coverage.md` 商品／會員路徑情境表補對應。
3. 必要時在 seed 內加註情境代號（如 `// 情境：部分退貨給供應商`）便於追溯。

### 4.3 驗證流程

```bash
pnpm db:reset
# 人工檢查：/pos、/admin/* 各頁無空表（除關帳、OpsJobRunLog 等可空項）
# 或：撰寫 smoke 腳本查 key 表 count
```

---

## 5. 相關檔案索引

| 檔案 | 說明 |
|------|------|
| `backend/prisma/seed.ts` | 主 seed 實作 |
| `backend/scripts/e2e-seed.ts` | E2E fixture 增量 seed |
| `docs/db-seed.md` | seed 說明、執行方式、建立內容摘要 |
| `docs/db-seed-coverage.md` | 收銀／後台涵蓋檢查清單 |
| `scripts/e2e-prepare-db.sh` | E2E 前置：migrate + db:seed + e2e:seed |

---

## 6. 已補強項目（2026-03）

1. **飼料／零食效期**：productionDate+shelfLifeMonths（推算）與 expiryDate（直接）兩種模式皆有。
2. **每分類庫存**：衣服、牧草、飼料、用品、零食、玩具各有多庫存、少庫存、0庫存至少一商品。
3. **條碼**：全部商品為台灣 EAN-13 格式（前綴 471，含校驗碼）。
4. **關帳區間**：2 筆 FinancePeriodClose，供 /admin/finance/periods 展示。
5. **稽核紀錄**：15 筆 FinanceAuditLog，對應 FinanceEvent，供 /admin/finance/audit-log 展示。
6. **應收餘額**：賒帳訂單（DEMO-POS-*-002）僅建 SALE_RECEIVABLE 不建 SALE_PAYMENT，使應收應付餘額頁有非零應收可展示。

## 7. 下一步行動建議

1. **短期**：更新 `db-seed.md` 摘要表格（Segment/CrmCouponDispatchRule/CustomerContactLog/ReportClickAudit 筆數）。
2. **中期**：視需求決定是否補 FinanceAuditLog、OpsJobRunLog 的 demo 資料。
3. **長期**：若 seed 執行時間變長，評估 `wipeAll` 優化（TRUNCATE CASCADE 等）。
