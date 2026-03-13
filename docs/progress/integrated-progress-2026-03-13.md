# 前後端整合進度報告與開發計畫 2026-03-13

> 整合自 [`backend-progress-2026-03-13.md`](backend/backend-progress-2026-03-13.md) 與 [`frontend-progress-pos-2026-03-13.md`](frontend/frontend-progress-pos-2026-03-13.md)。  
> **Notion 日報**（貼上即用）：[`notion-daily-2026-03-13.md`](notion-daily-2026-03-13.md)  
> **最後彙整（對齊 AGENT §五）**：後端 **jest 14 passed**、**Category POST/PATCH/DELETE**（409 `CATEGORY_IN_USE`）、**GET /health** `db`+`gitSha`；前端 **E2E 5**、**分類維護完整 CRUD**（`createCategory`／`updateCategory`／`deleteCategory` + **X-Admin-Key**）、退貨入庫 **`/returns/stock`**；產品決策 **多 SKU = 多款式**（見 [`AGENT-DEV-INSTRUCTIONS.md`](../AGENT-DEV-INSTRUCTIONS.md)）。

---

## 零、同步摘要（一眼表）

| 主題 | 後端 | 前端 | 狀態 |
|------|------|------|------|
| POS | 建單、賒帳、補款、退款、**returns/stock**（退貨入庫） | 明細退款 + **退貨入庫** + **5 E2E** | **已對齊** |
| 金流只讀 | **GET /finance/events** 分頁 | 報表可接 | **後端已上** |
| 分類（§五） | **POST/PATCH/DELETE /categories** + Admin Key；**DELETE** → 204／409 | **分類維護** 新增／編輯／刪除 + **needsAdminKey** | **已對齊、計畫完成** |
| E2E / CI | backend-ci；**jest 14** | **5 spec**；one-click／App | **已對齊** |
| 後台 | ADMIN_KEY、inventory、health | 分類 CRUD、商品／倉庫等、X-Admin-Key | **已交付** |
| 角色 | — | — | [admin-roles.md](../admin-roles.md) |

---

## 一、後端現況（摘要）

- **00:39（§五）**：**DELETE /categories/:id**、`CATEGORY_IN_USE`；**GET /health**；**jest 14**；其餘見 backend-progress 今日完成。

---

## 二、前端現況（摘要）

- **00:39（§五）**：分類頁 **完整 CRUD**；`adminApi` + **X-Admin-Key**；**5 E2E**；**returns/stock**；本機 **僅一後端 :3003**。

---

## 三、下一步開發計畫

| 優先 | 項目 | 後端 | 前端 | 維運 |
|------|------|------|------|------|
| P1 | CI／E2E | 維持 backend-ci | **e2e.yml** 對齊 **5 spec** | Actions |
| P1 | ADMIN_KEY | 已支援 | 分類／商品寫入帶 header | 勿 commit |
| — | **§五 分類 CRUD** | **已完成** | **已完成** | — |
| P2 | 報表 | Finance 列表已可接 | 報表 MVP、toast | — |
| P2 | Named Tunnel | — | VITE_API_BASE_URL | 固定網域 |

---

## 四～七、任務／本日變更／參考

- 加量任務清單仍見下方 §四、§五（可並行）；本日變更真實時間見 daily-progress-format。
- [AGENT-DEV-INSTRUCTIONS.md](../AGENT-DEV-INSTRUCTIONS.md) · [notion-daily-2026-03-13.md](notion-daily-2026-03-13.md)

---

## 四、後端任務清單（加量／可並行）

**維運與品質**

- [ ] 維持 CI + jest 全綠；PR 前本地 `db push` + seed + test。
- [ ] 部署 migrate + seed 一頁式檢查清單（新環境／Preview）。
- [x] `GET /health` 已含 **`db.ok`**、可選 **`gitSha`**（`GIT_SHA`／`GITHUB_SHA`／`VERCEL_GIT_COMMIT_SHA`）。

**POS／庫存**

- [ ] **return-to-stock** 若需多品項一次退：文件 + 實作或維持單品項並寫明。
- [x] **GET /finance/events** 已支援 **`preset=last30d`**（報表預設區間，不破壞舊呼叫）。
- [x] **GET /inventory/events/export** CSV（最多 1 萬筆；Admin Key）。
- [ ] 整合測試：再 1～2 則邊界（空單、0 數量、重複退超量）。

**主檔／後台**

- [x] **Category DELETE**—`DELETE /categories/:id`，**409 CATEGORY_IN_USE**；api-design §6.0b。
- [ ] **Product** 加 `search` 後台專用或文件化現有 query。
- [ ] Seed：多一組「空倉＋新商品」利於 E2E 入庫盤點（可選）。

**文件**

- [ ] api-design-pos 與實作 diff 巡檢；backend-error-format 補漏碼。

---

## 五、前端任務清單（加量／可並行）

**CI／E2E**

- [ ] **e2e.yml** 與 one-click **5 spec** 一致；失敗 trace 上傳（可選）。
- [ ] **E2E**：後台建商品（需 ADMIN_KEY secret）（可選）。

**POS／明細**

- [ ] 訂單列表：**匯出 CSV** 或列印友善 CSS。
- [ ] POS：**單價／折扣**若後端有欄位再接；否則 UI 預留。

**後台**

- [ ] 庫存頁：**依 SKU 搜尋**、**匯出餘額 CSV**。
- [ ] Admin：**toast** 或全域錯誤條。

**產品化**

- [ ] Named Tunnel／Vercel 故障排除短鏈。
- [ ] **報表 MVP**：靜態頁 + 接 GET /finance/events。
- [ ] **Loading skeleton**／**空狀態** 統一元件。

---

## 六、本日變更紀錄（整合檔僅追加）

- **整合確認（AGENT §五）**：後端 **B-CRUD-1／B-CRUD-2** 與前端 **F-CRUD-1～F-CRUD-4** 已對照程式與進度檔—**無遺漏**；可選遺留：**後台分類 CRUD 專用 E2E**、**GET /categories/enriched**（品項／品牌／標籤彙總，非 §五 範圍）。
- **23:52 後台庫存三項**：（1）後台移除商家導覽／`/admin/merchants`，門市／倉庫隱藏商家選單、預設首個 merchant。（2）Product migration 描述／規格／定價售價成本 + CRUD；商品頁擴欄 + 全倉庫存唯讀加總。（3）**POST /inventory/transfer** 原子調撥 + 整合測試；入庫盤點頁雙倉調撥表單。
- **22:12 彙整**：後端 GET finance/events、Category POST/PATCH、jest 12；前端 returns/stock、E2E 5、Notion 日報檔；整合表與下一步對齊。
- 兩端進度檔本日變更須真實 HH:MM。

---

## 七、參考文件

- [AGENT-DEV-INSTRUCTIONS.md](../AGENT-DEV-INSTRUCTIONS.md)
- [admin-inventory-ui.md](../admin-inventory-ui.md)、[api-design-pos.md](../api-design-pos.md)、[e2e-pos.md](../e2e-pos.md)
- [backend-progress-2026-03-13.md](backend/backend-progress-2026-03-13.md)、[frontend-progress-pos-2026-03-13.md](frontend/frontend-progress-pos-2026-03-13.md)
