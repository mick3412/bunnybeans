# 前端 Agent 指定

> 本文件為前端開發／Agent 的角色、範圍、必讀文件、任務與協作原則。執行前端相關工作時請依此為準。

---

## 角色與範圍

- 你負責本專案**前端**（React、Vite、TypeScript、Tailwind）。
- **POS 收銀**：呼叫 `/pos/orders`、`/stores`、`/products`、`/categories`、`/brands`、`/health` 等；**不**直接呼叫 `/inventory/*`、`/finance/*`（扣庫由建單內部完成）。
- **Admin 後台**（`/admin/*`）：可呼叫 stable 的 `/inventory/*`（含 `balances/enriched`、`events`、手動 `POST events`）、`/products` CRUD、`/warehouses` 等，見 [docs/admin-inventory-ui.md](admin-inventory-ui.md)。

---

## 必讀文件（優先）

**先讀 [docs/progress/README.md](progress/README.md)** 與 **[docs/agent-collab/AGENT-COLLABORATION.md](agent-collab/AGENT-COLLABORATION.md)**；現行 log 在 **agent-collab**，上一輪摘要見 **integrated-last-cycle**。

1. [progress/README.md](progress/README.md) — 進度目錄說明  
2. [agent-collab/](agent-collab/AGENT-COLLABORATION.md) — 後端／前端累積 log；歷史日報見 [progress/archive/2026-03/](progress/archive/2026-03/)
3. [docs/collaboration-rules-backend-frontend.md](collaboration-rules-backend-frontend.md) — 前後端協作規則
4. [docs/api-design-pos.md](api-design-pos.md) — POS API 合約（Request/Response、stable 狀態）
5. [docs/backend-error-format.md](backend-error-format.md) — 錯誤格式、業務錯誤碼、traceId

若專案根目錄或 `frontend/` 有 README，建議一併閱讀。

---

## 串接合約（必守）

### 識別子與主檔

- **storeId、productId 一律使用 UUID**：從 `GET /stores`、`GET /products` 取得；不得使用 mock 或自訂 id 送給 `POST /pos/orders`。
- 商品區與結帳使用的門市、商品 id 須與 API 回傳一致。

### 結帳 Request（POST /pos/orders）

- **payments 總和必須等於訂單總額**：後端以 `items` 的 `quantity × unitPrice` 加總為訂單總額，並驗證 `payments[].amount` 加總與其相等（誤差 ≤ 0.01）。前端送出的 `payments` 須與此一致（目前為未稅經營，總額 = 小計，不另加稅）。
- Request 結構依 `docs/api-design-pos.md` 的 `CreatePosOrderRequest`（storeId、occurredAt、items、payments、customerId 可選）。

### 錯誤處理

- 錯誤回應依 `docs/backend-error-format.md`：**statusCode**、**message**、**traceId**（選填）、**code**（選填，業務錯誤碼）。
- 前端須顯示至少 message；建議顯示 traceId 以利除錯；若後端回傳 **code**，可依對照表 mapping 為友善文案（預留 `ERROR_CODE_MAP`）。
- 請求可帶 **X-Trace-Id** header，錯誤與後端 log 會回傳同一值。

---

## 當前狀態

- POS 前端已改接真實 API：結帳（POST /pos/orders）、訂單列表（GET /pos/orders）、訂單明細（GET /pos/orders/:id）；門市與商品自 GET /stores、GET /products 取得並使用 UUID。
- 稅額相關已暫時隱藏（未稅經營）；應收金額 = 小計，與後端驗證一致。
- 三列篩選（品項／品牌／折扣）目前為 mock；若後端提供 GET /categories、GET /brands 或商品查詢參數，可改為依 API。
- 歷史前端日進度（2026-03-13）：[progress/archive/2026-03/frontend-progress-pos-2026-03-13.md](progress/archive/2026-03/frontend-progress-pos-2026-03-13.md)。

---

## 你的任務（依整合計畫與協作規則）

### 必做

- **僅依文件與 shared 型別開發**：不以「閱讀後端程式碼」推論 API，以 `docs/api-design-pos.md`、`docs/backend-error-format.md` 為準。
- **維持串接合約**：UUID、payments 總和等於訂單總額、錯誤顯示 statusCode + message + traceId（與可選 code mapping）。
- **不直接呼叫** `/inventory/*`、`/finance/*`；若有新需求須透過 Owner 與後端文件更新。

### 可選

- 當後端在錯誤回應中補上 **code** 並於 `docs/backend-error-format.md` 定義對照表後，在前端補上 `ERROR_CODE_MAP` 實際對應。
- 若後端提供 GET /categories、GET /brands 或商品列表 API（含 category/brand/tags），將三列篩選改為依 API 選項與結果篩選。
- 訂單列表支援 storeId、from、to 篩選（API 已支援，可加 UI）。

---

## 協作原則

- **不猜 API**：結構與欄位以文件與 shared 為準；若需新增或改動，透過 Owner 提出，由後端更新文件與型別後再改前端。
- **進度紀錄**（必守，現行）：
  - 每輪完成追加 **[docs/agent-collab/agent-log-frontend.md](agent-collab/agent-log-frontend.md)**（僅追加；格式見該檔與 [daily-progress-format.md](daily-progress-format.md)）。
  - **舊制**（已歸檔）：`docs/progress/frontend/*.md` 已移至 **[docs/progress/archive/2026-03/](progress/archive/2026-03/)**，不再於 `progress/frontend/` 新建日檔。
  - 規格收尾覆寫 **[docs/progress/integrated-last-cycle.md](progress/integrated-last-cycle.md)**；流程見 **[agent-collab/AGENT-COLLABORATION.md](agent-collab/AGENT-COLLABORATION.md)**。
