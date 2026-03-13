# 前端預覽部署（Vercel）

本文件說明如何將 POS 前端部署到 Vercel，讓客戶或多人透過**同一個固定連結**遠端查看 mockup 並收集反饋。

專案根目錄已包含 [vercel.json](../vercel.json)，會從 monorepo 建置前端並輸出 `frontend/dist`，無需在 Vercel 後台手動設定 Root Directory。

---

## 前置

- **後端**（若前端改接真實 API）：部署或本機啟動前請執行 `pnpm --filter pos-erp-backend exec prisma db push`（或 `migrate deploy`）並可選 `pnpm --filter pos-erp-backend db:seed`，使 schema 與種子資料與 repo 一致。
- **E2E**：後端預設 **port 3003**；腳本需 **`DATABASE_URL` + seed** 後再起 API。固定 `storeId`／`productId` 請見 [docs/db-seed.md](db-seed.md)「E2E 前置與固定識別」。
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
