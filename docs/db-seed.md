# 資料庫 Seed 腳本說明

## 警告（必讀）

**每次執行 `db:seed` 會先清空所有業務表**（訂單、庫存事件、採購、客戶、商品…），再寫入**唯一一份 DEMO 劇本**。  
**生產環境切勿執行**；僅本機／Preview／CI demo。

**還原空庫 + migration + seed（推薦本機）**：

```bash
pnpm --filter pos-erp-backend exec prisma migrate reset
```

（會刪除整個 DB 資料並重跑 migration，再自動跑 seed。）

僅已有表、想重灌資料：

```bash
pnpm db:seed
```

## 前置

- `DATABASE_URL` 已設定。
- 已執行過 migration（表已存在）。

## 執行方式

```bash
pnpm db:seed
# 或
pnpm --filter pos-erp-backend db:seed
```

## 建立內容（摘要）

| 區塊 | 內容 |
|------|------|
| **Merchant / Store / Warehouse** | M001、S001、W001 |
| **會員／客戶** | **E2E**（固定 id）、**M000～M008** 會員碼、VIP／GOLD／NORMAL、新客／零消費／多筆訂單／折抵點、無電話訪客；見下「會員 ↔ POS ↔ 點數」 |
| **Supplier** | 3 啟用 + 1 停用；含聯絡人、付款條件等 |
| **Product** | DEMO-TEE-BLK-M、DEMO-TEE-WHT-M、DEMO-FEED-ADULT 等（與採購／POS 連動） |
| **採購單** | DRAFT、ORDERED、PARTIALLY_RECEIVED、RECEIVED、CANCELLED |
| **驗收單** | PENDING、IN_PROGRESS、COMPLETED（含部分合格+退回）、RETURNED |
| **庫存** | 與「驗收合格入庫」一致；低庫存 1、零庫存 0 各一 SKU |
| **POS** | **12 筆**訂單（`DEMO-POS-{年}-001～012`），多會員、現金／賒帳，已 SALE_OUT；**PointLedger** 與訂單 **referenceId** 對齊 |
| **促銷** | 2 上架 + 1 草稿 |
| **BulkImportJob** | done / failed 各 1（測 async 列表） |

## 採購 → 驗收 → 庫存 → 訂單（鏈路與多樣情境）

單號中年份與 seed 執行年一致（例：`DEMO-PO-2026-*`）。整體路徑：**供應商 → 採購單（含明細）→ 驗收單 → 合格量入庫（PURCHASE_IN）→ 庫存餘額 → POS 扣庫（SALE_OUT）**。

| 採購單（狀態） | 供應商角色 | 驗收單／入庫 | 涵蓋情境 |
|----------------|------------|--------------|----------|
| `…-DRAFT` | 啟用供應商 | 無 | 草稿、未下單 |
| `…-CANCEL` | 停用供應商 | 無 | 已取消 |
| `…-ORDERED` | 啟用 | 無 | 可新建驗收 |
| `…-PEND-PO` | 啟用 | RN **PENDING** | 待驗收 |
| `…-PROGRESS` | 啟用 | RN **IN_PROGRESS** | 驗收填寫中 |
| `…-FULL` | 啟用 | RN **COMPLETED** → 黑 T／白 T **全額 PURCHASE_IN** | 已收貨、與入庫一致 |
| `…-PARTIAL` | 啟用 | RN **COMPLETED**（部分合格＋破損退回）→ 飼料 **15** 入庫 | 部分到貨 |
| `…-RETURN` | 啟用 | RN **RETURNED** | 整批退、不入庫 |

**與 POS 的關係**：FULL 入庫的 T 恤等與 seed 中 POS 可賣品項同一批商品；零庫存 SKU 僅出現在 RETURN 採購明細（敘述用）。其餘 SKU 另以 `SEED-BULK` 補初始庫存，方便列表／報表有量。

## E2E 固定客戶

- **id**：`e2e00001-0000-4000-8000-00000000c001`
- **code**：`E2E` · **memberCode**：`M000`
- 每 seed 重建，Playwright 掛帳測試不變。

## 會員 ↔ POS 訂單 ↔ 點數（本地測試）

| code | memberCode | 等級 | 情境 | 關聯訂單（範例） | 目前點數（約） |
|------|------------|------|------|------------------|----------------|
| E2E | M000 | NORMAL | 賒帳 + 贈點 | `…-002` | 2 |
| VIP001 | M001 | VIP | 兩筆消費、高餘額 | `…-001`、`…-003` | 6 |
| VIP002 | M002 | GOLD | 贈點後折抵 | `…-004` + BURNED | 1 |
| MEM001 | M003 | NORMAL | 兩筆累點 | `…-005`、`…-006` | 2 |
| MEM002 | M004 | NORMAL | 單筆 | `…-007` | 3 |
| MEM003 | M005 | NORMAL | 本週入會、單筆 | `…-008` | 2 |
| MEM004 | M006 | NORMAL | **尚無訂單**、0 點 | — | 0 |
| MEM005 | M007 | VIP | 三筆 + **EXPIRED** 示範 | `…-009`～`…-011` | 4 |
| MEM006 | M008 | GOLD | EARN + BURN | `…-012` | 1 |
| WALK01 | — | — | 無電話非會員 | 無 | 無 |

Loyalty **點數存摺** 可依 `customerId` 查；**EARNED** 列 **referenceId** = POS **orderId**，可連回訂單明細。

## 重複執行

不再使用 upsert 累積：**每次 seed = 全刪 + 全建**。若只要保留 migration 不要動資料，請勿跑 seed。
