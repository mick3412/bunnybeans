---
title: 門市端維運（備份 / 更新 / 診斷包）
audience: 門市人員 / 門市主管（不需 IT 背景）
---

## 你需要知道的重點（先看這段就夠用）

- **每天會自動備份一次**：把資料庫備份（加密）後上傳到 `bunnybeans` 專用 Google Drive。
- **遇到問題先匯出診斷包**：一鍵匯出（加密）後會自動上傳；若上傳失敗也會留在本機，方便交給客服。
- **更新只要按「檢查更新」**：更新前系統會先自動備份，避免更新失敗造成資料風險。

---

## 1) 這台門市電腦上的資料放哪裡？

系統資料固定放在：

- `C:\ProgramData\bunnybeans\`

你通常只會用到這幾個資料夾（給客服/工程支援時會用）：

- `C:\ProgramData\bunnybeans\backups\`：資料備份檔（加密）
- `C:\ProgramData\bunnybeans\diagnostics\`：診斷包（加密）
- `C:\ProgramData\bunnybeans\logs\`：系統記錄（log）

注意：

- 請勿手動刪除 `C:\ProgramData\bunnybeans\` 內檔案，避免影響資料還原與問題排查。

## 圖示

- （待補）`docs/manual/assets/appendix_store_ops_paths_01.png`

---

## 2) 每日自動備份如何運作？

### 觸發時機（不用你操作）

- 通常會在 **每天第一次打開 `bunnybeans`** 時自動執行（因為門市電腦每天會關機）。
- 如果昨天備份/上傳失敗，今天打開後會自動補送。

### 上傳到哪裡？

- 上傳到 **`bunnybeans` 專用 Google Drive** 的備份資料夾（依店別 `storeId` 分資料夾）。

### 你要檢查什麼？

只需要確保：

- 這台電腦 **能上網**
- Google Drive **已登入**（若出現登入提示，照畫面登入一次即可）

## 圖示

- （待補）`docs/manual/assets/appendix_store_ops_daily_backup_01.png`

---

## 3) 看到錯誤或系統異常怎麼做？

### 最推薦（1 分鐘完成）：匯出診斷包

1. 打開 `bunnybeans`
2. 進入「設定 / 支援」（以畫面上的選單名稱為準）
3. 點「**匯出診斷包**」（以畫面按鈕文字為準）
4. 等待完成提示（通常會自動上傳到 Google Drive）

若顯示上傳失敗：

- 不用慌，診斷包仍會保留在本機：
  - `C:\ProgramData\bunnybeans\diagnostics\pending\`
- 你可以把檔案交給客服（例如用隨身碟或其他公司允許的方式傳送）。

### 你需要提供給客服的資訊（請照抄）

- 門市名稱（或你們內部門市代號）
- 發生時間（大約幾點）
- 發生動作（例：掃描條碼結帳、列印、退貨）
- 是否能正常上網
- 是否已匯出診斷包（有/沒有）

## 圖示

- （待補）`docs/manual/assets/appendix_store_ops_export_diagnostics_01.png`

---

## 4) 如何更新版本（門市自行操作）

1. 打開 `bunnybeans`
2. 進入「設定」
3. 點「**檢查更新**」（以畫面按鈕文字為準）
4. 若有更新，點「下載並更新」

更新過程中的重要機制：

- **更新前會自動備份資料**（避免更新失敗造成資料風險）
- 更新完成後會自動重啟

若更新失敗：

- 請先「匯出診斷包」並聯繫客服
- 不要重複狂點更新（避免增加排查成本）

## 圖示

- （待補）`docs/manual/assets/appendix_store_ops_check_update_01.png`

---

## 5) 列印與條碼掃描的常見注意事項

### 條碼掃描槍（鍵盤式）

- 掃描後等同「鍵盤輸入一串字 + Enter」
- 若掃描沒反應，最常見原因是 **游標不在可輸入欄位**
  - 建議點一下 POS 的「搜尋/掃碼輸入框」再掃一次

## 圖示

- （待補）`docs/manual/assets/appendix_store_ops_scanner_focus_01.png`

### A4 列印

- 請先確認 Windows 已安裝並可正常列印該 A4 印表機
- 若列印空白/格式跑掉：
  - 先用「匯出診斷包」
  - 再回報客服「使用的印表機型號 + Windows 印表機名稱」

## 圖示

- （待補）`docs/manual/assets/appendix_store_ops_a4_print_01.png`
