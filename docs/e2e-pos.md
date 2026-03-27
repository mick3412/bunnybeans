# POS E2E（Playwright）

## 你要做什麼 vs 已就緒的項目

| 誰做 | 內容 |
|------|------|
| **已就緒（專案內）** | `frontend/.env` 已含 `VITE_API_BASE_URL=http://localhost:3003`；Playwright 設定在 repo 根目錄；可執行 `./scripts/e2e-local.sh`（會檢查後端再起測試）。 |
| **須你本機執行** | PostgreSQL + `DATABASE_URL`、後端 `prisma db push`（或 migrate）、**`pnpm --filter pos-erp-backend db:seed`**、**終端常駐** `pnpm --filter pos-erp-backend dev`（:3003）。這些無法代替你開 DB／起伺服器。 |

一鍵（在後端已跑的前提下）：

```bash
./scripts/e2e-local.sh
```

---

## 最簡單隔離 demo DB（推薦）

> 因為 `pnpm --filter pos-erp-backend db:seed` 會先 `wipeAll()` 清空業務表再重建完整 demo 數據，若你把 `DATABASE_URL` 指到 demo DB，**就會把 demo DB 清掉**。  
> 解法是：**專門準備一個 E2E DB**，E2E 相關指令一律用它。

### 一次性設定

1. 準備一個獨立 DB（例：`pos_erp_e2e`）
2. 建立 `.env.e2e`（此檔已被 gitignore）

```bash
cp .env.e2e.example .env.e2e
```

並把 `.env.e2e` 的 `DATABASE_URL` 改指向你的 E2E DB（例如 `.../pos_erp_e2e`）。

### 一鍵跑（完全不動 demo DB）

```bash
./scripts/e2e-one-click-isolated.sh
```

它會使用 `.env.e2e` 的 `DATABASE_URL` 來執行：
`migrate deploy → db:seed（wipe+full demo）→ e2e:seed → 後端 dev(:3003) → playwright`。

**盡量一鍵**（未起後端時會背景啟動 backend，需 DB / `DATABASE_URL`）：

```bash
pnpm e2e:one
# 或 macOS 雙擊 macos/POS-E2E.app（見 macos/README.md）
```

---

## 前置條件

| 項目 | 說明 |
|------|------|
| 後端 | 預設 **http://localhost:3003**，`GET /health` 正常 |
| 資料庫 | `DATABASE_URL` 正確，已執行 migration |
| Seed | `pnpm --filter pos-erp-backend db:seed`（含「商品 A」、門市 S001）+ `pnpm --filter pos-erp-backend e2e:seed`（建立 E2E 客戶與 referenceId/條碼 fixture） |
| 前端 API | 本機 E2E 時前端需連後端：專案根或 `frontend/.env` 設 `VITE_API_BASE_URL=http://localhost:3003`（勿結尾 `/`） |

---

## 報表穿透（referenceId）聯調驗收腳本（手動）

> 目的：驗證 Finance/Loyalty 報表中的 `referenceId` 可一致「點擊穿透」回 POS 訂單或採購驗收單。

### 前置

- 後端已完成：`pnpm --filter pos-erp-backend exec prisma migrate deploy`（或本機 `db push`）後，跑 `pnpm --filter pos-erp-backend db:seed`
- 前端已連到後端（`VITE_API_BASE_URL`）

### 驗證步驟

1. 開後台金流報表頁（例如 `/admin/reports` 或金流事件列表頁）
2. 找到任一筆有 `referenceId` 的事件列（建議：`SALE_RECEIVABLE` 或 `PURCHASE_PAYABLE`）
3. 點擊 `referenceId`
4. 預期行為
   - 若為銷售單：導向 `/pos/orders/:id`，且訂單明細可成功載入
   - 若為驗收單：導向採購驗收單明細頁（若前端尚未有該頁，至少應顯示「無法辨識單據」而非假成功）
   - 若無法辨識：顯示 toast/提示「無法辨識單據」

### 排查

- 若 referenceId 無法辨識：可用 `GET /ops/references/resolve?referenceId=...` 檢查後端解析結果（`posOrder` / `receivingNote` / `unknown`）

## 指令

```bash
# 初始化（一次性或每次重灌 DB）
pnpm --filter pos-erp-backend exec prisma migrate deploy
pnpm --filter pos-erp-backend db:seed
pnpm --filter pos-erp-backend e2e:seed

# 終端 1：後端（常駐）
pnpm --filter pos-erp-backend dev

# 終端 2（可選，Playwright 會自動起 Vite；若已手動 dev 前端則重用）
pnpm exec playwright test
```

