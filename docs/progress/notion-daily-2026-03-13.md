# POS ERP｜開發日報 2026-03-13

> **用途**：複製以下區塊貼入 Notion（建議：每日一頁或資料庫一列；標題可當 Page title，表格可貼成 Notion Table）。

---

## Notion 建議屬性（若用 Database）

| 屬性名稱 | 建議值 |
|----------|--------|
| **日期** | 2026-03-13 |
| **狀態** | 進行中／本日已彙整 |
| **最後更新** | 22:12（後端／前端進度檔對齊） |

---

## 今日整體摘要（一句）

後端：**jest 12 passed**（4 suites）、**GET /finance/events**、**Category POST/PATCH**（Admin Key）、退貨入庫 **returns/stock**；前端：**E2E 5 passed**、退貨入庫 UI 改打 **`/returns/stock`**、**AdminCategoriesPage**、維運備註 **3003 單一實例**。

---

## 後端｜今日完成

- **POS**：建單、賒帳、補款、退款、**退貨入庫**（`POST .../returns/stock`，舊路徑相容）、`RETURN_FROM_CUSTOMER`、`POS_RETURN_*` 錯誤碼。
- **只讀報表前置**：**GET /finance/events**（partyId、referenceId、type、from/to、分頁）。
- **分類維護**：**POST/PATCH /categories**（與商品相同受 **ADMIN_API_KEY**／**X-Admin-Key** 保護）。
- **守門**：可選 **ADMIN_API_KEY**；Inventory events、Products、Categories 寫入需 header。
- **CI**：`backend-ci.yml`（Postgres、db push、seed、test）。
- **測試**：整合測試 **12 passed**（Inventory、Finance、Category、POS）。

---

## 前端｜今日完成

- **訂單明細**：退款 UI、**退貨入庫**（`postReturnToStock` → **`/pos/orders/:id/returns/stock`**）、201 成功提示、**e2e-detail-return-success**。
- **E2E**：**5 spec** 全過—Admin smoke、全額結帳、掛帳補款、退款、**退貨入庫**（`waitForResponse` 斷言 201）。
- **後台**：商家／門市／**倉庫 CRUD**、**分類頁** `/admin/categories`、**X-Admin-Key**（`VITE_ADMIN_API_KEY`）。
- **體驗**：LoginPage Tunnel／ADMIN 說明 `<details>`；**ERROR_CODE_MAP** 補 `POS_STORE_NO_WAREHOUSE`、`POS_RETURN_*`。

---

## 卡點／風險

| 項目 | 說明 |
|------|------|
| **EADDRINUSE :3003** | 本機僅保留**一個**後端佔 3003，否則 E2E 可能 404。 |
| **Playwright 沙盒** | Cursor 內建終端若沙盒化瀏覽器路徑，建議本機 Terminal 或 **POS-E2E.app** 跑 E2E。 |

---

## 明日／下一步（待辦）

| 優先 | 後端 | 前端 |
|------|------|------|
| P1 | Playwright job 與 backend-ci 串接（可選） | **e2e.yml** 對齊 **5 spec** |
| P1 | 部署 migrate + seed 說明 | 生產 **VITE_ADMIN_API_KEY** 與後端同 key |
| P2 | 報表 API 擴充（依產品） | **報表 MVP**、Admin **toast** |
| P3 | — | 可選 ADMIN_KEY 商品建檔 E2E |

---

## 本日變更時間軸（精簡）

（詳見 repo：`docs/progress/backend/backend-progress-2026-03-13.md`、`frontend/frontend-progress-pos-2026-03-13.md` 本日變更區—**須以實際寫入 HH:MM 為準**。）

- 後端末筆紀錄：**22:12**—12 tests、GET finance/events、Category POST/PATCH。
- 前端末筆紀錄：**22:12**—returns/stock、5 passed、3003 單實例備註。

---

## 相關文件（Repo）

- 整合報告：`docs/progress/integrated-progress-2026-03-13.md`
- Agent 指令：`docs/AGENT-DEV-INSTRUCTIONS.md`
- api-design-pos（含 returns/stock）、api-design-inventory-finance、e2e-pos.md
