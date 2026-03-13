# Cloudflare Tunnel 雙視窗 + 瀏覽器測試

---

## 一鍵執行（推薦，免改 Vercel）

每次 Quick Tunnel 網址都變，若還要改 Vercel + Redeploy 會很煩。**一鍵腳本**會：

1. 啟動後端（3003）  
2. 啟動 **一條** Tunnel 指到後端  
3. **自動**把該 `https://xxx.trycloudflare.com` 設成當次前端的 `VITE_API_BASE_URL`  
4. 啟動前端（5173）並開瀏覽器 **http://localhost:5173**

這樣本機 POS 一定連到「當次 Tunnel」，不必手抄網址、不必動 Vercel。

```bash
bash scripts/one-click-tunnel-dev.sh
```

或雙擊 **`scripts/OneClickTunnelDev.command`**。結束時在該 Terminal **Ctrl+C**，會關後端 + Tunnel + 前端。

| 誰要連哪裡 | 網址 |
|------------|------|
| 你自己用 POS | `http://localhost:5173` |
| 手機／同事測 **API** | 腳本印出的 `https://xxx.trycloudflare.com`（例如 `/health`） |
| 同事用 **完整 POS** | 仍須本機前端或另開前端 Tunnel；或部署 Named Tunnel + 固定網域 |

### Named Tunnel／固定網域（與 CORS）

- Cloudflare Zero Trust 建立 **Named Tunnel**，綁定固定子網域（例如 `api.example.com`）指向本機或伺服器 **3003**。
- 後端已 `enableCors()`；若生產需限縮來源，請在 Nest 設定允許 **`https://你的前端.vercel.app`**（及本機 `http://localhost:5173` 開發用）。
- 前端 **Vercel** 設 `VITE_API_BASE_URL=https://api.example.com` 後 **Redeploy 一次** 即可長期對應，無需每輪改 Quick Tunnel 網址。

---

## 雙視窗流程（舊版，仍可用）

用 **兩個 Terminal** 各跑一條 Cloudflare **Quick Tunnel**（`trycloudflare.com`），把本機後端與前端暴露成 HTTPS，方便遠端或手機測試；並自動開啟本機瀏覽器做本機驗證。

---

## 前置

1. 安裝 **cloudflared**（僅需一次）  
   ```bash
   brew install cloudflared
   ```
2. 本機須已有 **後端**（預設 port `3003`）與 **前端**（預設 port `5173`）。  
   - 可雙擊 **`scripts/Dev.command`** 先啟動（會開瀏覽器；關閉瀏覽器後會停服務）。  
   - 或自行在兩個終端分別跑：  
     `pnpm --filter pos-erp-backend dev`  
     `pnpm --filter pos-erp-frontend dev`

---

## 使用方式

1. 確認後端、前端已在跑。  
2. 雙擊 **`scripts/CloudflareTunnel.command`**（或在終端執行 `bash scripts/start-cloudflare-tunnels.sh`）。  
3. 會開啟 **兩個 Terminal 視窗**：  
   - **視窗 A**：Tunnel → `http://127.0.0.1:3003`（後端）  
   - **視窗 B**：Tunnel → `http://127.0.0.1:5173`（前端）  
4. 每個視窗內會出現一個 **`https://……trycloudflare.com`**，複製即可分享。  
5. 腳本約 3 秒後會用預設瀏覽器開啟 **`https://bunnybeans-frontend.vercel.app/`**（Vercel 前端）；若要改開本機前端可設 `POS_TUNNEL_BROWSER_URL=http://localhost:5173`。

---

## 常見測試組合

| 情境 | 做法 |
|------|------|
| 遠端只看 UI、API 仍打本機 | 僅分享「前端」那條 trycloudflare 網址（同源問題下 API 可能需後端 CORS／或改打後端 tunnel URL）。 |
| **Vercel 前端 + 本機後端 tunnel**（與 deploy-preview 一致） | 複製 **後端** tunnel 的 `https://xxx.trycloudflare.com`，到 Vercel 設定 **`VITE_API_BASE_URL`**（勿結尾斜線），Redeploy。客戶開 Vercel 網址即可連你電腦上的 API。 |
| 兩條都給同事 | 後端 URL 設進前端環境或說明「先開後端 tunnel 再開前端 tunnel 網址」；注意 Quick Tunnel 每次重開網址會變。 |

---

## 環境變數（可選）

在執行腳本前可覆寫 port 或瀏覽器開啟網址：

```bash
export POS_TUNNEL_BACKEND_PORT=3003
export POS_TUNNEL_FRONTEND_PORT=5173
export POS_TUNNEL_BROWSER_URL=https://bunnybeans-frontend.vercel.app/
# 或本機：export POS_TUNNEL_BROWSER_URL=http://localhost:5173
bash scripts/start-cloudflare-tunnels.sh
```

---

## 連線失敗（登入頁「無法連線到後端」）

常見原因與對策：

| 原因 | 對策 |
|------|------|
| **Vercel 未設或設錯 API 網址** | 前端打包時會把 `VITE_API_BASE_URL` 寫進 JS。請在 Vercel → Project → **Settings → Environment Variables** 新增 **`VITE_API_BASE_URL`** = 後端 Tunnel 的完整 `https://xxxx.trycloudflare.com`（**不要**結尾 `/`）。儲存後到 **Deployments → Redeploy**（僅改變數不會自動重打舊 build）。 |
| **每次重開 Tunnel 網址都變** | Quick Tunnel 每開一次都是新網址。舊的 Vercel 變數仍指舊網址 → 必須把 **新後端網址** 再貼進 Vercel、再 **Redeploy**。 |
| **後端沒起來或 port 錯** | 本機須先跑 `pnpm --filter pos-erp-backend dev`（預設 **3003**）。Tunnel 視窗要對 `http://127.0.0.1:3003`。 |
| **Tunnel 視窗被關掉** | cloudflared 一關，對外網址立刻失效；重新開 Tunnel 後要更新 Vercel 並 Redeploy。 |
| **本機開 Vercel 卻沒設變數** | 未設時瀏覽器會去打 `localhost:3003`——那是「你自己電腦」的後端；若本機沒跑後端仍會失敗。設好 `VITE_API_BASE_URL` 為 Tunnel 後，才會打到 Tunnel。 |

**最短檢查清單**

1. 本機後端在跑、瀏覽器能開 `http://localhost:3003/health` 有 JSON。  
2. Tunnel 視窗 A 已出現 `https://xxx.trycloudflare.com`，且該網址在瀏覽器開 `/health` 也有 JSON。  
3. Vercel 的 `VITE_API_BASE_URL` = 該 **同一個** https 網址，且已 **Redeploy** 過。  

---

## 注意

- Quick Tunnel **免費、免登入**，但每次啟動 **網址不同**；關掉 Terminal 即失效。  
- 正式對外建議改用 [Cloudflare Named Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) 固定網域。  
- 本機關機或關 tunnel 後，Vercel 上若仍指舊 URL，API 會失敗，需換新 URL 再 Redeploy。
