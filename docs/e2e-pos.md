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
| Seed | `pnpm --filter pos-erp-backend db:seed`（含「商品 A」、門市 S001） |
| 前端 API | 本機 E2E 時前端需連後端：專案根或 `frontend/.env` 設 `VITE_API_BASE_URL=http://localhost:3003`（勿結尾 `/`） |

## 指令

```bash
# 終端 1：後端
pnpm --filter pos-erp-backend dev

# 終端 2（可選，Playwright 會自動起 Vite；若已手動 dev 前端則重用）
pnpm exec playwright test
```

自訂前端網址：

```bash
E2E_BASE_URL=http://127.0.0.1:5173 pnpm exec playwright test
```

## 測試檔

| 檔案 | 行為 |
|------|------|
| `e2e/pos-checkout.spec.ts` | 登入 → 加「商品 A」→ 全額結帳 → 訂單列表第一列有單號 |
| `e2e/pos-credit.spec.ts` | 掛帳（實收 0 + Demo 客戶 UUID）→ 明細 → 補款 → 未收金額下降 |
| `e2e/pos-refund.spec.ts` | 全額結帳 → 訂單明細 → 小額退款 → 金額欄清空（API 成功） |
| `e2e/pos-return-stock.spec.ts` | 全額結帳 → 明細 → 退貨入庫 1 件 → 成功提示 |
| `e2e/admin-smoke.spec.ts` | 登入 → 後台庫存頁載入 |

掛帳用客戶 UUID 固定為 **`e2e00001-0000-4000-8000-00000000c001`**（seed 每次 **`upsert`** 之 `code: E2E` 客戶）。請執行 **`pnpm --filter pos-erp-backend db:seed`** 後再跑掛帳 E2E，無需清空舊 C001。

## CI（GitHub Actions）

| 檔案 | 行為 |
|------|------|
| [`.github/workflows/backend-ci.yml`](../.github/workflows/backend-ci.yml) | Postgres 15 → `db push` → seed → **`pnpm --filter pos-erp-backend test`** |
| [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml) | 同上 DB 前置 → 背景後端 **:3003** → **`playwright install chromium --with-deps`** → **`CI=1` `VITE_API_BASE_URL=http://localhost:3003` `pnpm e2e`** |

觸發：`push` / `pull_request` 至 `main` 或 `master`。E2E job 內 **`CI=1`** 時 Playwright 會自起 Vite（見 `playwright.config.ts`）。本機勿設 `CI=1` 若已佔用 5173。
