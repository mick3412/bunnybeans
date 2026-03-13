# 後端／前端開發指令（Agent 與 Owner）

## 0. 怎麼讀這份文件（30 秒）

| 你是誰 | 先看 | 再複製 |
|--------|------|--------|
| **後端 Agent** | §1 進度 + §3 下一階段「後端」 | §6 後端複製區 |
| **前端 Agent** | §1 進度 + §3 下一階段「前端」 | §7 前端複製區 |
| **Owner** | §1、§3 全表 | §8 維運 |

**進度紀錄規則**：本日變更只**追加**、`HH:MM` 用實際寫入當下。見 [`docs/daily-progress-format.md`](daily-progress-format.md)。

---

## 1. 最新進度摘要（複習用）

**後端**（詳 [`docs/progress/backend/backend-progress-2026-03-13.md`](progress/backend/backend-progress-2026-03-13.md)）

- POS 全流程、賒帳、補款、退款、**退貨入庫** `return-to-stock`／`returns/stock`。
- Inventory：**events**、**balances**、**transfer** 原子調撥；Finance：**GET /finance/events**；Category：**GET/POST/PATCH/DELETE**（DELETE → 409 `CATEGORY_IN_USE`）。
- **GET /health**：`db.ok`、`gitSha`（可選）；**ADMIN_API_KEY** + **X-Admin-Key**（inventory／products／categories 寫入）。
- **jest 16 passed**（本機 schema 須與 Prisma 一致）。

**前端**（詳 [`docs/progress/frontend/frontend-progress-pos-2026-03-13.md`](progress/frontend/frontend-progress-pos-2026-03-13.md)）

- POS、明細、退款、退貨入庫 → **`/returns/stock`**；**E2E 5 spec** + `e2e.yml`／one-click。
- 後台：分類 **完整 CRUD**、商品／倉庫等；**X-Admin-Key** 對齊受保護 API。
- 商品主檔：多倉庫庫存欄（每倉一欄）；本機 **僅一後端 :3003** 以免 E2E 404。

**整合**（詳 [`docs/progress/integrated-progress-2026-03-13.md`](progress/integrated-progress-2026-03-13.md)）

- **§五 分類 CRUD**：後端 DELETE + 前端 CRUD UI → **已完成**。
- **產品決策**：**多 SKU = 多款式**（無 ProductVariant）；見 §2。

**Notion 日報**：[`docs/progress/notion-daily-2026-03-13.md`](progress/notion-daily-2026-03-13.md)

---

## 2. 產品決策（已拍板）

| 決策 | 說明 |
|------|------|
| **多 SKU = 多款式** | 每色每尺寸 = **一筆 Product + 唯一 SKU**；不開 SPU／Variant 模型，除非另開專案。 |
| **分類** | 後台 **Category CRUD** 已交付（§五已完成）。 |

---

## 3. 下一階段開發計畫（指派用）

### 3.1 總表

| 優先 | 項目 | 後端 | 前端 | 維運 |
|------|------|------|------|------|
| **P1** | CI／E2E | 維持 **backend-ci**、**jest 綠** | **e2e.yml** 與本機 **5 spec** 一致 | Actions |
| **P1** | ADMIN_KEY | 已支援 | 受保護寫入皆帶 **X-Admin-Key** | 勿 commit secret |
| **P2** | **報表 MVP** | **GET /finance/events** 已可接；可選 query 預設區間／CSV 草案 | **靜態報表頁** + 列表表格 + 空狀態／錯誤 | — |
| **P2** | 後台 UX | 可選 **GET /categories/enriched**（分類下品項數／品牌／tags） | **Admin toast**；商品表 **倉庫欄**（收合／預設倉／僅顯示有量倉） | — |
| **P2** | CI 加強 | 可選 **Playwright job** 串後端（見 `e2e-pos.md`） | 可選 **後台分類 CRUD E2E**（需 ADMIN_KEY secret） | — |
| **P3** | Tunnel／部署 | — | **VITE_API_BASE_URL**、登入頁說明 | Named Tunnel |
| — | Admin RBAC 細分 | **不做** | **不做** | [admin-roles.md](admin-roles.md) |

### 3.2 後端 Agent — 建議任務包（本輪已實作項）

