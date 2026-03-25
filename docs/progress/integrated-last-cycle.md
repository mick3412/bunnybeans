# 上一輪整合（規格 Agent 每輪覆寫）

**最新 agent-log（以 INSTRUCTIONS 編號為準）**：後端 **057** · 前端 **057**  
（路徑：[agent-collab/agent-log-backend.md](../agent-collab/agent-log-backend.md)、[agent-collab/agent-log-frontend.md](../agent-collab/agent-log-frontend.md)）

## 後端（收斂摘要）

- **INSTRUCTIONS 057 已完成**：
  - #1 迴歸確認與測試全綠。
  - #2 售後查詢 API 二次驗收：`GET /pos/orders` 邊界測試（空資料、混合情境、分頁）與篩選驗證。
  - #3 明細資料完整性：`GET /pos/orders/:id` 向後相容擴充售後摘要欄位（`hasRefunds`、`refundTotal`、`hasReturns`、`returnedItemCount`、`hasExchangeDerived` 等），支援明細 Tab 式售後。
  - #4 契約凍結：維持退款／退貨入庫／建單（含 `exchangeFromOrderId`）行為不變；`api-design-pos` 同步明細欄位說明。
- **測試**：`pnpm --filter pos-erp-backend test` 全綠（22 suites、164 tests）；`pnpm ci:backend-with-db` 全綠（曾遇 pos-sessions 間歇失敗，重跑即通過）。
- **commits**：`d9ad2d71` feat(pos-after-sales): validate filters/pagination and enrich order detail after-sales fields

## 前端（收斂摘要）

- **INSTRUCTIONS 057 已完成（功能）**：
  - #1 build 全綠。
  - #2～#5 訂單明細售後區塊重構：區塊重排、Tab 內嵌退款/退貨表單、換貨 inline 步驟（移除 MVP Modal）、子元件拆分（`OrderHeader`、`OrderContent`、`PaymentSection`、`AfterSalesPanel`、`ExchangeRelation`）。
  - #6 E2E：`pos-return-stock` 對齊先點「退貨入庫」Tab。
- **測試**：`pnpm --filter pos-erp-frontend build` ✅；Playwright 指定三檔 ⚠️（本機 `5173` 已被佔用，需 `reuseExistingServer` 或先釋放 port）。
- **commits**：待提交（agent-log 註記）

---

## 057 主題：後端明細售後欄位 + 訂單明細售後區塊重構

| 項目 | 狀態 |
|------|------|
| 後端 #2 售後列表篩選二次驗收 | 完成 |
| 後端 #3 明細售後摘要欄位擴充 | 完成 |
| 後端 #4 契約凍結與回歸 | 完成 |
| 前端 #1 迴歸 + 補提交意圖 | 進行中（commits 待提交） |
| 前端 #2～#5 明細重構 A～D | 完成 |
| 前端 #6 E2E 全綠驗收 | 部分（本機 port 阻擋） |

---

## 全局審查缺口清單（057 後剩餘）

### 已收斂

| 來源 | 狀態 |
|------|------|
| 訂單明細「假 Tab + 跳區塊」→ Tab 內直接操作 | 前端 057 已落地 |
| 後端明細售後摘要欄位 | 後端 057 已落地 |

### 待處理

| 來源 | 缺口 | 優先 |
|------|------|------|
| agent-log 前端 056/057 | 多筆「commits 待提交」，需補 atomic commits 與可追溯訊息 | 高 |
| E2E | Playwright 售後相關 spec 需穩定環境（port 5173）或 CI 驗證 | 中 |
| erp-roadmap Phase 1 剩餘 | Merchant/Store 預設門市後端欄位（選配） | 低 |

### 驗證與穩定（選配）

| 來源 | 缺口 | 說明 |
|------|------|------|
| 全量 E2E | 整包迴歸 | 可於 058 或 CI 排程執行 |

---

## 已開發模組進度

| 模組 | 後端 | 前端 | 備註 |
|------|------|------|------|
| 057 明細售後 API + 契約 | 完成 | — | 明細擴充欄位、列表篩選驗證 |
| 057 訂單明細售後 UX 重構 | — | 完成（待提交） | Tab 內嵌表單、子元件拆分、換貨 inline |

---

本檔為**實際進度總結**，下一輪具體任務見 [tasks/instructions/](../tasks/instructions/)（目前最新為 **INSTRUCTIONS 058**）§1。
