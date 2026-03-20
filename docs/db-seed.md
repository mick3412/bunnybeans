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
| **會員／客戶** | **M001～M018** 會員碼、VIP／GOLD／NORMAL、新客／零消費／多筆訂單／折抵點、無電話訪客；見下「會員 ↔ POS ↔ 點數」。**E2E** 客戶由 `pnpm e2e:seed` 建立，不在此列。 |
| **Supplier** | 3 啟用 + 1 停用；含聯絡人、付款條件等 |
| **Product** | **24 筆**：衣服（T恤多尺寸）、牧草、飼料、用品（食盆、水壺、兔籠）、零食、玩具；**規格欄位**：specSize、specStyle、specWeight、specCapacity、expiryDescription 皆有填寫 |
| **Category** | 6 筆：衣服、牧草、飼料、用品、零食、玩具 |
| **Brand** | 4 筆：品牌A、品牌B、品牌C、品牌D |
| **採購單** | DRAFT、ORDERED、PARTIALLY_RECEIVED、RECEIVED、CANCELLED |
| **驗收單** | PENDING、IN_PROGRESS、COMPLETED（含部分合格+退回）、RETURNED |
| **庫存** | 與「驗收合格入庫」一致；低庫存 1、零庫存 0 各一 SKU；零食／兔籠／玩具／水壺另有 SEED-BULK 初始 |
| **POS** | **30 筆**訂單（`DEMO-POS-{年}-001～030`），**createdAt 分散近 60 天**（供報表區間篩選）；多會員＋**匿名客**（customerId=null）；金額分散（99～2000+）供**客單價分布**、**營收趨勢**、**熱銷品項**測試；**PointLedger** 與訂單 **referenceId** 對齊；每筆訂單對應 **SALE_RECEIVABLE**＋**SALE_PAYMENT**（金流報表全流程）；**FinanceEvent.partyId** 使用 `customer:{id}`、`supplier:{id}`、`STORE:WALKIN`（匿名） |
| **促銷** | 2 上架 + 1 草稿 |
| **BulkImportJob** | done / failed 各 1（測 async 列表） |
| **Segment（分群）** | 3 筆：「全部 ACTIVE 會員」、「VIP 會員」、「GOLD 會員」；手測 GET /crm/segments/:id/preview |
| **TierRule** | 2 筆：消費滿 5000 升 VIP、滿 2000 升 GOLD |
| **LoyaltyCoupon** | 2 筆：WELCOME10、VIP50 |
| **CrmCouponDispatchRule** | 2 筆：新會員發歡迎券、VIP 發折 50 券 |
| **ProductTag** | 3 筆：熱銷、新品、清倉（SEED-TAG-HOT／NEW／CLEARANCE）；供前端類別管理／商品頁選用 |
| **CustomerContactLog** | 1 筆：VIP001 客戶、type=CALL、SEED 示範 |

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

**金流（全流程）**：每筆 POS 訂單會寫入 **SALE_RECEIVABLE**（應收）與 **SALE_PAYMENT**（實收），referenceId 為訂單 id；驗收 COMPLETED 的 RN-FULL 有一筆 **PURCHASE_PAYABLE**。**partyId** 使用 `customer:{customerId}`、`supplier:{supplierId}`（與 Party 視圖對齊）；匿名客使用 `STORE:WALKIN`。金流報表（GET /finance/events、GET /finance/summary）可依 type 篩選與彙總進行人工測試。

## E2E 與測試資料清空

**`db:seed` 會先 `wipeAll()` 清空所有業務表**，包含 CrmCouponDispatchRule、PromotionRule 等。因此執行 `db:seed` 後，**不會殘留 E2E-RULE-*、E2E-ORDER-* 等 E2E 測試資料**。E2E 用 fixture 由 `pnpm e2e:seed` 單獨建立，僅在跑 E2E 測試時使用。

## E2E 固定客戶（由 e2e-seed 建立）

E2E 客戶**不在** `db:seed` 內。執行掛帳 E2E 前請：

```bash
pnpm db:seed      # 先建 demo 劇本
pnpm e2e:seed     # 再建立 E2E 客戶
```

- **id**：`e2e00001-0000-4000-8000-00000000c001`
- **code**：`E2E` · **memberCode**：`M000`
- **條碼 fixture（供 `GET /products/search-barcode`）**：`q=E2E-BC-0001`
- Playwright 掛帳測試（pos-credit.spec.ts）使用此客戶。

## 會員 ↔ POS 訂單 ↔ 點數（本地測試）

| code | memberCode | 等級 | 情境 | 關聯訂單（範例） | 目前點數（約） |
|------|------------|------|------|------------------|----------------|
| VIP001 | M001 | VIP | 兩筆消費、賒帳示範、高餘額 | `…-001`、`…-002`（賒帳）、`…-003` | 8 |
| VIP002 | M002 | GOLD | 贈點後折抵 | `…-004` + BURNED | 1 |
| MEM001 | M003 | NORMAL | 兩筆累點 | `…-005`、`…-006` | 2 |
| MEM002 | M004 | NORMAL | 單筆 | `…-007` | 3 |
| MEM003 | M005 | NORMAL | 本週入會、單筆 | `…-008` | 2 |
| MEM004 | M006 | NORMAL | **尚無訂單**、0 點 | — | 0 |
| MEM005 | M007 | VIP | 三筆 + **EXPIRED** 示範 | `…-009`～`…-011` | 4 |
| MEM006 | M008 | GOLD | EARN + BURN | `…-012` | 1 |
| WALK01 | — | — | 無電話非會員 | 無 | 無 |
| MEM007～MEM016 | M009～M018 | 多樣 | **僅建檔、無訂單**（供列表／搜尋／篩選測試） | — | 0 |

**M009～M018**：趙測試、孫銀卡、周常客、吳小惠、馮新友、陳大點、林小芳、許匿名（無電話）、高回購、謝試用；等級含 VIP／GOLD／NORMAL，入會日分散，部分有 email。

Loyalty **點數存摺** 可依 `customerId` 查；**EARNED** 列 **referenceId** = POS **orderId**，可連回訂單明細。

## 重複執行

不再使用 upsert 累積：**每次 seed = 全刪 + 全建**。若只要保留 migration 不要動資料，請勿跑 seed。