1. **CI + jest**（**16 tests**）；改 API 先 **api-design**。
2. **GET /finance/events?preset=last30d**（未帶 from/to 時近 30 日）。
3. **GET /categories/enriched**（`productCount`、`brandCodes[]`、`tags[]`）。
4. **GET /inventory/events/export**（CSV，最多 1 萬筆，Admin Key 若已設）。
5. **e2e.yml**：**backend-test** job → **playwright** `needs: backend-test`（見 `e2e-pos.md`）。
6. 進度見 **backend-progress**、**README**。

### 3.3 前端 Agent — 建議任務包（下一輪自選 2～4 項）

1. **報表 MVP**：新路由（例如 `/admin/reports` 或 `/reports`）+ **GET /finance/events** 分頁表；loading／錯誤／空狀態。
2. **Admin toast** 或全域錯誤條（後台操作回饋）。
3. **商品主檔**：倉庫欄過寬時—**預設只顯示總庫存 + 選定一倉**，或摺疊「各倉明細」。
4. **e2e.yml** 與 **5 spec** 對齊；可選 **分類 CRUD** smoke（需 **VITE_ADMIN_API_KEY** 與後端 KEY）。
5. 進度：**frontend-progress-YYYY-MM-DD.md** 只追加 + 更新 **README** 前端列。

---

## 4. 已完成歸檔（不必再排 §五）

| 區塊 | 狀態 |
|------|------|
| **§五 分類 CRUD** | 後端 **DELETE** + **409**；前端 **create/update/delete** + **needsAdminKey**；**admin-inventory-ui** 已對齊。 |
| 實作參考 | [`backend/.../category.controller.ts`](../backend/src/modules/category/interface/category.controller.ts)、[`AdminCategoriesPage.tsx`](../frontend/src/pages/admin/AdminCategoriesPage.tsx) |

---

## 5. 必讀路徑（Agent）

| 用途 | 路徑 |
|------|------|
| 整合現況 | `docs/progress/integrated-progress-2026-03-13.md` |
| 後端進度 | `docs/progress/backend/backend-progress-2026-03-13.md` |
| 前端進度 | `docs/progress/frontend/frontend-progress-pos-2026-03-13.md` |
| POS／退貨 | `docs/api-design-pos.md` |
| 錯誤碼 | `docs/backend-error-format.md` |
| 後台 API | `docs/admin-inventory-ui.md` |
| E2E | `docs/e2e-pos.md` |
| Seed／部署 | `docs/db-seed.md`、`docs/deploy-preview.md`（若有） |
| Prisma baseline | `docs/prisma-migrate-baseline.md`（本機曾 db push 者） |

---

## 6. 後端 Agent — 複製貼上全文

```
你是本專案後端 Agent（NestJS、Prisma、PostgreSQL）。

【必讀】docs/AGENT-DEV-INSTRUCTIONS.md §1、§3.2、§5
docs/progress/backend/backend-progress-2026-03-13.md
docs/api-design-pos.md、docs/backend-error-format.md
docs/admin-inventory-ui.md、docs/e2e-pos.md、docs/db-seed.md

【本輪目標】從 §3.2 任務包自選 2～4 項；優先維持 CI 與 jest 綠燈。
【規則】改 API 先 api-design；進度檔只追加 HH:MM。
【完成後】backend-progress-YYYY-MM-DD.md、docs/progress/README.md 後端列
```

---

## 7. 前端 Agent — 複製貼上全文

```
你是本專案前端 Agent（React、Vite、Playwright）。

【必讀】docs/AGENT-DEV-INSTRUCTIONS.md §1、§3.3、§5
docs/progress/frontend/frontend-progress-pos-2026-03-13.md
docs/api-design-pos.md、docs/admin-inventory-ui.md、docs/e2e-pos.md

【本輪目標】從 §3.3 任務包自選 2～4 項；優先報表 MVP 或 Admin UX（toast／商品倉庫欄）。
【規則】E2E 本機僅一後端 :3003；進度檔只追加 HH:MM。
【完成後】frontend-progress-YYYY-MM-DD.md、docs/progress/README.md 前端列
```

---

## 8. 維運 — 複製貼上

```
Named Tunnel → Vercel VITE_API_BASE_URL → Redeploy。
ADMIN_API_KEY（後端）與 VITE_ADMIN_API_KEY（前端）同值；勿 commit。
寫入：inventory events/transfer、products、categories 皆可能需 X-Admin-Key。
```

---

## 9. 目錄入口

- 進度總表：**[`docs/progress/README.md`](progress/README.md)**
