# 前端預覽部署（Vercel）

本文件說明如何將 POS 前端部署到 Vercel，讓客戶或多人透過**同一個固定連結**遠端查看 mockup 並收集反饋。

專案根目錄已包含 [vercel.json](../vercel.json)，會從 monorepo 建置前端並輸出 `frontend/dist`，無需在 Vercel 後台手動設定 Root Directory。

---

## 前置

- **部署順序（與前端約定）**：**後端先上線**再依賴促銷／POS 新欄位。正式或 Preview DB 請執行 **`pnpm --filter pos-erp-backend exec prisma migrate deploy`**（須含 **`20260314180000_promotion_rules_pos_discount`**、**`20260315180000_bulk_import_job`** 等之後 migration）；**勿**僅 `db push` 於已有資料的生產庫時跳過 migration。完成後可選 **`pnpm --filter pos-erp-backend db:seed`**（僅測試／Preview；**seed 會清空業務表**，見 [db-seed.md](db-seed.md)）；生產依政策。再開前端或 Redeploy Vercel。
- **後端**（若前端改接真實 API）：本機可 `db push`；**生產建議 `migrate deploy`** + seed 政策與上項一致。
- **單一 3003**：本機／Tunnel **僅允許一個後端 process 佔用 :3003**，多開會導致促銷 preview、Dashboard、E2E 打到舊 process → **404 或舊 schema**。
- **E2E**：後端預設 **port 3003**；腳本需 **`DATABASE_URL` + seed** 後再起 API。固定 `storeId`／`productId` 請見 [docs/db-seed.md](db-seed.md)「E2E 前置與固定識別」。
- **有 DB 時 CI 一鍵綠**：**建議在已設定 `DATABASE_URL` 且目標為測試／Preview 的環境中，改用一條指令**：  
  **`pnpm ci:backend-with-db`**  
  其內部步驟等同：**`pnpm --filter pos-erp-backend exec prisma migrate deploy`** → **`pnpm db:seed`**（會清空業務表，僅限測試／Preview，見 [db-seed.md](db-seed.md)）→ **`pnpm --filter pos-erp-backend test`**。  
  若需保留現有資料庫、**不想執行 seed**，請改以上方三步驟分開下指令；jest 全綠即後端通過。Guard／E2E 流程見各 INSTRUCTIONS。  
  **ci:backend-with-db 仍受 P3009 限制**：在 clean DB 上可跑時優先使用；若目標 DB 曾有 failed migration 或 migrate 無法從零建表，請改用下方「常見錯誤與排除」中的**從零建庫替代流程**（`db push` → `db:seed` → `test`）。
- **CI/Preview 健檢：schema drift / migrations 一致性**：新增一條做「migrations 與 schema 一致性」檢查的指令（需要一個可拋棄的 shadow DB）：  
  **`pnpm ci:schema-migration-check`**  
  其內部會執行 `prisma validate` 與 `prisma migrate diff --from-migrations --to-schema-datamodel --shadow-database-url --exit-code`。  
  - **必要環境變數**：`SHADOW_DATABASE_URL`（指向可拋棄的 Postgres DB；CI/Preview 專用，勿用生產 DB）  
  - **成功條件**：exit code = 0（schema 與 migrations 一致）  
  - **常見失敗**：exit code = 2（代表 migrations 與 schema 有差異，常見於手動改 schema 卻沒產生 migration、或 migration/sql 與 schema 不一致）