### 常見問題：5173 被佔用（port in use）

若你已在其他終端啟動 `pnpm --filter pos-erp-frontend dev`，Playwright 會嘗試再起一次 Vite，導致報錯。

- 解法：保持前端 dev 常駐即可，Playwright 會**重用既有 5173**（`reuseExistingServer:true`，見 repo 根目錄 `playwright.config.ts`）。
- 或改用自訂網址：`E2E_BASE_URL=http://127.0.0.1:5173 pnpm exec playwright test`

### 常見問題：結帳回傳 `409` + `INVENTORY_INSUFFICIENT`（退換貨 E2E）

`e2e/pos-refund.spec.ts`、`e2e/pos-return-stock.spec.ts` 等會先以條碼 `E2E-BC-0001` 建單；若後端回 **庫存不足**，代表環境**沒有可售庫存 fixture**（或與門市/倉庫綁定不一致）。

- **操作指引**：依序執行 `pnpm --filter pos-erp-backend db:seed` 與 `pnpm --filter pos-erp-backend e2e:seed`（一般 profile 即含條碼與門市資料）；若仍不足，改用 **`E2E_PROFILE=full`** 並跑完整 `e2e:seed`（full profile 要求見上文「Full profile」一節）。
- E2E 內已對此情況 **`test.skip`** 並提示 seed／full profile，避免在缺資料的環境硬失敗。

#### INSTRUCTIONS 061 實測註記（隔離 DB）

- 執行方式：`source .env.e2e` 後依序 `pnpm db:seed` → `E2E_PROFILE=full pnpm --filter pos-erp-backend e2e:seed` → Playwright（或見上文一鍵腳本）。
- **full `e2e:seed`**：補貨建議驗證通過後，將條碼單品（`E2E-BC-0001`／`DEMO-TEE-BLK-M`）在預設門市倉之 **`InventoryBalance` 還原為足量**，以降低 `pos-refund`／`pos-return-stock` 等因 **`INVENTORY_INSUFFICIENT`** 條件式 skip。
- 若仍 skip：確認未誤用 demo DB、seed／`e2e:seed` 成功（`wipeAll` 刪除順序錯誤會 P2003）。

## Full profile（E2E_PROFILE=full）

當 `E2E_PROFILE=full` 時，代表資料/後端/seed 已就緒，**不允許長期 skip**。若缺 fixture 應直接 fail，並在錯誤訊息中指出缺少 DB/seed/後端/ADMIN_KEY 等條件。

穿透 referenceId 契約（避免 `ReferenceIdLink` 長期非可點狀態）：
- 後台報表/清單的 `referenceId` 只有符合 UUID-like（純 hex）格式時，才會渲染成可點擊按鈕並呼叫 `/ops/references/resolve`。
- UUID-like regex：`^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`
- `E2E_PROFILE=full` 驗收要點：`/admin/reports`（或 finance events 列表）必須至少有 1 筆可穿透 `referenceId`，且 E2E smoke 點擊第一個 `訂單` 按鈕必須導向 `/pos/orders/:id`（不可因按鈕數量為 0 而 skip）。
- `E2E_PROFILE=full` 回程要點：從 `/pos/orders/:id` 點「回到來源」必須回到正確的來源頁（例如 `/admin/reports`），且回程後頁面區塊可見、後續旅程頁（例如 `/admin/loyalty/reports` 活動成效報表）可繼續到達。

