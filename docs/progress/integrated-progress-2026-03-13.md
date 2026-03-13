# 前後端整合進度報告與開發計畫 2026-03-13

> 整合自 [`backend-progress-2026-03-13.md`](backend/backend-progress-2026-03-13.md)（本日變更至 **22:12**）與 [`frontend-progress-pos-2026-03-13.md`](frontend/frontend-progress-pos-2026-03-13.md)（快照 **22:12**）。  
> **Notion 日報**（貼上即用）：[`notion-daily-2026-03-13.md`](notion-daily-2026-03-13.md)  
> **最後彙整**：後端 **jest 12 passed**、**GET /finance/events**、**Category POST/PATCH**、退貨入庫 **`/returns/stock`**；前端 **E2E 5 passed**、退貨入庫 UI、**AdminCategoriesPage**、**3003 單一實例** 維運備註。

---

## 零、同步摘要（一眼表）

| 主題 | 後端 | 前端 | 狀態 |
|------|------|------|------|
| POS | 建單、賒帳、補款、退款、**returns/stock**（退貨入庫） | 明細退款 + **退貨入庫** + **5 E2E** | **已對齊** |
| 金流只讀 | **GET /finance/events** 分頁 | 報表可接 | **後端已上** |
| 分類 | **POST/PATCH /categories** + Admin Key | **AdminCategoriesPage** | **已對齊** |
| E2E / CI | backend-ci；**jest 12**（4 suites） | **5 spec**；one-click／App | **已對齊** |
| 後台 | ADMIN_KEY、enriched、負庫存 | 商家／門市／倉庫 CRUD、分類、X-Admin-Key | **已交付** |
| 角色 | — | — | [admin-roles.md](../admin-roles.md) |

---

## 一、後端現況（摘要）

- **22:12**：GET /finance/events；Category POST/PATCH；**12 tests**；退貨入庫與 **returns/stock** 文件／實作一致（舊路徑若仍相容見 api-design-pos）。

---

## 二、前端現況（摘要）

- **22:12**：`postReturnToStock` → **`/pos/orders/:id/returns/stock`**；**5 passed**；明細 201 成功提示；本機 **僅一後端 :3003**。

---

## 三、下一步開發計畫

| 優先 | 項目 | 後端 | 前端 | 維運 |
|------|------|------|------|------|
| P1 | CI／E2E | 維持 backend-ci | **e2e.yml** 對齊 **5 spec** | Actions |
| P1 | ADMIN_KEY | 已支援 | 分類／商品寫入帶 header | 勿 commit |
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
- [ ] `GET /health` 可加 `gitSha`／`db:ok`（可選）利於部署驗收。

**POS／庫存**

- [ ] **return-to-stock** 若需多品項一次退：文件 + 實作或維持單品項並寫明。
- [ ] **GET /finance/events** 已上；可加匯出 CSV 或預設 date range（文件先）。
- [ ] **GET /inventory/events** 匯出 CSV 或 query 優化（文件先）。
- [ ] 整合測試：再 1～2 則邊界（空單、0 數量、重複退超量）。

**主檔／後台**

- [ ] **Category** 若需 DELETE／GET single，補 api-design + 實作。
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

- **22:12 彙整**：後端 GET finance/events、Category POST/PATCH、jest 12；前端 returns/stock、E2E 5、Notion 日報檔；整合表與下一步對齊。
- 兩端進度檔本日變更須真實 HH:MM。

---

## 七、參考文件

- [AGENT-DEV-INSTRUCTIONS.md](../AGENT-DEV-INSTRUCTIONS.md)
- [admin-inventory-ui.md](../admin-inventory-ui.md)、[api-design-pos.md](../api-design-pos.md)、[e2e-pos.md](../e2e-pos.md)
- [backend-progress-2026-03-13.md](backend/backend-progress-2026-03-13.md)、[frontend-progress-pos-2026-03-13.md](frontend/frontend-progress-pos-2026-03-13.md)
