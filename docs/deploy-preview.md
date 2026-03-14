# 前端預覽部署（Vercel）

本文件說明如何將 POS 前端部署到 Vercel，讓客戶或多人透過**同一個固定連結**遠端查看 mockup 並收集反饋。

專案根目錄已包含 [vercel.json](../vercel.json)，會從 monorepo 建置前端並輸出 `frontend/dist`，無需在 Vercel 後台手動設定 Root Directory。

---

## 前置

- **部署順序（與前端約定）**：**後端先上線**再依賴促銷／POS 新欄位。正式或 Preview DB 請執行 **`pnpm --filter pos-erp-backend exec prisma migrate deploy`**（須含 **`20260314180000_promotion_rules_pos_discount`**、**`20260315180000_bulk_import_job`** 等之後 migration）；**勿**僅 `db push` 於已有資料的生產庫時跳過 migration。完成後可選 **`pnpm --filter pos-erp-backend db:seed`**（僅測試／Preview；**seed 會清空業務表**，見 [db-seed.md](db-seed.md)）；生產依政策。再開前端或 Redeploy Vercel。
- **後端**（若前端改接真實 API）：本機可 `db push`；**生產建議 `migrate deploy`** + seed 政策與上項一致。
- **單一 3003**：本機／Tunnel **僅允許一個後端 process 佔用 :3003**，多開會導致促銷 preview、Dashboard、E2E 打到舊 process → **404 或舊 schema**。
- **E2E**：後端預設 **port 3003**；腳本需 **`DATABASE_URL` + seed** 後再起 API。固定 `storeId`／`productId` 請見 [docs/db-seed.md](db-seed.md)「E2E 前置與固定識別」。
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

## 若之後要一併部署後端

可將後端部署到 Railway、Render、Fly.io 等，取得一個 https 網址後：

1. 在 Vercel 專案 **Settings → Environment Variables** 將 `VITE_API_BASE_URL` 設為該後端網址。
2. 在後端設定 CORS，允許前端網域（如 `https://xxx.vercel.app`）。
3. 在 Vercel 觸發 **Redeploy**，前端即會改為呼叫遠端後端。

---

## 疑難排解

- **Build 失敗**：在 Vercel 專案 **Deployments** 點進該次部署，查看 **Building** 的 log，確認 `pnpm install` 與 `pnpm --filter pos-erp-frontend build` 是否成功。
- **畫面正常但結帳／API 失敗**：多半是 `VITE_API_BASE_URL` 未設或指到錯誤網址；若目前僅需收集 UI 反饋，可先不設或留空並向客戶說明「按鈕僅供版面參考」。
- **後台促銷列表紅字：`Cannot GET /promotion-rules?...`**  
  代表 **`VITE_API_BASE_URL` 所指的那台後端** 仍是舊程式（尚未含 `PromotionModule`），或該網址根本不是 Nest API（例如誤填成靜態站）。請：
  1. 在**後端專案**拉最新程式、`pnpm --filter pos-erp-backend build`（或部署平台觸發新 build）、**重啟**後端 process。  
  2. 對該主機執行 DB migration：`pnpm --filter pos-erp-backend exec prisma migrate deploy`（或 `db push`），否則促銷表可能不存在。  
  3. 本機自測：`curl "http://localhost:3003/promotion-rules?merchantId=<你的merchantId>&status=all"` 應回 JSON 陣列（空陣列亦可），**不可**再出現 `Cannot GET`。  
  4. 遠端 API 更新後，無需改前端，只要 `VITE_API_BASE_URL` 已指向該 API 即可（Vercel 若曾改變數，記得 **Redeploy**）。