Expected fixture keys（CI triage checklist）：
| Fixture key / value | 對應 seed fail-fast 檢查 / `E2E_SEED_SUMMARY` 欄位 | 應檢查的原因 |
|---|---|---|
| `E2E-REPL-SALE-001`（replenishmentSaleRef） | `E2E_SEED_SUMMARY.replenishmentSaleRef` + replenishment suggestions：`inventoryBalance.onHandQty=0`、`SALE_OUT` lookback 內存在、`suggestedQty>0` | full gate 的補貨建議不允許長期空清單 |
| `E2E-EXP-BATCH-0001`（expiringInventoryBatchCode） | `E2E_SEED_SUMMARY.expiringInventoryBatchCode` + expiring：`PURCHASE_IN` 在預設 `daysAhead=30` 的 expiryDate 範圍內且 SUM(quantity)>0 | `admin/inventory/expiring` full profile 期望非空資料 |
| `E2E-RN-0001`（receivingNoteReceiptNumber） | `E2E_SEED_SUMMARY.receivingNoteReceiptNumber` + receiving note return-to-supplier：`ReceivingNoteLine.qualifiedQty` 可退貨到至少 1、並確保關聯 PO/warehouse/product 存在 | `admin-receiving-notes-smoke` full gate return 流程至少能 return qty=1 |
| `E2E-REPORT-SALE-001` / `E2E-REPORT-PUR-001`（financeReportRefs） | `E2E_SEED_SUMMARY.financeReportRefs` + finance events count（sale/purchase 各 ≥2） | 金流報表段落 fail-fast 不允許 skip |
| `E2E-RULE-ENABLED-0001`（enabled） | `E2E_SEED_SUMMARY.dispatchRules.enabled.name` + enabled rule runnable 檢查 | dispatch-rules runner 更新 lastRun* 並應可觸發 |
| `E2E-RULE-DISABLED-0001`（disabled） | `E2E_SEED_SUMMARY.dispatchRules.disabled.name` + disabled rule 必須存在 | disabled rule 不應觸發但資料仍需存在 |
| `E2E-RULE-FUTURE-0001`（future） | `E2E_SEED_SUMMARY.dispatchRules.future.name` + future rule nextRunAt>now 檢查 | future rule 不應觸發 |
| `E2E-BC-0001` / `E2E-BC-0002`（barcode） | `Barcode single fixture (q)` + `Barcode multi fixture (q)`（full 時）+ fail-fast barcode count（single=1、多筆≥2） | barcode multi-match/single-match smoke 需要穩定命中資料 |
| `E2E_ORDER_ID=e2e00002-0000-4000-8000-00000000a001`、`E2E_RN_ID=e2e00003-0000-4000-8000-00000000b001`（referenceId clickable） | UUID-like 契約 + finance referenceId 可 resolve 為 `posOrder/receivingNote` | `/admin/reports` 的 `ReferenceIdLink` 需要可點穿透 |
| `E2E_EX_SOURCE_ORDER_ID=e2e00005-0000-4000-8000-00000000d001`、`E2E_EX_DERIVED_ORDER_ID=e2e00006-0000-4000-8000-00000000e002`（exchange） | `Exchange source order id` / `Exchange derived order id`（seed log）+ fail-fast exchange linkage + `SALE_REFUND` count（source=≥1） | 換貨 settlement 的 referenceId 穿透與退款事件必須完整 |

建議指令：

```bash
export E2E_PROFILE=full
pnpm --filter pos-erp-frontend build
pnpm exec playwright test e2e/admin-smoke.spec.ts e2e/admin-barcode-min.spec.ts e2e/admin-barcode-multi-match.spec.ts e2e/pos-exchange-settlement-journey.spec.ts e2e/admin-ops-report-clicks-full.spec.ts e2e/admin-dispatch-rules.spec.ts e2e/admin-categories.spec.ts e2e/admin-customers-import.spec.ts e2e/admin-bulk.spec.ts e2e/admin-replenishment.spec.ts e2e/admin-pos-reports.spec.ts e2e/admin-journey-exchange-loyalty.spec.ts e2e/admin-loyalty-smoke.spec.ts e2e/admin-balances.spec.ts e2e/admin-receiving-notes-smoke.spec.ts e2e/admin-expiring-inventory-smoke.spec.ts
```

自訂前端網址：

```bash
E2E_BASE_URL=http://127.0.0.1:5173 pnpm exec playwright test
```

## 測試檔

