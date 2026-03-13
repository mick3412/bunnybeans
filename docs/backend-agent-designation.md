# 後端 Agent 指定

> 本文件為後端開發／Agent 的角色、範圍、必讀文件、任務與協作原則。執行後端相關工作時請依此為準。

---

## 角色與範圍

- 你負責本專案**後端**（NestJS、Prisma、PostgreSQL）。
- POS / Inventory / Finance 模組與主檔 CRUD 已實作且標為 **stable**。
- **前端只會呼叫 POS Orders API**；庫存與金流由後端 PosModule 內部串接，前端不直接呼叫 `/inventory/*` 或 `/finance/*`。

---

## 必讀文件（優先）

**先讀 [docs/progress/README.md](progress/README.md)**，依其「最新檔案一覽」開啟最新整合報告與後端進度檔，再讀下列合約與設計文件。

1. [docs/progress/README.md](progress/README.md) — 進度入口；先讀此檔再開最新整合／後端檔
2. 最新整合報告、最新後端進度 — 路徑以 README 表列為準（例：`integrated-progress-YYYY-MM-DD.md`、`backend/backend-progress-YYYY-MM-DD.md`）
3. [docs/collaboration-rules-backend-frontend.md](collaboration-rules-backend-frontend.md) — 前後端協作規則
4. [docs/api-design-pos.md](api-design-pos.md)、[docs/api-design-inventory-finance.md](api-design-inventory-finance.md) — API 合約
5. [docs/backend-error-format.md](backend-error-format.md) — 錯誤格式與 log

---

## 當前狀態

- 主檔 CRUD、Inventory、Finance、POS、Seed、錯誤格式、整合測試、API 文件均已完成／標為 **stable**。
- 前端尚未改接真實 API；**你的變更不應破壞既有 POS API 合約**。

---

## 你的任務（依整合計畫「五、後端任務清單」與「步驟 5」）

### 必做

- **維持 POS / Inventory / Finance API 行為穩定**；若有任何變更，須同步更新：
  - `docs/api-design-pos.md`
  - `docs/api-design-inventory-finance.md`
  - `docs/backend-error-format.md`

### 可選

- 在錯誤回應中新增**業務錯誤碼** `code`（如 `POS_INVALID_INPUT`、`INVENTORY_INSUFFICIENT`），並在 `docs/backend-error-format.md` 補上對照表。
- 提供 **GET /categories**、**GET /brands** 或商品列表 API（含 category / brand / tags），供前端 POS 篩選使用。
- 為 Inventory / Finance 或關鍵流程補**整合或 e2e 測試**；維持現有 POS 整合測試可在 CI 執行。

---

## 協作原則

- **不破壞既有 POS Request/Response 合約**，避免阻塞前端改接。
- **進度紀錄**（必守）：
  - 寫入 **docs/progress/backend/backend-progress-YYYY-MM-DD.md**（當日已有檔則在同一檔內更新）。
  - **上方**「今日完成／卡點／To Do」可改寫為目前狀態。
  - **「本日變更紀錄」**區塊僅追加、不刪不改（每筆如 `- HH:MM 更新：…`）。
  - 完成後**更新 [docs/progress/README.md](progress/README.md)** 中後端該列的「最後更新」欄位。
  - 格式詳見 [docs/daily-progress-format.md](daily-progress-format.md)「docs/progress 各端檔案格式」。
