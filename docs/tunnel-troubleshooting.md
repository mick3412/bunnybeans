# Tunnel 仍連不上 — 除錯與替代方案

## 一、一鍵診斷（先看結果再猜）

專案根目錄執行：

```bash
bash scripts/tunnel-diagnose.sh
```

若你已有一條 trycloudflare 網址（腳本剛印的），再測**從本機打過去**是否正常：

```bash
bash scripts/tunnel-diagnose.sh 'https://你的子網域.trycloudflare.com'
```

| 診斷區塊 | 代表意義 |
|----------|----------|
| [1] 無 cloudflared | 先 `brew install cloudflared` |
| [2] trycloudflare.com 都解析不到 | 本機／公司 DNS 或網路擋，換 **1.1.1.1** 或手機熱點 |
| [3] 3003 FAIL | 後端沒起或崩潰 |
| [4] 5173 FAIL | 前端沒起；遠端只測 API 可只 Tunnel 3003 |
| [6] 子網域 **NXDOMAIN** | 該次 Tunnel **已關**，網址作廢，**重跑** cloudflared 拿**新**網址 |
| [6] **502** | Cloudflare 有接到，但連不到你本機 origin（對應 port 沒聽或掛了） |
| [6] **200** | 邊緣正常；若客戶仍開不了 → 多半是客戶端 DNS／擋 trycloudflare |

---

## 二、手動拆步驟（最容易看出錯在哪）

1. **只開後端**  
   `pnpm --filter pos-erp-backend dev`  
   瀏覽器開 `http://127.0.0.1:3003/health` → 要有 JSON。

2. **只開一條 API Tunnel（不要關這個視窗）**  
   ```bash
   cloudflared tunnel --url http://127.0.0.1:3003
   ```  
   等終端機出現 `https://xxxx.trycloudflare.com`，**立刻**在本機另開分頁打：  
   `https://xxxx.trycloudflare.com/health`  
   - 若這裡就 **NXDOMAIN** → DNS／Tunnel 註冊問題，或 cloudflared 版本過舊（`cloudflared update`）。  
   - 若 **502** → 本機 3003 沒起或關了。  
   - 若 **200** → API Tunnel 這段沒問題。

3. **再開前端 + 第二條 Tunnel**（問題多半在這段）  
   另開 Terminal：`VITE_API_BASE_URL=https://上一步的API網址 pnpm --filter pos-erp-frontend dev`  
   確認 `http://127.0.0.1:5173/` 本機可開。  
   再開**第三個** Terminal：  
   `cloudflared tunnel --url http://127.0.0.1:5173`  
   用印出的 **第二條** https 開首頁。

任一步失敗，錯誤就在**那一步**（不用猜是 Vite 還是 DNS）。

---

## 三、替代方案（不依賴雙條 Quick Tunnel）

| 方案 | 做法 | 優點 |
|------|------|------|
| **Vercel + 只 Tunnel 後端** | 前端部署 Vercel；環境變數 `VITE_API_BASE_URL` = **API 那條** trycloudflare；Redeploy。客戶永遠開 **固定 Vercel 網址**。 | 客戶不碰 trycloudflare 前端網址；少一條 Tunnel。 |
| **ngrok** | `brew install ngrok`，`ngrok http 3003`（後端）／`ngrok http 5173`（前端） | 有時在公司網比 trycloudflare 好連。 |
| **localtunnel** | `npx localtunnel --port 5173` | 免裝 cloudflared；穩定性視環境。 |
| **Named Tunnel（Cloudflare）** | Zero Trust 後台建固定子網域 | 網址固定、較像正式環境。 |
| **後端丟 Railway / Render** | 部署 API + DB | 客戶驗收最穩，不必你電腦一直開著。 |

---

## 四、常見誤會

- **舊網址再開** → Quick Tunnel 關掉後子網域會 **NXDOMAIN**，不是「壞掉」，是**過期**。  
- **腳本關了還開同一條** → 一定掛。  
- **本機能開、客戶 NXDOMAIN** → 客戶 DNS 或電信對 `*.trycloudflare.com` 行為不同，請客戶換網路或你用 Vercel+API Tunnel。

---

## 五、日誌位置（腳本自動寫入）

| 檔案 | 內容 |
|------|------|
| `/tmp/pos-backend-remote.log` | 後端（remote 腳本） |
| `/tmp/pos-frontend-remote.log` | 前端 |
| 手動跑 cloudflared 的視窗 | 即時連線錯誤最準 |