| 檔案 | 行為 |
|------|------|
| `e2e/pos-checkout.spec.ts` | 登入 → 加「商品 A」→ 全額結帳 → 訂單列表第一列有單號 |
| `e2e/pos-held-retrieve.spec.ts` | 掛單（加品項 → 點掛單 → 購物車清空）→ 取單（點取單 → 選掛單 → 購物車回填）；暫無掛單 Modal 空態 |
| `e2e/pos-credit.spec.ts` | 掛帳（實收 0 + Demo 客戶 UUID）→ 明細 → 補款 → 未收金額下降 |
| `e2e/pos-refund.spec.ts` | 全額結帳 → 訂單明細 → 小額退款 → 金額欄清空（API 成功） |
| `e2e/pos-return-stock.spec.ts` | 全額結帳 → 明細 → 退貨入庫 1 件 → 成功提示 |
| `e2e/admin-smoke.spec.ts` | 庫存頁載入 + **金流報表** `/admin/reports` |
| `e2e/admin-categories.spec.ts` | 登入 → **分類維護**頁可見、標籤區可見；**標籤新增**（需 **VITE_ADMIN_API_KEY**，無 Key 時 skip；以 `e2e-admin-categories-tags-create-name-input` / `e2e-admin-categories-tags-create-add-btn` 定位）；**類別新增後列表顯示**（跨層 code 驗證；後端 INSTRUCTIONS 019 完成後必跑） |
| `e2e/admin-discount-tags.spec.ts` | 登入 → **`/admin/discount-tags`** 折扣標籤頁載入；側欄「折扣標籤」連結；**新增折扣標籤**（需 **VITE_ADMIN_API_KEY**）；POS 促銷頁折扣標籤區；POS 收銀頁折扣篩選列（無／標籤） |
| `e2e/admin-bulk.spec.ts` | **批量 smoke**：商品匯入區塊、庫存匯出餘額（需 **VITE_ADMIN_API_KEY** 且回 200）、盤點上傳區塊、POS 訂單列表「匯出」按鈕 |
| `e2e/admin-customers-import.spec.ts` | 登入 → **`/admin/customers/import`** 可進入；**預覽** POST `/customers/import/preview`（需 **VITE_ADMIN_API_KEY**，無 Key 時該則 **test.skip**；使用 `e2e-admin-customers-import-file` / `e2e-admin-customers-import-run-preview-btn` / `e2e-admin-customers-import-filehash-preview` / `e2e-admin-customers-import-run-apply-btn` 定位） |
| `e2e/admin-loyalty-smoke.spec.ts` | 登入 → **`/admin/loyalty`** 側欄可見 **`e2e-admin-loyalty`**；**`/admin/loyalty/settings`** 設定頁區塊可見（需 **VITE_ADMIN_API_KEY**，無 Key 時 skip） |
| `e2e/admin-replenishment.spec.ts` | 登入 → **`/admin/replenishment`** 補貨建議頁載入、倉庫選單、建議列表或空態；空態以 `e2e-admin-replenishment-empty` 斷言；若有建議且有 **VITE_ADMIN_API_KEY** 則可建立採購草稿（使用 `e2e-admin-replenishment-suggestion-checkbox` / `e2e-admin-replenishment-supplier-select` / `e2e-admin-replenishment-create-draft-btn` 定位） |
| `e2e/admin-balances.spec.ts` | 登入 → **`/admin/balances`** 應收應付餘額頁載入、多方視角切換可見 |
| `e2e/admin-pos-sessions.spec.ts` | 登入 → **`/admin/pos/sessions`** 收銀班次頁載入、班次列表或空態；側欄「收銀班次」連結導向；POS 班次列可見（尚無開班／班次進行中）；開班 Modal 流程（輸入起始現金、送出） |
| `e2e/admin-receiving-notes-smoke.spec.ts` | 登入 → `/admin/receiving-notes`；打開 `E2E-RN-0001`；填退貨數量/原因→ 送出退回供應商；驗證 toast 與 `InventoryEvent RETURN_TO_SUPPLIER` note |
| `e2e/admin-expiring-inventory-smoke.spec.ts` | 登入 → `/admin/inventory/expiring`；篩選 `E2E-EXP-BATCH-0001`；驗證 KPI 區塊與列表/空態渲染（full profile 時期望非空） |
| `e2e/admin-dispatch-rules.spec.ts` | 登入 → **`/admin/dispatch-rules`** 發券規則頁載入、列表或空態 |
| `e2e/admin-ops-report-clicks-full.spec.ts` | 登入 → **`/admin/ops/report-clicks`**；驗證 `e2e-admin-ops-report-clicks` 載入、resultCode 欄位（`aria-label="resultCode"`）、中文 resultCode/解析類型顯示、placeholder `例：NOT_FOUND`；full profile 時不允許載入失敗 |
| `e2e/admin-pos-reports.spec.ts` | 登入 → `/pos/reports`；驗證 summary KPI、時間區段 preset 切換（含 URL `preset` query）、熱銷品項／區間趨勢區塊或其空態文案，以及 top-items → `/admin/products?q=…` 與銷售明細單號 → `/pos/orders/:id` 的跳轉 |

