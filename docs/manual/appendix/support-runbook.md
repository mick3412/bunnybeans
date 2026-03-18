---
title: 客服 / 工程支援手冊（Drive 備份、診斷、還原、回滾）
audience: 客服 / 工程支援 / 內部運維（需要處理客戶問題）
---

## 0) 本手冊範圍與假設

本手冊針對 `bunnybeans` 門市單機交付情境：

- Windows PC：門市每天關機
- App：Electron（React/TS）
- 後端：本機服務（localhost）
- DB：PostgreSQL
- 雲端：你方 **專用 Google Drive（OAuth）** 只存「加密檔」
- 加密：**全客戶共用一把金鑰**（支援金鑰輪替）

---

## 1) 你要先拿到的關鍵資訊（客服問診模板）

每次案件至少拿到：

- **門市名稱**（或客戶代號）
- **發生時間**（大約即可）
- **操作情境**：掃碼 / 結帳 / 列印 / 退貨 / 匯入 / 更新…
- **App 版本**（畫面通常可顯示）
- **是否可上網**、是否出現 Google Drive 登入提示
- **是否已匯出診斷包**（有/沒有）

如果客戶能配合，請再拿：

- `storeId`（UUID，App 設定頁或本機檔案）
- 近期是否有「檢查更新」與是否更新成功

---

## 2) 本機資料與檔案位置（Windows）

根目錄：

- `C:\ProgramData\bunnybeans\`

常用目錄：

- `meta\`：`storeId`、上次備份/上傳狀態
- `logs\`：rolling logs（原始問題線索）
- `diagnostics\pending\`：診斷包（加密，等待上傳）
- `diagnostics\sent\`：診斷包（已上傳快取）
- `backups\pending\`：備份檔（加密，等待上傳）
- `backups\sent\`：備份檔（已上傳快取）
- `queue\`：上傳隊列與重試狀態

客服/工程常見動作：

- 客戶「匯出診斷包」後，若上傳失敗，可請客戶到 `diagnostics\pending\` 取出最新檔提供。

## 圖示

- （待補）`docs/manual/assets/appendix_support_runbook_paths_01.png`

---

## 3) Google Drive 查找規則（你方專用帳號）

固定根資料夾：

- `/bunnybeans/`

分流：

- `/bunnybeans/backups/<storeId>/YYYY/MM/`
- `/bunnybeans/diagnostics/<storeId>/YYYY/MM/`

檔名（關鍵字）：

- 備份：`backup_<storeId>_<appVersion>_<timestamp>_<dbSchemaVersion>...`
- 診斷：`diag_<storeId>_<appVersion>_<timestamp>...`

實務建議：

- 先用 Drive 搜尋 `storeId`（UUID）通常最快。
- 若只有門市名稱但沒有 `storeId`：請客戶在 App 設定頁抄給你，或由 `C:\ProgramData\bunnybeans\meta\` 取得。

## 圖示

- （待補）`docs/manual/assets/appendix_support_runbook_drive_01.png`

---

## 4) 上傳失敗/缺檔的處理順序

### 4.1 Drive 上傳失敗

先問：

- 是否能正常上網
- 是否出現 Google Drive 需要重新登入

再做：

- 請客戶重新打開 App（啟動時會先補送 `pending`）
- 仍失敗：請客戶一鍵匯出診斷包，改走人工取得最新檔案

### 4.2 Drive 上缺少「備份」

可能原因：

- 客戶當天沒有開 App（備份以「開機/開 App 後補做」為主）
- 前一天網路不通，檔案仍卡在本機 `backups\pending\`

處理方式：

- 讓客戶打開 App 並保持連線 3–5 分鐘（讓補送跑完）
- 必要時請客戶提供 `backups\pending\` 最新檔案

---

## 5) 解密與檔案驗證（工程流程）

### 5.1 金鑰與輪替（共用金鑰）

建議工程端保存：

- `key_current`（新檔預設使用）
- `key_previous`（過渡期解舊檔）

驗證：

- 解密成功
- 解壓成功
- dump 檔可被 `pg_restore` 讀取（至少能列出內容）

### 5.2 診斷包優先級

排查時優先拿：

1. 最新 `diag_*.zip.enc`（含版本、log、錯誤摘要）
2. 再視需要追 `logs\` 的原始 log

---

## 6) 資料庫還原 Runbook（標準作業）

> 目標：在「客戶機器或工程環境」把 DB 還原到某次備份點，用來復原營運或重現 bug。

### 6.1 還原前檢查

- 確認客戶同意（資料可能包含個資）
- 取得正確的備份檔（對應 `storeId` + 時間）
- 確認版本資訊：
  - `appVersion`
  - `dbSchemaVersion`（若有）

### 6.2 還原順序（原則）

- **先停服務**（避免寫入）
- **先備份現況**（就算壞也要先留一份）
- **再還原目標備份**
- **啟動服務做健康檢查**

### 6.3 還原後健康檢查（最小）

- App 能正常啟動
- 能正常登入/進入主畫面
- POS 基本流程（掃碼→結帳→列印）可走通

若檢查失敗：

- 先不要讓門市繼續營運
- 匯出診斷包、回報工程處理

---

## 7) 更新失敗/回滾處理

### 7.1 更新失敗時你要拿什麼

- 最新診斷包（含更新過程 log）
- 更新前自動備份對應的 `backup_*.enc`

### 7.2 回滾策略（最低要求）

- 可重裝上一版 App
- 必要時可用更新前的備份做 DB 還原

---

## 8) 客服回覆話術（可直接複製貼上）

### 請客戶匯出診斷包

「請你打開 `bunnybeans` → 到『設定 / 支援』（以畫面上的同等選單名稱為準）→ 點『匯出診斷包』（以畫面上的同等按鈕文字為準）。若顯示上傳失敗也沒關係，檔案會留在 `C:\ProgramData\bunnybeans\diagnostics\pending\`，請把最新那個檔案提供給我們。」

## 圖示

- （待補）`docs/manual/assets/appendix_support_runbook_export_diagnostics_01.png`

### 請客戶補送備份/診斷

「請你先確認電腦可以上網，然後重新開啟 `bunnybeans` 並保持開著約 3–5 分鐘，系統會自動把先前失敗的備份/診斷重新上傳。」