- **POS 路由**：登入後為 `/pos`（側欄：收銀／訂單／促銷占位／今日報表）；後台仍為 `/admin`。Tunnel 預覽時 **`VITE_API_BASE_URL`** 須指向可連線之 API（見下文「選 B」）。
- 專案已推送到 **GitHub**（或 GitLab / Bitbucket，Vercel 支援）。
- 已註冊 [Vercel](https://vercel.com) 帳號（可用 GitHub 登入）。

---

## 步驟

### 1. 在 Vercel 匯入專案

1. 登入 [vercel.com](https://vercel.com)，點 **Add New…** → **Project**。
2. 選擇 **Import Git Repository**，選取本專案的 repo。
3. 若為第一次，依畫面授權 Vercel 存取 GitHub 並選擇該 repo。

### 2. 建置設定（已由 vercel.json 提供）

以下由根目錄的 `vercel.json` 決定，通常**不需**在 Vercel 後台改動：

- **Build Command**：`pnpm install && pnpm --filter pos-erp-frontend build`
- **Output Directory**：`frontend/dist`
- **Install Command**：`pnpm install`
- **Root Directory**：留空（使用 repo 根目錄）

若 Vercel 自動偵測到其他 framework，可手動將 **Framework Preset** 改為 **Other**，避免覆蓋上述設定。

### 3. 環境變數

在專案 **Settings → Environment Variables** 新增：

| Name | Value | 說明 |
|------|--------|------|
| `VITE_API_BASE_URL` | （見下方） | 前端呼叫後端的 base URL |
| `VITE_ADMIN_API_KEY` | （可選，與後端 `ADMIN_API_KEY` 相同） | 後端若設管理金鑰，後台 **商品寫入**、**庫存入庫／盤點（POST inventory/events）** 須帶此值 build 進前端。**勿 commit、勿公開 repo。** |

**Value 建議：**

- **僅給客戶看 UI／mockup（結帳等按鈕可能失敗）**：可留空或填 `https://example.com`，客戶仍可瀏覽畫面並對版面與流程給反饋。
- **後端也已部署**：填後端的公開網址，例如 `https://your-backend.up.railway.app`，客戶即可完整操作結帳與訂單。
- **本機後端 + Cloudflare Tunnel**：填 Tunnel 的 `https://xxxx.trycloudflare.com`（勿結尾 `/`）；**每次重開 Tunnel 網址會變，須更新此變數並 Redeploy**。見 [docs/cloudflare-tunnel-demo.md](cloudflare-tunnel-demo.md)「連線失敗」一節。
- **Named Tunnel（固定子網域）**：若使用 Cloudflare Named Tunnel，後端對外 URL 固定後，將該 **https** 設為 `VITE_API_BASE_URL`，**Redeploy** 一次即可；POS（`/pos`）與後台（`/admin`）皆同一 Vercel 來源，API 一律打此 base，無需分開設定。

儲存後建議 **Redeploy** 一次，讓新變數生效。

### 4. 部署

- 點 **Deploy**；Vercel 會執行 build 並產生一個網址，例如：  
  `https://pos-erp-xxx.vercel.app`
- 之後每次 push 到所選分支（預設為 `main`），Vercel 會自動重新部署，**連結不變**。

---

## 分享給客戶

將產生的網址（例如 `https://pos-erp-xxx.vercel.app`）傳給客戶或團隊，同一連結可多人、隨時開啟，無需再開會或螢幕分享即可收集反饋。

---

## 本機後端 + Cloudflare Tunnel（給 Vercel 前端用）

若後端暫未部署，可用 **Cloudflare Quick Tunnel** 把本機 API 變成 HTTPS，再填進 Vercel 的 `VITE_API_BASE_URL`：

1. 本機啟動後端（port 3003）與前端（5173）。  
2. 雙擊 **`scripts/CloudflareTunnel.command`**，會開 **兩個 Terminal**（後端 tunnel + 前端 tunnel）並開啟瀏覽器至 **https://bunnybeans-frontend.vercel.app/**（可在腳本或環境變數 `POS_TUNNEL_BROWSER_URL` 改成本機或其他網址）。  
3. 在「後端」那個視窗複製 `https://xxx.trycloudflare.com`，設為 Vercel 的 `VITE_API_BASE_URL` 並 Redeploy。  

詳見 **[docs/cloudflare-tunnel-demo.md](cloudflare-tunnel-demo.md)**。

### 選 B：Vercel + Tunnel（照順序做）

| 步驟 | 做什麼 |
|------|--------|
| 1 | 本機 **`DATABASE_URL`** 就緒後：`pnpm --filter pos-erp-backend exec prisma db push`（或 migrate）+ 可選 **`pnpm --filter pos-erp-backend db:seed`**。 |
| 2 | 本機只開 **後端**：`cd backend && pnpm dev`（**:3003** 有在聽）。Tunnel 運作期間**不要關**這個 process。 |
| 3 | 開 **後端 Tunnel**（Quick 或 Named 皆可）：`cloudflared tunnel --url http://localhost:3003`（或 Named 設定檔指到 3003）。複製終端機印出的 **`https://……`**（**不要**結尾 `/`）。 |
| 4 | 登入 **Vercel** → 本專案 → **Settings → Environment Variables**：新增 **`VITE_API_BASE_URL`** = 上一步的 **https 網址**（Production / Preview 依需求勾選）。若後端有設 **`ADMIN_API_KEY`**，同頁加 **`VITE_ADMIN_API_KEY`**（同值），後台寫入才會過。 |
| 5 | Vercel **Deployments** → 最新一筆右側 **⋯** → **Redeploy**（或任意 push 觸發建置）。**環境變數只在新 build 生效**，改完一定要 Redeploy。 |
| 6 | 後端 **CORS** 須允許 Vercel 網域（例如 `https://你的專案.vercel.app`）。本 repo `main.ts` 若已 `origin: true` 通常可過；若仍被擋，再對照後端 CORS 設定。 |
| 7 | 用 **Vercel 網址** 開登入頁 → **檢查後端連線**；Tunnel 視窗與後端 :3003 **都要開著**，關掉即斷線。 |

**Quick Tunnel**：每次重開網址會變 → 每次變更後都要回 Vercel 改 **`VITE_API_BASE_URL`** 再 Redeploy。**Named Tunnel**：固定子網域，改一次即可長期用。

---

## 後端定時工作與排程（發券／關帳／快照）

> 下列為「程式端已實作，仍需 infra 排程」的定時工作建議。實際 cron／排程設定由 DevOps／Infra 決定，可用平臺排程 HTTP 呼叫或自建 worker。

- **發券規則排程（CrmCouponDispatchRule）**
  - 目的：依 **CrmCouponDispatchRule** 對符合分群的會員發券，維護 `CrmMarketingJob`／`LoyaltyCouponIssue` 狀態。
  - 執行端點：**`POST /crm/jobs/run-scheduled`**（Admin；需 `X-Admin-Key`）。
  - 建議頻率：每 **5–15 分鐘** 一次即可（視實際會員量與 SLA 調整）。
  - 行為：掃描 `enabled=true`、`nextRunAt <= now` 的 dispatch-rules，為每筆建立對應 **crm job** 並更新 `nextRunAt`。

- **關帳與財務期間（FinancePeriodClose / FinanceAuditLog）**
  - 目的：限制已關帳區間寫入，並將後續金流異動寫入 **FinanceAuditLog** 供查核。
  - 關帳端點：**`POST /finance/periods/close`**（Admin；body 含 `asOfDate`、`type: daily｜monthly` 等，詳見 `api-design-inventory-finance.md`）。  
  - 解鎖端點（必要時人工操作）：**`POST /finance/periods/:id/unlock`**。
  - 建議頻率：依實務流程，一般為 **每日收盤後一次**（daily），或每月結帳時計畫呼叫 monthly。
  - 注意：`recordFinanceEvent` 會檢查目標日期是否落在已關帳期間，若是則拋出 `FINANCE_PERIOD_CLOSED`。

- **財務快照生成（Finance snapshots）**
  - 目的：將特定日期的財務彙總輸出為檔案快照，供外部報表或備查。
  - 端點：**`POST /finance/snapshots`**（Admin；body `asOfDate` + `type: daily｜monthly`，回傳 `path`、`generatedAt`、`summary`）。
  - 建議頻率：視報表需求安排，例如：
    - 每日 01:00 產生前一日 **daily snapshot**。
    - 每月第 1 天 02:00 產生上一個月份的 **monthly snapshot**。

- **監控建議**
  - 上述端點皆為同步 HTTP 呼叫：建議在排程系統中記錄 **HTTP status / latency / response body**，失敗時通知維運（Slack / Email 等）。
  - 若排程失敗，可人工重送同一日期的 `POST /crm/jobs/run-scheduled` 或 `POST /finance/snapshots`（實作已避免重複寫入造成錯誤，細節見實際回傳訊息與 `backend-error-format.md`）。

### 如何查看 job 狀態

- **`GET /ops/jobs/status`**（已實作）：回傳各定時 job 類型之**最近一次執行時間**（`lastRunAt`）、**成功與否**（`success`）、**錯誤摘要**（`message`，失敗時）。`jobType` 含：`crm-run-scheduled`、`finance-period-close`、`finance-snapshot`。需先執行 migration **20260320100000_ops_job_run_log** 建立 **OpsJobRunLog** 表。
- **`GET /ops/jobs`**（已實作）：OpsJobRunLog 列表，支援分頁與 kind 篩選。Query：`page`（預設 1）、`pageSize`（預設 20）、`kind`（jobType 篩選）。回應：`{ items: OpsJobRunLog[], total }`，依 `lastRunAt` 降序。
- **關帳**：**`GET /finance/periods`** 可查既有關帳區間（startDate／endDate／closedAt）；即為「關帳 job」的執行結果。
- **快照**：**`GET /ops/jobs/status`** 中 `finance-snapshot` 一筆即為最近一次 **`POST /finance/snapshots`** 的執行紀錄。

### 如何手動補跑

| 項目 | 做法 |
|------|------|
| 發券排程 | 呼叫 **`POST /crm/jobs/run-scheduled`**（Header **X-Admin-Key**）。會掃描 `nextRunAt <= now` 的 enabled 規則並觸發對應 segment-coupon job；可重複呼叫，已跑過的規則會更新 nextRunAt 至下一週期。 |
| 關帳 | 呼叫 **`POST /finance/periods/close`**（body 含 `startDate`、`endDate`、`merchantId` 等，見 api-design-inventory-finance）。若該區間已關帳會回 **FINANCE_PERIOD_ALREADY_CLOSED**。 |
| 快照 | 呼叫 **`POST /finance/snapshots`**（body `asOfDate`、`type: daily｜monthly`）。同一 asOfDate + type 可重複呼叫，回傳當次產生的 path／summary。 |

---

## 若之後要一併部署後端

可將後端部署到 Railway、Render、Fly.io 等，取得一個 https 網址後：

1. 在 Vercel 專案 **Settings → Environment Variables** 將 `VITE_API_BASE_URL` 設為該後端網址。
2. 在後端設定 CORS，允許前端網域（如 `https://xxx.vercel.app`）。
3. 在 Vercel 觸發 **Redeploy**，前端即會改為呼叫遠端後端。

---

## 常見錯誤與排除（後端／CI／Seed）

以下為執行 **migrate deploy**、**db:seed**、**ci:backend-with-db** 或本機後端時常見錯誤與建議解法。

| 情境 | 可能原因 | 建議解法 |
|------|----------|----------|
| **Seed 失敗**（例如 FK 違反、必填欄位缺漏） | migration 與 schema 不同步、或 seed 劇本與現行 schema 不符 | 先執行 **`pnpm --filter pos-erp-backend exec prisma migrate deploy`** 確保表結構為最新；再跑 **`pnpm db:seed`**。若仍失敗，檢查 [db-seed.md](db-seed.md) 與 `backend/prisma/seed.ts` 是否與 Prisma schema 一致。 |
| **連線逾時**（Connection timeout / ECONNREFUSED） | `DATABASE_URL` 未設、DB 未啟動、或網路／防火牆阻擋 | 確認環境變數 **`DATABASE_URL`** 已設定且可連（本機可 `psql $DATABASE_URL` 測試）。若為 CI，確認 CI 環境可連到該 DB（白名單 IP、VPN 等）。 |
| **權限不足**（permission denied、role 無法 create table） | DB 使用者無 CREATE / ALTER 權限 | 以具足夠權限的 role 設定 **`DATABASE_URL`**；或於 DB 手動授權該 role 對 schema 的權限。 |
| **Migration 失敗**（P3009：migrate found failed migrations） | 先前某次 migration 在目標 DB 上執行失敗，Prisma 標記為 failed | 依 [Prisma 文件](https://www.prisma.io/docs/guides/database/production-troubleshooting#resolve-failed-migrations) 處理：可 **resolve** 該 migration 為 rolled back 後重跑，或修復資料後標記為 applied。**勿**在生產庫隨意刪除 migration 紀錄。 |
| **從零建庫或 P3009 無法 resolve** | `migrate deploy` 無法從零建表（如 PosOrder 無 baseline migration）、或 P3009 無法依文件 resolve | **替代流程**：`prisma db push`（依 schema 建表）→ `pnpm db:seed` → `pnpm --filter pos-erp-backend test`。`db push` 不產生 migration 紀錄，正式環境仍建議 `migrate deploy`；此流程適用本機／Preview 或需快速還原時。 |
| **Jest 整合測試失敗**（Unique constraint、FK 錯誤） | 測試資料未清理、或並行執行導致同表衝突 | 確認各 integration-spec 的 **teardown**（afterAll／手動 DELETE）有執行；必要時以 **`jest --runInBand`** 改為單執行緒跑整合測試。 |

---

## 疑難排解（Vercel／前端）

- **Build 失敗**：在 Vercel 專案 **Deployments** 點進該次部署，查看 **Building** 的 log，確認 `pnpm install` 與 `pnpm --filter pos-erp-frontend build` 是否成功。
- **畫面正常但結帳／API 失敗**：多半是 `VITE_API_BASE_URL` 未設或指到錯誤網址；若目前僅需收集 UI 反饋，可先不設或留空並向客戶說明「按鈕僅供版面參考」。
- **後台促銷列表紅字：`Cannot GET /promotion-rules?...`**  
  代表 **`VITE_API_BASE_URL` 所指的那台後端** 仍是舊程式（尚未含 `PromotionModule`），或該網址根本不是 Nest API（例如誤填成靜態站）。請：
  1. 在**後端專案**拉最新程式、`pnpm --filter pos-erp-backend build`（或部署平台觸發新 build）、**重啟**後端 process。  
  2. 對該主機執行 DB migration：`pnpm --filter pos-erp-backend exec prisma migrate deploy`（或 `db push`），否則促銷表可能不存在。  
  3. 本機自測：`curl "http://localhost:3003/promotion-rules?merchantId=<你的merchantId>&status=all"` 應回 JSON 陣列（空陣列亦可），**不可**再出現 `Cannot GET`。  
  4. 遠端 API 更新後，無需改前端，只要 `VITE_API_BASE_URL` 已指向該 API 即可（Vercel 若曾改變數，記得 **Redeploy**）。
