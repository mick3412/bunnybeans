# 前後端進度紀錄與整合報告

本目錄為前後端進度紀錄與整合報告的**唯一入口**。後端／前端各自寫入對應子目錄；整合報告由彙整產生。**Agent 與人請先讀本檔**，再依下表開啟「最新」檔案。

---

## 開發指令（後端／前端 Agent）

- **[docs/AGENT-DEV-INSTRUCTIONS.md](../AGENT-DEV-INSTRUCTIONS.md)** — 必讀順序、本輪建議任務、複製貼上全文、完成後進度紀錄規則。

---

## 任務指令（docs/tasks）

具體任務的 Agent 指令見 `docs/tasks/`。  
- [TASK-order-detail-payments-2026-03-13.md](../tasks/TASK-order-detail-payments-2026-03-13.md) — **已完成對齊**（後端 PosOrderPayment + 前端明細 UI）；保留供歷史與驗收步驟參考。

---

## 最新檔案一覽

| 類型 | 最新檔案 | 最後更新 |
|------|----------|----------|
| 整合報告 | [integrated-progress-2026-03-13.md](integrated-progress-2026-03-13.md) | 2026-03-13 **22:12**（jest 12、E2E×5、finance/events、分類、Notion 日報） |
| Notion 日報 | [notion-daily-2026-03-13.md](notion-daily-2026-03-13.md) | 貼 Notion 用 |
| 後端 | [backend/backend-progress-2026-03-13.md](backend/backend-progress-2026-03-13.md) | 2026-03-13（22:12 後端紀錄同步／12 tests） |
| 前端 | [frontend/frontend-progress-pos-2026-03-13.md](frontend/frontend-progress-pos-2026-03-13.md) | 2026-03-13 22:12（returns/stock、E2E×5、3003 維運） |

---

## 更新規則（Agent / 人）

- **後端**：進度寫入 `backend/backend-progress-YYYY-MM-DD.md`（當日已有檔則在同一檔內更新並追加「本日變更紀錄」）。完成後**更新本表該列的「最後更新」**為該日期。
- **前端**：進度寫入 `frontend/frontend-progress-pos-YYYY-MM-DD.md`（當日已有檔則在同一檔內更新並追加「本日變更紀錄」）。完成後**更新本表該列的「最後更新」**。
- **整合報告**：採**依日一檔** `integrated-progress-YYYY-MM-DD.md`；彙整時新日開新檔，並更新本表「整合報告」列與最後更新日。歷史可依日回溯。

---

## 各端當日進度檔格式

- **上方：當前狀態（可改寫）**  
  今日完成、卡點、To Do、需要對方配合（前端可選）。每次更新可改寫為最新內容，代表「目前」狀態。
- **下方：本日變更紀錄（僅追加、不刪不改）**  
  在檔案最下方設區段「本日變更紀錄」，每次更新當日進度時**只在此區塊追加**一筆；**行首時間須為實際寫入當下**（勿虛構），見 [docs/daily-progress-format.md](../daily-progress-format.md)。  
  **禁止刪除或改寫此區塊**，僅可追加新行。

---

## 小結

- 最新路徑以**本表**為準；Agent 先讀本檔再開對應連結。
- 寫入進度後請更新本表「最後更新」欄位。
- 同一天多次更新時：上方當前狀態可改寫；「本日變更紀錄」僅追加，以保留當日 log。
