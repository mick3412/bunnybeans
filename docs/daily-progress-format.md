# 每日開發進度格式說明

本文件定義「今日開發進度」的輸出格式，與 Notion 上的「今日完成 / 卡點 / To Do」三欄對應。  
當你在 Cursor 中下達 **「產生今日開發進度」** 時，AI 會依此格式產出內容，供你複製貼到 Notion。

---

## 三欄對應

| Notion 欄位 | 說明 |
|-------------|------|
| **今日完成** | 當天已完成的具體事項（以 git 與對話為依據） |
| **卡點** | 目前遇到的障礙或阻塞；無則填「無」 |
| **To Do** | 接下來要做的事，每項為可執行的一小步 |

---

## 輸出範例

```markdown
## 今日完成
- 開發規格討論
- 新增 DEVELOPMENT-GUIDELINES.md 開發守則

## 卡點
- 無

## To Do
- 確認 Cyberbiz 功能範圍 & API
- 依 erp-spec 拆 Phase 1 / Phase 2 開發範圍
```

---

## 使用方式

1. 在 Cursor Chat 輸入：**產生今日開發進度**
2. 將 AI 產出的三個區塊複製到 Notion 對應欄位（或整段貼到一則新頁面再手動分欄）。
3. 若有需要，在 Notion 上微調或補上 AI 未掌握的項目。

Cursor 規則檔：[.cursor/rules/daily-progress.mdc](../.cursor/rules/daily-progress.mdc)

---

## docs/progress 各端檔案格式

寫入 **`docs/progress/`** 的進度檔（後端、前端當日紀錄）請依下列約定，**最新檔案路徑以 [docs/progress/README.md](progress/README.md) 為準**。

### 檔名與位置

- 後端：`docs/progress/backend/backend-progress-YYYY-MM-DD.md`
- 前端：`docs/progress/frontend/frontend-progress-pos-YYYY-MM-DD.md`
- 整合報告：`docs/progress/integrated-progress-YYYY-MM-DD.md`（依日一檔，彙整時新日開新檔）

### 當日進度檔的兩區塊

1. **上方：當前狀態（可改寫）**
   - **今日完成**（必填）：條列當日完成事項。
   - **卡點**（必填）：無則填「無」。
   - **To Do**（必填）：接下來可執行的小步。
   - **需要對方配合**（選填，前端建議保留）：需後端／前端配合的項目。
   - 前端可另加「目前使用的 API 與狀態」等補充區段。
   - 每次更新可改寫上述區段，代表「目前」狀態。

2. **下方：本日變更紀錄（僅追加、不刪不改）**
   - 在檔案**最下方**設區段 **「本日變更紀錄」**。
   - 每次更新當日進度時，**只在此區塊追加**一筆，格式例如：
     - `- 10:00 今日完成：新增 POS 整合測試`
     - `- 14:30 更新：今日完成追加「業務錯誤碼」；卡點改為無`
   - **禁止刪除或改寫此區塊**，僅可追加新行。同一天多次更新即可保留時間序 log。
   - **時間必須真實**：行首 `HH:MM` 須為**實際寫入該筆紀錄的當下時間**（看系統時鐘，或終端執行 `date +%H:%M`）。**禁止隨意捏造時間**，以免 log 失序或誤導。若無法取得精確分鐘，可改用「日期 + 簡述」如 `- 2026-03-13 晚間 更新：…`，但仍應反映真實提交時段，勿瞎掰。

### 更新後

- 寫入進度後請更新 [docs/progress/README.md](progress/README.md) 中該端的「最後更新」欄位。
