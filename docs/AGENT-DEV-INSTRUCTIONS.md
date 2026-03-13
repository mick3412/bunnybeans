# 後端／前端開發指令（給 Agent 與 Owner）

> 對齊：**2026-03-13** — jest **12**、E2E **5**、**returns/stock**、GET **finance/events**、Category、**Notion 日報** `docs/progress/notion-daily-2026-03-13.md`  
> **進度紀錄**：本日變更 **HH:MM = 實際寫入當下**（`date +%H:%M`）。見 `docs/daily-progress-format.md`。

---

## 下一階段計畫一覽

| 優先 | 項目 | 後端 | 前端 | 維運 |
|------|------|------|------|------|
| P1 | **CI = 本機 5 spec** | backend-ci 綠燈 | e2e.yml 跑齊 5 條 | Actions |
| P1 | ADMIN_API_KEY | 已支援 | 已帶 header | 勿 commit secret |
| P2 | Named Tunnel | — | VITE_API_BASE_URL | 固定網域 |
| P2 | 退貨入庫 UI（可選） | API 已有 | 明細 return-to-stock | — |
| P3 | 報表 | 只讀 API 草案 | 報表頁 | KPI |
| P2 | 加量後端 | 見 integrated §四（Finance 只讀、Category CRUD、測試） | — | — |
| P2 | 加量前端 | 見 integrated §五（return-to-stock E2E、分類頁、toast、報表 MVP） | — | — |
| — | Admin 角色矩陣 | **不做** | **不做** | [admin-roles.md](admin-roles.md) |

---

## 現況速覽（已完成）

| 後端 | 前端 |
|------|------|
| POS、returns/stock、GET finance/events、Category、CI、ADMIN_KEY、**12 tests** | 退款、退貨入庫 UI、**E2E 5**、admin、分類頁、**X-Admin-Key** |

---

## 一、後端 Agent — 複製貼上

```
你是本專案後端 Agent（NestJS、Prisma、PostgreSQL）。

【必讀】
docs/progress/integrated-progress-2026-03-13.md
docs/progress/backend/backend-progress-2026-03-13.md
docs/api-design-pos.md（含 return-to-stock）、docs/backend-error-format.md
docs/admin-inventory-ui.md、docs/admin-roles.md
docs/e2e-pos.md、docs/db-seed.md

【下一階段任務】
1. 維持 Backend CI 與 jest 綠燈。
2. 自 integrated-progress §四 任選 2～3 項並行：例如 GET /finance/events 草案+實作、Category CRUD、整合測試加邊界、health 擴充、文件巡檢。
3. 若改 API，先 api-design 再實作。
4. 進度檔本日變更：只追加，真實 HH:MM。

【完成後】
更新 backend-progress-YYYY-MM-DD.md、docs/progress/README.md。
```

---

## 二、前端 Agent — 複製貼上

```
你是本專案前端 Agent（React、Vite、Playwright）。

【必讀】
docs/progress/integrated-progress-2026-03-13.md
docs/progress/frontend/frontend-progress-pos-2026-03-13.md
docs/api-design-pos.md、docs/admin-inventory-ui.md、docs/e2e-pos.md

【下一階段任務】
1. e2e.yml 與 one-click **4 spec** 對齊；可再加 return-to-stock E2E。
2. 自 integrated-progress §五 任選 2～3 項並行：退貨入庫 UI、分類管理頁、庫存 CSV／SKU 搜尋、toast、報表 MVP 靜態頁、Loading／空狀態。
3. Named Tunnel 文案與登入頁一致。
4. 進度檔本日變更：只追加，真實 HH:MM。

【完成後】
更新 frontend-progress-YYYY-MM-DD.md、docs/progress/README.md。
```

---

## 三、維運 — 複製貼上

```
Named Tunnel → Vercel VITE_API_BASE_URL → Redeploy。
後端 ADMIN_API_KEY 與前端 VITE_ADMIN_API_KEY 同值；僅受控環境注入。
```

---

## 四、路徑

`docs/progress/integrated-progress-2026-03-13.md` · `docs/daily-progress-format.md`