掛帳用客戶 UUID 固定為 **`e2e00001-0000-4000-8000-00000000c001`**（`code: E2E` 客戶）。請先執行 **`pnpm db:seed`**，再執行 **`pnpm e2e:seed`** 建立此客戶，然後跑掛帳 E2E。

條碼 fixture（供 `GET /products/search-barcode` 與前端掃碼流程）固定為 **`q=E2E-BC-0001`**（由 `pnpm --filter pos-erp-backend e2e:seed` 確保「單筆命中」存在）。

多筆命中 fixture（`E2E_PROFILE=full`）：固定為 **`q=E2E-BC-0002`**（>=2 筆商品），用於驗收「多筆命中需選擇」。

換貨 settlement fixture（`E2E_PROFILE=full`）：

- source 訂單 id：`e2e00005-0000-4000-8000-00000000d001`
- derived 訂單 id：`e2e00006-0000-4000-8000-00000000e002`
- source 會寫入 `SALE_REFUND`（delta=50）供 `exchangeSettlement.refund.events[]` 驗收

金流報表 fixtures（`E2E_PROFILE=full`，供後台金流報表段落 fail-fast 不 skip）：

- 銷售：`referenceId=E2E-REPORT-SALE-001`（`SALE_RECEIVABLE` + `SALE_PAYMENT`；partyId=`customer:<E2E_CUSTOMER_ID>`）
- 採購：`referenceId=E2E-REPORT-PUR-001`（`PURCHASE_PAYABLE` + `PURCHASE_REBATE`；partyId=`supplier:<supplierId>`）

發券規則（dispatch-rules）fixtures（`E2E_PROFILE=full`，供 `e2e/admin-dispatch-rules.spec.ts` 驗收）：

- segment：`E2E-SEGMENT-NORMAL-0001`
- coupon：code `E2E-COUPON-0001`
- dispatch rules：
  - 應觸發（enabled & due）：`E2E-RULE-ENABLED-0001`（enabled=true，nextRunAt<=now）
  - 應不觸發（disabled）：`E2E-RULE-DISABLED-0001`（enabled=false）
  - 應不觸發（未到時間）：`E2E-RULE-FUTURE-0001`（nextRunAt>now）

dispatch-rules full gate 驗收流程（不可默默 skip）：

1. 確保 `E2E_PROFILE=full`，且後端/前端皆有 `VITE_ADMIN_API_KEY`（Ops job 觸發受保護）
2. 後台登入後開啟 `/admin/dispatch-rules`
3. 觸發 `crm-run-scheduled` runner（E2E 以 POST `/ops/jobs/run` kind=`crm-run-scheduled` 呼叫；人工可到 `/admin/ops/jobs?kind=crm-run-scheduled` 點「補跑」）
4. 驗證 `E2E-RULE-ENABLED-0001` 的 `lastRunAt/lastRunCode/lastRunNote` 皆非空且合理（`lastRunCode` 應為 `SENT/SKIPPED/FAILED` 之一）
5. 進入 `/admin/ops/jobs?kind=crm-run-scheduled`，確認出現 `crm-run-scheduled`，並且訊息包含 `jobId=`

## CI（GitHub Actions）

| 檔案 | 行為 |
|------|------|
| [`.github/workflows/backend-ci.yml`](../.github/workflows/backend-ci.yml) | Postgres 15 → `ci:schema-migration-check` → `migrate deploy` → seed → **`pnpm --filter pos-erp-backend test`** |
| [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml) | **Job1 `backend-test`**（Postgres → db push → seed → **jest**）→ **Job2 `playwright`（needs job1）** → 獨立 DB → 後端 **:3003** → Playwright **`pnpm e2e`** |
| [`.github/workflows/e2e-full.yml`](../.github/workflows/e2e-full.yml) | **手動/排程 gate**：`migrate deploy` → `db:seed` → `E2E_PROFILE=full e2e:seed`（缺 fixture 直接 fail-fast）→ Playwright **固定 specs 清單**（barcode multi / 換貨 settlement / click-audit / 金流報表） |

觸發：`push` / `pull_request` 至 `main` 或 `master`。E2E job 內 **`CI=1`** 時 Playwright 會自起 Vite（見 `playwright.config.ts`）。本機勿設 `CI=1` 若已佔用 5173。
